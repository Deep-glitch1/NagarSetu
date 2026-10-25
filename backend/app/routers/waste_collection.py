"""Citizen read APIs for live waste collection tracking."""

from datetime import datetime, timedelta, timezone
import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import bindparam, text
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.routers.auth import get_current_identity
from app.routers.citizen import get_authenticated_citizen


router = APIRouter(
    prefix="/citizen/waste-collection",
    tags=["waste collection"],
)

employee_router = APIRouter(
    prefix="/employee/waste-collection",
    tags=["employee waste collection"],
)

admin_router = APIRouter(
    prefix="/admin/waste-collection",
    tags=["admin waste collection"],
)


class DriverLocationPayload(BaseModel):
    vehicle_id: int = Field(gt=0)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class TripStartPayload(BaseModel):
    vehicle_id: int = Field(gt=0)


class DriverAvailabilityPayload(BaseModel):
    status: str = Field(pattern=r"^(available|on_leave|off_duty)$")
    note: str | None = Field(default=None, max_length=500)


class AreaAssignmentPayload(BaseModel):
    driver_id: int | None = Field(default=None, gt=0)


def _require_super_admin(current_user: dict) -> None:
    if current_user.get("role") != "employee" or current_user.get("employee_role") != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the system administrator can view the full collection fleet.",
        )


def _require_waste_role(current_user: dict, allowed_roles: set[str]) -> int:
    if current_user.get("role") != "employee" or current_user.get("employee_role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="You do not have access to this waste collection action.")
    return int(current_user["id"])


def _supervisor_area(current_user: dict, db: Session) -> tuple[int, int]:
    supervisor_id = _require_waste_role(current_user, {"waste_supervisor"})
    area_id = db.execute(text("""
        SELECT e.administrative_unit_id
        FROM employees e
        WHERE e.id = :employee_id AND e.is_active = TRUE
    """), {"employee_id": supervisor_id}).scalar_one_or_none()
    if area_id is None:
        raise HTTPException(status_code=403, detail="Supervisor account has no assigned service area.")
    return supervisor_id, int(area_id)


def _require_citizen(current_user: dict, db: Session) -> None:
    get_authenticated_citizen(current_user=current_user, db=db)


@router.get("/wards")
def list_collection_wards(
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    """Return service areas available to citizens, including areas without polygons."""
    _require_citizen(current_user, db)
    rows = db.execute(text("""
        SELECT id, name, code, unit_type,
               ST_AsGeoJSON(boundary) AS boundary_geojson
        FROM administrative_units
        WHERE unit_type IN ('block', 'ward', 'municipal_zone')
          AND is_active = TRUE
        ORDER BY unit_type, name
    """)).mappings().all()

    return {
        "wards": [
            {
                "id": row["id"],
                "name": row["name"],
                "code": row["code"],
                "unit_type": row["unit_type"],
                "boundary": json.loads(row["boundary_geojson"]) if row["boundary_geojson"] else None,
            }
            for row in rows
        ]
    }


@router.get("/overview")
def get_collection_overview(
    ward_id: int | None = Query(default=None, gt=0),
    latitude: float | None = Query(default=None, ge=-90, le=90),
    longitude: float | None = Query(default=None, ge=-180, le=180),
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    """Return live vehicle positions and route history from existing tables."""
    _require_citizen(current_user, db)
    if (latitude is None) != (longitude is None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide both latitude and longitude.",
        )

    if ward_id is not None:
        ward_row = db.execute(text("""
            SELECT id, name, code, ST_AsGeoJSON(boundary) AS boundary_geojson
            FROM administrative_units
            WHERE id = :ward_id
              AND unit_type IN ('block', 'ward', 'municipal_zone')
              AND is_active = TRUE
        """), {"ward_id": ward_id}).mappings().one_or_none()
    elif latitude is not None:
        ward_row = db.execute(text("""
            SELECT id, name, code, ST_AsGeoJSON(boundary) AS boundary_geojson
            FROM administrative_units
            WHERE unit_type IN ('block', 'ward', 'municipal_zone')
              AND is_active = TRUE
              AND boundary IS NOT NULL
              AND ST_Covers(
                    boundary,
                    ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)
              )
            ORDER BY ST_Area(boundary) ASC
            LIMIT 1
        """), {"latitude": latitude, "longitude": longitude}).mappings().one_or_none()
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Select a ward or share your location to find your ward.",
        )

    if ward_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active service-area boundary covers this location. Choose an area from the list.",
        )

    ward_id = ward_row["id"]
    ward_boundary = json.loads(ward_row["boundary_geojson"]) if ward_row["boundary_geojson"] else None
    vehicle_rows = db.execute(text("""
        SELECT v.id,
               v.registration_number,
               v.administrative_unit_id,
               v.last_updated,
               v.is_active,
               e.name AS driver_name,
               t.started_at AS trip_started_at,
               ST_X(v.current_location::geometry) AS longitude,
               ST_Y(v.current_location::geometry) AS latitude,
               ST_Covers(ward.boundary, v.current_location::geometry) AS inside_geofence,
               latest.recorded_at AS latest_recorded_at,
               CASE
                 WHEN v.current_location IS NULL OR :latitude IS NULL THEN NULL
                 ELSE ST_Distance(
                   v.current_location,
                   ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography
                 )
               END AS distance_meters
        FROM vehicles v
        JOIN administrative_units ward ON ward.id = :ward_id
        JOIN waste_collection_trips t
          ON t.vehicle_id = v.id AND t.status = 'in_progress'
        LEFT JOIN employees e ON e.id = v.driver_id
        LEFT JOIN LATERAL (
            SELECT rl.recorded_at
            FROM route_logs rl
            WHERE rl.vehicle_id = v.id
            ORDER BY rl.recorded_at DESC, rl.id DESC
            LIMIT 1
        ) latest ON TRUE
        WHERE v.is_active = TRUE
          AND v.current_location IS NOT NULL
          AND v.last_updated >= NOW() - INTERVAL '3 minutes'
          AND (
            v.administrative_unit_id = :ward_id
            OR (v.current_location IS NOT NULL
                AND ST_Covers(ward.boundary, v.current_location::geometry))
          )
        ORDER BY v.last_updated DESC NULLS LAST, v.registration_number
    """), {
        "ward_id": ward_id,
        "latitude": latitude,
        "longitude": longitude,
    }).mappings().all()

    vehicle_ids = [row["id"] for row in vehicle_rows]
    logs = []
    if vehicle_ids:
        log_query = text("""
            SELECT rl.id, rl.vehicle_id, rl.location,
                   rl.recorded_at,
                   ST_X(rl.location::geometry) AS longitude,
                   ST_Y(rl.location::geometry) AS latitude,
                   ST_Covers(ward.boundary, rl.location::geometry) AS inside_geofence
            FROM route_logs rl
            JOIN administrative_units ward ON ward.id = :ward_id
            JOIN waste_collection_trips active_trip
              ON active_trip.vehicle_id = rl.vehicle_id
             AND active_trip.status = 'in_progress'
             AND rl.recorded_at >= active_trip.started_at
            WHERE rl.vehicle_id IN :vehicle_ids
              AND rl.recorded_at >= :since
            ORDER BY rl.recorded_at DESC, rl.id DESC
            LIMIT 300
        """).bindparams(bindparam("vehicle_ids", expanding=True))
        logs = db.execute(log_query, {
            "ward_id": ward_id,
            "vehicle_ids": vehicle_ids,
            "since": datetime.now(timezone.utc) - timedelta(hours=24),
        }).mappings().all()

    route_logs_by_vehicle: dict[int, list[dict]] = {vehicle_id: [] for vehicle_id in vehicle_ids}
    geofence_events = []
    previous_inside: dict[int, bool] = {}
    for row in reversed(logs):
        inside = bool(row["inside_geofence"]) if row["inside_geofence"] is not None else None
        before = previous_inside.get(row["vehicle_id"])
        if inside is not None and before is not None and before != inside:
            geofence_events.append({
                "vehicle_id": row["vehicle_id"],
                "vehicle_registration": next(
                    (item["registration_number"] for item in vehicle_rows if item["id"] == row["vehicle_id"]),
                    "Vehicle",
                ),
                "type": "entered" if inside else "left",
                "recorded_at": row["recorded_at"].isoformat(),
                "latitude": row["latitude"],
                "longitude": row["longitude"],
            })
        if inside is not None:
            previous_inside[row["vehicle_id"]] = inside
        route_logs_by_vehicle[row["vehicle_id"]].append({
            "id": row["id"],
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "recorded_at": row["recorded_at"].isoformat(),
            "inside_geofence": inside,
        })

    now = datetime.now(timezone.utc)
    vehicles = []
    for row in vehicle_rows:
        distance = row["distance_meters"]
        eta_minutes = None
        if distance is not None:
            # Straight-line estimate using a conservative city speed; actual road ETA
            # needs a routing provider and is not stored in the supplied schema.
            eta_minutes = max(1, round((float(distance) / 1000) / 18 * 60))
        last_updated = row["last_updated"]
        age_seconds = (now - last_updated).total_seconds() if last_updated else None
        vehicles.append({
            "id": row["id"],
            "registration_number": row["registration_number"],
            "driver_name": row["driver_name"],
            "trip_active": True,
            "trip_started_at": row["trip_started_at"].isoformat(),
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "last_updated": last_updated.isoformat() if last_updated else None,
            "gps_age_seconds": age_seconds,
            "is_live": age_seconds is not None and age_seconds <= 180,
            "inside_geofence": bool(row["inside_geofence"]) if row["inside_geofence"] is not None else None,
            "distance_meters": round(float(distance)) if distance is not None else None,
            "eta_minutes": eta_minutes,
            "route_logs": route_logs_by_vehicle.get(row["id"], []),
        })

    geofence_events.sort(key=lambda event: event["recorded_at"], reverse=True)
    return {
        "ward": {
            "id": ward_row["id"],
            "name": ward_row["name"],
            "code": ward_row["code"],
            "boundary": ward_boundary,
        },
        "vehicles": vehicles,
        "geofence_events": geofence_events[:30],
        "location": {"latitude": latitude, "longitude": longitude} if latitude is not None else None,
        "as_of": now.isoformat(),
    }


@employee_router.get("/my-assignment")
def get_my_collection_assignment(
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    """Return only vehicles currently assigned to the signed-in employee."""
    employee_id = _require_waste_role(current_user, {"waste_driver"})
    availability = db.execute(text("""
        SELECT status, note, updated_at
        FROM waste_driver_availability WHERE employee_id = :employee_id
    """), {"employee_id": employee_id}).mappings().one_or_none()
    rows = db.execute(text("""
        SELECT v.id, v.registration_number, v.last_updated, v.is_active,
               u.id AS area_id, u.name AS area_name, u.code AS area_code,
               u.unit_type AS area_type,
               ST_AsGeoJSON(u.boundary) AS boundary_geojson,
               ST_X(v.current_location::geometry) AS longitude,
               ST_Y(v.current_location::geometry) AS latitude,
               trip.id AS trip_id,
               trip.status AS trip_status,
               trip.started_at AS trip_started_at
        FROM vehicles v
        LEFT JOIN administrative_units u ON u.id = v.administrative_unit_id
        LEFT JOIN waste_collection_trips trip
          ON trip.vehicle_id = v.id AND trip.driver_id = :employee_id AND trip.status = 'in_progress'
        WHERE v.driver_id = :employee_id AND v.is_active = TRUE
        ORDER BY v.registration_number
    """), {"employee_id": employee_id}).mappings().all()

    vehicle_ids = [row["id"] for row in rows]
    logs_by_vehicle: dict[int, list[dict]] = {vehicle_id: [] for vehicle_id in vehicle_ids}
    if vehicle_ids:
        logs = db.execute(text("""
            SELECT rl.id, rl.vehicle_id, rl.recorded_at,
                   ST_X(rl.location::geometry) AS longitude,
                   ST_Y(rl.location::geometry) AS latitude,
                   CASE WHEN u.boundary IS NULL THEN NULL
                        ELSE ST_Covers(u.boundary, rl.location::geometry)
                   END AS inside_geofence
            FROM route_logs rl
            JOIN vehicles v ON v.id = rl.vehicle_id
            LEFT JOIN administrative_units u ON u.id = COALESCE(
                rl.administrative_unit_id, v.administrative_unit_id
            )
            WHERE rl.vehicle_id IN :vehicle_ids
              AND rl.recorded_at >= NOW() - INTERVAL '24 hours'
            ORDER BY rl.recorded_at DESC
            LIMIT 300
        """).bindparams(bindparam("vehicle_ids", expanding=True)), {
            "vehicle_ids": vehicle_ids,
        }).mappings().all()
        for row in reversed(logs):
            logs_by_vehicle[row["vehicle_id"]].append({
                "id": row["id"],
                "recorded_at": row["recorded_at"],
                "longitude": row["longitude"],
                "latitude": row["latitude"],
                "inside_geofence": row["inside_geofence"],
            })

    now = datetime.now(timezone.utc)
    vehicles = []
    for row in rows:
        age = (now - row["last_updated"].astimezone(timezone.utc)).total_seconds() if row["last_updated"] else None
        gps_logs = logs_by_vehicle[row["id"]]
        vehicles.append({
            "id": row["id"],
            "registration_number": row["registration_number"],
            "is_active": row["is_active"],
            "is_live": age is not None and age <= 120,
            "trip_id": row["trip_id"],
            "trip_status": row["trip_status"],
            "trip_started_at": row["trip_started_at"],
            "gps_age_seconds": age,
            "longitude": row["longitude"],
            "latitude": row["latitude"],
            "last_updated": row["last_updated"],
            "route_logs": gps_logs,
            "area": {
                "id": row["area_id"],
                "name": row["area_name"] or "Area not assigned",
                "code": row["area_code"],
                "unit_type": row["area_type"],
                "boundary": json.loads(row["boundary_geojson"]) if row["boundary_geojson"] else None,
            },
        })

    return {
        "employee": {"id": employee_id, "name": current_user.get("name")},
        "availability": availability["status"] if availability else "available",
        "vehicles": vehicles,
    }


@employee_router.post("/location", status_code=status.HTTP_201_CREATED)
def record_driver_location(
    payload: DriverLocationPayload,
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    """Append a GPS point only for a vehicle assigned to this employee."""
    employee_id = _require_waste_role(current_user, {"waste_driver"})
    vehicle = db.execute(text("""
        SELECT id, administrative_unit_id
        FROM vehicles
        WHERE id = :vehicle_id
          AND driver_id = :employee_id
          AND is_active = TRUE
          AND EXISTS (
              SELECT 1 FROM waste_collection_trips t
              WHERE t.vehicle_id = vehicles.id AND t.driver_id = :employee_id
                AND t.status = 'in_progress'
          )
    """), {"vehicle_id": payload.vehicle_id, "employee_id": employee_id}).mappings().one_or_none()
    if vehicle is None:
        raise HTTPException(status_code=404, detail="This vehicle is not assigned to your account.")

    log = db.execute(text("""
        INSERT INTO route_logs (vehicle_id, administrative_unit_id, location)
        VALUES (
            :vehicle_id,
            :administrative_unit_id,
            ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography
        )
        RETURNING id, recorded_at
    """), {
        "vehicle_id": payload.vehicle_id,
        "administrative_unit_id": vehicle["administrative_unit_id"],
        "longitude": payload.longitude,
        "latitude": payload.latitude,
    }).mappings().one()
    db.commit()
    return {"id": log["id"], "recorded_at": log["recorded_at"]}


@employee_router.post("/trips/start", status_code=status.HTTP_201_CREATED)
def start_collection_trip(
    payload: TripStartPayload,
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    driver_id = _require_waste_role(current_user, {"waste_driver"})
    vehicle = db.execute(text("""
        SELECT v.id, v.administrative_unit_id, a.status
        FROM vehicles v
        JOIN waste_driver_availability a ON a.employee_id = v.driver_id
        WHERE v.id = :vehicle_id AND v.driver_id = :driver_id AND v.is_active = TRUE
        FOR UPDATE OF v
    """), {"vehicle_id": payload.vehicle_id, "driver_id": driver_id}).mappings().one_or_none()
    if vehicle is None:
        raise HTTPException(status_code=404, detail="This active vehicle is not assigned to your account.")
    if vehicle["status"] != "available":
        raise HTTPException(status_code=409, detail="Your availability is not set to available.")
    if vehicle["administrative_unit_id"] is None:
        raise HTTPException(status_code=409, detail="The vehicle has no service area.")
    trip = db.execute(text("""
        INSERT INTO waste_collection_trips (vehicle_id, driver_id, administrative_unit_id)
        VALUES (:vehicle_id, :driver_id, :area_id)
        RETURNING id, started_at
    """), {
        "vehicle_id": payload.vehicle_id,
        "driver_id": driver_id,
        "area_id": vehicle["administrative_unit_id"],
    }).mappings().one()
    db.commit()
    return {"trip_id": trip["id"], "started_at": trip["started_at"], "status": "in_progress"}


@employee_router.post("/trips/{trip_id}/finish")
def finish_collection_trip(
    trip_id: int,
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    driver_id = _require_waste_role(current_user, {"waste_driver"})
    result = db.execute(text("""
        UPDATE waste_collection_trips
        SET status = 'completed', ended_at = CURRENT_TIMESTAMP
        WHERE id = :trip_id AND driver_id = :driver_id AND status = 'in_progress'
        RETURNING id, ended_at
    """), {"trip_id": trip_id, "driver_id": driver_id}).mappings().one_or_none()
    if result is None:
        raise HTTPException(status_code=404, detail="Active trip not found for your account.")
    db.commit()
    return {"trip_id": result["id"], "ended_at": result["ended_at"], "status": "completed"}


@employee_router.get("/supervisor/overview")
def get_area_supervisor_overview(
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    supervisor_id, area_id = _supervisor_area(current_user, db)
    area = db.execute(text("SELECT id,name,code FROM administrative_units WHERE id=:id"), {"id": area_id}).mappings().one()
    vehicles = db.execute(text("""
        SELECT v.id, v.registration_number, v.driver_id, driver.name AS driver_name,
               driver.employee_id AS driver_employee_code, availability.status AS availability_status,
               v.is_active, v.last_updated,
               ST_X(v.current_location::geometry) AS longitude,
               ST_Y(v.current_location::geometry) AS latitude,
               trip.id AS trip_id, trip.started_at AS trip_started_at
        FROM vehicles v
        LEFT JOIN employees driver ON driver.id = v.driver_id
        LEFT JOIN waste_driver_availability availability ON availability.employee_id = driver.id
        LEFT JOIN waste_collection_trips trip
          ON trip.vehicle_id = v.id AND trip.status = 'in_progress'
        WHERE v.administrative_unit_id = :area_id
        ORDER BY v.registration_number
    """), {"area_id": area_id}).mappings().all()
    drivers = db.execute(text("""
        SELECT e.id, e.employee_id, e.name, e.email, e.is_active,
               COALESCE(a.status, 'available') AS availability_status,
               a.note AS availability_note, a.updated_at AS availability_updated_at,
               assigned.id AS assigned_vehicle_id,
               assigned.registration_number AS assigned_vehicle,
               assigned.last_updated,
               active_trip.id AS active_trip_id
        FROM employees e
        JOIN employee_roles er ON er.employee_id = e.id
        JOIN roles role ON role.id = er.role_id AND role.name = 'waste_driver'
        LEFT JOIN waste_driver_availability a ON a.employee_id = e.id
        LEFT JOIN vehicles assigned ON assigned.driver_id = e.id AND assigned.is_active = TRUE
        LEFT JOIN waste_collection_trips active_trip
          ON active_trip.driver_id = e.id AND active_trip.status = 'in_progress'
        WHERE e.administrative_unit_id = :area_id
        ORDER BY e.name
    """), {"area_id": area_id}).mappings().all()
    return {
        "area": dict(area),
        "supervisor": {"id": supervisor_id, "name": current_user.get("name")},
        "vehicles": [dict(row) for row in vehicles],
        "drivers": [dict(row) for row in drivers],
        "as_of": datetime.now(timezone.utc).isoformat(),
    }


@employee_router.patch("/supervisor/drivers/{driver_id}/availability")
def update_area_driver_availability(
    driver_id: int,
    payload: DriverAvailabilityPayload,
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    supervisor_id, area_id = _supervisor_area(current_user, db)
    driver = db.execute(text("""
        SELECT e.id
        FROM employees e
        JOIN employee_roles er ON er.employee_id = e.id
        JOIN roles r ON r.id = er.role_id AND r.name = 'waste_driver'
        WHERE e.id = :driver_id AND e.administrative_unit_id = :area_id AND e.is_active = TRUE
    """), {"driver_id": driver_id, "area_id": area_id}).scalar_one_or_none()
    if driver is None:
        raise HTTPException(status_code=404, detail="Active driver not found in your service area.")
    active_trip = db.execute(text("""
        SELECT id FROM waste_collection_trips
        WHERE driver_id = :driver_id AND status = 'in_progress'
    """), {"driver_id": driver_id}).scalar_one_or_none()
    if payload.status != 'available' and active_trip is not None:
        raise HTTPException(status_code=409, detail="A driver on an active trip must finish the trip before being marked unavailable.")
    db.execute(text("""
        INSERT INTO waste_driver_availability (employee_id, status, note, updated_by, updated_at)
        VALUES (:driver_id, :status, :note, :supervisor_id, CURRENT_TIMESTAMP)
        ON CONFLICT (employee_id) DO UPDATE SET
            status = EXCLUDED.status, note = EXCLUDED.note,
            updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at
    """), {"driver_id": driver_id, "status": payload.status, "note": payload.note, "supervisor_id": supervisor_id})
    replacement = None
    if payload.status != 'available':
        vehicle = db.execute(text("""
            SELECT id FROM vehicles
            WHERE driver_id = :driver_id AND administrative_unit_id = :area_id AND is_active = TRUE
            FOR UPDATE
        """), {"driver_id": driver_id, "area_id": area_id}).scalar_one_or_none()
        if vehicle is not None:
            replacement = db.execute(text("""
                SELECT e.id, e.name
                FROM employees e
                JOIN employee_roles er ON er.employee_id = e.id
                JOIN roles r ON r.id = er.role_id AND r.name = 'waste_driver'
                JOIN waste_driver_availability a ON a.employee_id = e.id AND a.status = 'available'
                WHERE e.administrative_unit_id = :area_id AND e.is_active = TRUE
                  AND e.id <> :driver_id
                  AND NOT EXISTS (SELECT 1 FROM vehicles v WHERE v.driver_id=e.id AND v.is_active=TRUE)
                ORDER BY e.employee_id
                FOR UPDATE OF e SKIP LOCKED LIMIT 1
            """), {"area_id": area_id, "driver_id": driver_id}).mappings().one_or_none()
            db.execute(text("UPDATE vehicles SET driver_id=:replacement_id WHERE id=:vehicle_id"), {
                "replacement_id": replacement["id"] if replacement else None,
                "vehicle_id": vehicle,
            })
    db.commit()
    return {
        "message": "Driver availability updated.",
        "status": payload.status,
        "replacement_driver": dict(replacement) if replacement else None,
    }


@employee_router.post("/supervisor/auto-assign")
def auto_assign_area_drivers(
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    _, area_id = _supervisor_area(current_user, db)
    vehicles = db.execute(text("""
        SELECT v.id
        FROM vehicles v
        LEFT JOIN waste_driver_availability a ON a.employee_id = v.driver_id
        WHERE v.administrative_unit_id = :area_id AND v.is_active = TRUE
          AND (v.driver_id IS NULL OR COALESCE(a.status, 'off_duty') <> 'available')
          AND NOT EXISTS (SELECT 1 FROM waste_collection_trips t WHERE t.vehicle_id=v.id AND t.status='in_progress')
        ORDER BY v.registration_number
        FOR UPDATE OF v
    """), {"area_id": area_id}).scalars().all()
    assigned = []
    for vehicle_id in vehicles:
        driver = db.execute(text("""
            SELECT e.id, e.name
            FROM employees e
            JOIN employee_roles er ON er.employee_id=e.id
            JOIN roles r ON r.id=er.role_id AND r.name='waste_driver'
            JOIN waste_driver_availability a ON a.employee_id=e.id AND a.status='available'
            WHERE e.administrative_unit_id=:area_id AND e.is_active=TRUE
              AND NOT EXISTS (SELECT 1 FROM vehicles v WHERE v.driver_id=e.id AND v.is_active=TRUE)
            ORDER BY e.employee_id
            FOR UPDATE OF e SKIP LOCKED LIMIT 1
        """), {"area_id": area_id}).mappings().one_or_none()
        if driver is None:
            break
        db.execute(text("UPDATE vehicles SET driver_id=:driver_id WHERE id=:vehicle_id"), {
            "driver_id": driver["id"], "vehicle_id": vehicle_id,
        })
        assigned.append({"vehicle_id": vehicle_id, "driver_id": driver["id"], "driver_name": driver["name"]})
    db.commit()
    return {"assigned": assigned, "count": len(assigned)}


@employee_router.patch("/supervisor/vehicles/{vehicle_id}/assignment")
def assign_area_vehicle(
    vehicle_id: int,
    payload: AreaAssignmentPayload,
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    _, area_id = _supervisor_area(current_user, db)
    vehicle = db.execute(text("""
        SELECT id FROM vehicles
        WHERE id=:vehicle_id AND administrative_unit_id=:area_id AND is_active=TRUE
        FOR UPDATE
    """), {"vehicle_id": vehicle_id, "area_id": area_id}).scalar_one_or_none()
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Active vehicle not found in your service area.")
    trip = db.execute(text("SELECT id FROM waste_collection_trips WHERE vehicle_id=:id AND status='in_progress'"), {"id": vehicle_id}).scalar_one_or_none()
    if trip is not None:
        raise HTTPException(status_code=409, detail="Finish the active trip before changing its driver.")
    if payload.driver_id is not None:
        driver = db.execute(text("""
            SELECT e.id FROM employees e
            JOIN employee_roles er ON er.employee_id=e.id
            JOIN roles r ON r.id=er.role_id AND r.name='waste_driver'
            JOIN waste_driver_availability a ON a.employee_id=e.id AND a.status='available'
            WHERE e.id=:driver_id AND e.administrative_unit_id=:area_id AND e.is_active=TRUE
              AND NOT EXISTS (SELECT 1 FROM vehicles assigned WHERE assigned.driver_id=e.id AND assigned.is_active=TRUE AND assigned.id<>:vehicle_id)
        """), {"driver_id": payload.driver_id, "area_id": area_id, "vehicle_id": vehicle_id}).scalar_one_or_none()
        if driver is None:
            raise HTTPException(status_code=409, detail="Choose an available, unassigned driver from your service area.")
    db.execute(text("UPDATE vehicles SET driver_id=:driver_id WHERE id=:vehicle_id"), {
        "driver_id": payload.driver_id, "vehicle_id": vehicle_id,
    })
    db.commit()
    return {"message": "Area vehicle assignment updated.", "vehicle_id": vehicle_id}


@admin_router.get("/overview")
def get_admin_collection_overview(
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    """Show fleet, assigned employees, and service areas to the super admin."""
    _require_super_admin(current_user)
    vehicles = db.execute(text("""
        SELECT v.id, v.registration_number, v.is_active, v.last_updated,
               v.driver_id, e.name AS driver_name, e.employee_id AS driver_employee_code,
               availability.status AS driver_availability,
               active_trip.id AS active_trip_id, active_trip.started_at AS trip_started_at,
               u.id AS area_id, u.name AS area_name, u.code AS area_code,
               u.unit_type AS area_type,
               ST_X(v.current_location::geometry) AS longitude,
               ST_Y(v.current_location::geometry) AS latitude
        FROM vehicles v
        LEFT JOIN employees e ON e.id = v.driver_id
        LEFT JOIN waste_driver_availability availability ON availability.employee_id = e.id
        LEFT JOIN administrative_units u ON u.id = v.administrative_unit_id
        LEFT JOIN waste_collection_trips active_trip
          ON active_trip.vehicle_id = v.id AND active_trip.status = 'in_progress'
        ORDER BY u.name NULLS LAST, v.registration_number
    """)).mappings().all()
    employees = db.execute(text("""
        SELECT e.id, e.employee_id, e.name, e.email,
               e.administrative_unit_id, unit.name AS home_area,
               COALESCE(STRING_AGG(DISTINCT r.name, ', '), '') AS role
        FROM employees e
        LEFT JOIN administrative_units unit ON unit.id = e.administrative_unit_id
        LEFT JOIN employee_roles er ON er.employee_id = e.id
        LEFT JOIN roles r ON r.id = er.role_id
        WHERE e.is_active = TRUE
          AND NOT EXISTS (
              SELECT 1
              FROM employee_roles admin_er
              JOIN roles admin_role ON admin_role.id = admin_er.role_id
              WHERE admin_er.employee_id = e.id
                AND admin_role.name IN (
                    'super_admin', 'municipal_admin', 'department_head',
                    'block_officer', 'district_officer'
                )
          )
        GROUP BY e.id, unit.name
        ORDER BY e.name
    """)).mappings().all()
    supervisors = db.execute(text("""
        SELECT e.id, e.employee_id, e.name, e.email,
               u.id AS area_id, u.name AS area_name
        FROM employees e
        JOIN employee_roles er ON er.employee_id=e.id
        JOIN roles r ON r.id=er.role_id AND r.name='waste_supervisor'
        LEFT JOIN administrative_units u ON u.id=e.administrative_unit_id
        WHERE e.is_active=TRUE
        ORDER BY u.name, e.name
    """)).mappings().all()
    areas = db.execute(text("""
        SELECT id, name, code, unit_type, parent_id,
               ST_AsGeoJSON(boundary) AS boundary_geojson
        FROM administrative_units
        WHERE is_active = TRUE
          AND unit_type IN ('block', 'ward', 'municipal_zone')
        ORDER BY unit_type, name
    """)).mappings().all()
    route_counts = db.execute(text("""
        SELECT vehicle_id, COUNT(*) AS gps_points,
               MAX(recorded_at) AS latest_gps_at
        FROM route_logs
        WHERE recorded_at >= NOW() - INTERVAL '24 hours'
        GROUP BY vehicle_id
    """)).mappings().all()
    counts_by_vehicle = {row["vehicle_id"]: row for row in route_counts}
    now = datetime.now(timezone.utc)
    fleet = []
    for row in vehicles:
        age = (now - row["last_updated"].astimezone(timezone.utc)).total_seconds() if row["last_updated"] else None
        gps = counts_by_vehicle.get(row["id"])
        fleet.append({
            "id": row["id"],
            "registration_number": row["registration_number"],
            "is_active": row["is_active"],
            "driver_id": row["driver_id"],
            "driver_name": row["driver_name"],
            "driver_employee_code": row["driver_employee_code"],
            "driver_availability": row["driver_availability"],
            "active_trip_id": row["active_trip_id"],
            "trip_started_at": row["trip_started_at"],
            "area_id": row["area_id"],
            "area_name": row["area_name"],
            "area_code": row["area_code"],
            "area_type": row["area_type"],
            "longitude": row["longitude"],
            "latitude": row["latitude"],
            "last_updated": row["last_updated"],
            "gps_age_seconds": age,
            "gps_points_24h": gps["gps_points"] if gps else 0,
            "latest_gps_at": gps["latest_gps_at"] if gps else None,
        })
    return {
        "vehicles": fleet,
        "employees": [dict(row) for row in employees],
        "supervisors": [dict(row) for row in supervisors],
        "areas": [{
            "id": row["id"],
            "name": row["name"],
            "code": row["code"],
            "unit_type": row["unit_type"],
            "parent_id": row["parent_id"],
            "boundary": json.loads(row["boundary_geojson"]) if row["boundary_geojson"] else None,
        } for row in areas],
        "as_of": now.isoformat(),
    }
