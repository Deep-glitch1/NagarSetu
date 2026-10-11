"""Citizen read APIs for live waste collection tracking."""

from datetime import datetime, timedelta, timezone
import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import bindparam, text
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.routers.auth import get_current_identity
from app.routers.citizen import get_authenticated_citizen


router = APIRouter(
    prefix="/citizen/waste-collection",
    tags=["waste collection"],
)


def _require_citizen(current_user: dict, db: Session) -> None:
    get_authenticated_citizen(current_user=current_user, db=db)


@router.get("/wards")
def list_collection_wards(
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    """Return existing ward boundaries that can be selected by a citizen."""
    _require_citizen(current_user, db)
    rows = db.execute(text("""
        SELECT id, name, code,
               ST_AsGeoJSON(boundary) AS boundary_geojson
        FROM administrative_units
        WHERE unit_type = 'ward'
          AND is_active = TRUE
          AND boundary IS NOT NULL
        ORDER BY name
    """)).mappings().all()

    return {
        "wards": [
            {
                "id": row["id"],
                "name": row["name"],
                "code": row["code"],
                "boundary": json.loads(row["boundary_geojson"]),
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
              AND unit_type = 'ward'
              AND is_active = TRUE
              AND boundary IS NOT NULL
        """), {"ward_id": ward_id}).mappings().one_or_none()
    elif latitude is not None:
        ward_row = db.execute(text("""
            SELECT id, name, code, ST_AsGeoJSON(boundary) AS boundary_geojson
            FROM administrative_units
            WHERE unit_type = 'ward'
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
            detail="No active ward boundary covers this location.",
        )

    ward_id = ward_row["id"]
    ward_boundary = json.loads(ward_row["boundary_geojson"])
    vehicle_rows = db.execute(text("""
        SELECT v.id,
               v.registration_number,
               v.administrative_unit_id,
               v.last_updated,
               v.is_active,
               e.name AS driver_name,
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
        LEFT JOIN employees e ON e.id = v.driver_id
        LEFT JOIN LATERAL (
            SELECT rl.recorded_at
            FROM route_logs rl
            WHERE rl.vehicle_id = v.id
            ORDER BY rl.recorded_at DESC, rl.id DESC
            LIMIT 1
        ) latest ON TRUE
        WHERE v.is_active = TRUE
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
        inside = bool(row["inside_geofence"])
        before = previous_inside.get(row["vehicle_id"])
        if before is not None and before != inside:
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
