"""
NagarSetu complaint intelligence.

Handles:

- Same-citizen duplicate detection
- Spatial DBSCAN clustering
- Cluster size calculation
- Category severity
- SLA/time pressure
- Dynamic priority calculation
- SLA escalation processing
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session


# ============================================================
# CONFIGURATION
# ============================================================

DUPLICATE_RADIUS_METERS = 50
DUPLICATE_WINDOW_DAYS = 14

CLUSTER_RADIUS_METERS = 50
CLUSTER_MIN_POINTS = 2


# Priority weights
CATEGORY_WEIGHT = 0.25
CLUSTER_WEIGHT = 0.35
TIME_WEIGHT = 0.40


# Category severity
CATEGORY_SEVERITY = {
    "ROAD_DAMAGED": 80,
    "POTHOLE": 80,
    "STREET_LIGHT": 70,
    "GARBAGE": 60,
    "OTHER": 40,
}


# ============================================================
# DUPLICATE DETECTION
# ============================================================

def find_duplicate_master(
    *,
    db: Session,
    category_id: int,
    citizen_id: int,
    latitude: float,
    longitude: float,
) -> int | None:
    """
    A complaint is a duplicate only when:

    - same citizen
    - same category
    - within 50 meters
    - within previous 14 days
    - existing complaint is active

    Different citizens are NOT considered duplicates.
    """

    cutoff = (
        datetime.now(timezone.utc)
        - timedelta(
            days=DUPLICATE_WINDOW_DAYS
        )
    )

    duplicate_id = db.execute(
        text(
            """
            SELECT c.id

            FROM complaints c

            WHERE c.category_id = :category_id

              AND c.reported_by = :citizen_id

              AND c.created_at >= :cutoff

              AND c.status NOT IN (
                  'closed',
                  'rejected'
              )

              AND ST_DWithin(
                  c.location,

                  ST_SetSRID(
                      ST_MakePoint(
                          :longitude,
                          :latitude
                      ),
                      4326
                  )::geography,

                  :radius
              )

            ORDER BY c.created_at ASC

            LIMIT 1
            """
        ),
        {
            "category_id": category_id,
            "citizen_id": citizen_id,
            "cutoff": cutoff,
            "longitude": longitude,
            "latitude": latitude,
            "radius": DUPLICATE_RADIUS_METERS,
        },
    ).scalar_one_or_none()

    if duplicate_id is None:
        return None

    return int(duplicate_id)


# ============================================================
# DEPARTMENT ROUTING
# ============================================================

def find_department(
    *,
    db: Session,
    category_id: int,
) -> int | None:
    """
    Find the highest-priority active department mapped
    to the complaint category.
    """

    department_id = db.execute(
        text(
            """
            SELECT dc.department_id

            FROM department_categories dc

            JOIN departments d
                ON d.id = dc.department_id

            WHERE dc.category_id = :category_id

              AND d.is_active = TRUE

            ORDER BY
                dc.priority_weight DESC,
                dc.department_id

            LIMIT 1
            """
        ),
        {
            "category_id": category_id,
        },
    ).scalar_one_or_none()

    if department_id is None:
        return None

    return int(department_id)


# ============================================================
# CLUSTER REFRESH
# ============================================================

def refresh_category_clusters(
    *,
    db: Session,
    category_id: int,
) -> dict[int, int]:
    """
    Refresh spatial complaint clusters for one category.

    Rules:

    - Only master complaints participate.
    - Duplicate complaints are excluded.
    - Closed/rejected complaints are excluded.
    - DBSCAN is performed within the category.
    - Isolated complaints receive cluster size 1.

    Returns:

        {
            complaint_id: cluster_size
        }
    """

    # --------------------------------------------------------
    # Remove old clusters
    # --------------------------------------------------------

    db.execute(
        text(
            """
            DELETE FROM complaint_clusters

            WHERE category_id = :category_id
            """
        ),
        {
            "category_id": category_id,
        },
    )

    # --------------------------------------------------------
    # Build DBSCAN clusters
    # --------------------------------------------------------

    rows = db.execute(
        text(
            """
            WITH clustered AS (

                SELECT
                    c.id,
                    c.category_id,
                    c.location,

                    ST_ClusterDBSCAN(
                        ST_Transform(
                            c.location::geometry,
                            3857
                        ),

                        eps := :radius,

                        minpoints := :min_points
                    ) OVER (
                        PARTITION BY c.category_id
                    ) AS cluster_id

                FROM complaints c

                WHERE c.category_id = :category_id

                  AND c.master_complaint_id IS NULL

                  AND c.status NOT IN (
                      'closed',
                      'rejected'
                  )

                  AND c.location IS NOT NULL
            ),

            valid_clusters AS (

                SELECT
                    category_id,
                    cluster_id,

                    COUNT(*) AS complaint_count,

                    ST_Transform(
                        ST_Centroid(
                            ST_Collect(
                                ST_Transform(
                                    location::geometry,
                                    3857
                                )
                            )
                        ),
                        4326
                    )::geography AS centroid

                FROM clustered

                WHERE cluster_id IS NOT NULL

                GROUP BY
                    category_id,
                    cluster_id
            ),

            inserted_clusters AS (

                INSERT INTO complaint_clusters (
                    category_id,
                    centroid,
                    complaint_count,
                    refreshed_at
                )

                SELECT
                    category_id,
                    centroid,
                    complaint_count,
                    CURRENT_TIMESTAMP

                FROM valid_clusters

                RETURNING id
            )

            SELECT
                cl.id AS complaint_id,

                COALESCE(
                    vc.complaint_count,
                    1
                ) AS cluster_size

            FROM clustered cl

            LEFT JOIN valid_clusters vc

                ON vc.category_id
                    = cl.category_id

               AND vc.cluster_id
                    = cl.cluster_id

            ORDER BY cl.id
            """
        ),
        {
            "category_id": category_id,
            "radius": CLUSTER_RADIUS_METERS,
            "min_points": CLUSTER_MIN_POINTS,
        },
    ).all()

    return {
        int(row.complaint_id): int(
            row.cluster_size
        )
        for row in rows
    }


# ============================================================
# CATEGORY SEVERITY
# ============================================================

def get_category_severity(
    category_code: str,
    *,
    is_emergency: bool = False,
) -> float:
    """
    Return category severity from 0-100.
    """

    if is_emergency:
        return 100.0

    return float(
        CATEGORY_SEVERITY.get(
            category_code,
            50,
        )
    )


# ============================================================
# CLUSTER SCORE
# ============================================================

def get_cluster_score(
    cluster_size: int | None,
) -> float:
    """
    Convert independent citizen reports into
    a 0-100 cluster pressure score.

    1 -> 0
    2 -> 20
    3 -> 40
    4 -> 60
    5 -> 80
    6+ -> 100
    """

    if cluster_size is None:
        cluster_size = 1

    cluster_size = max(
        1,
        int(cluster_size),
    )

    score = (
        cluster_size - 1
    ) * 20

    return float(
        min(
            score,
            100,
        )
    )


# ============================================================
# TIME SCORE
# ============================================================

def get_time_score(
    *,
    created_at: datetime,
    target_hours: int,
    now: datetime | None = None,
) -> tuple[float, float, float]:
    """
    Returns:

        time_score
        elapsed_hours
        elapsed_percentage

    100 time-score is reached at 300% of SLA.

    Example for 72-hour SLA:

        36h  -> 50%
        57.6h -> 80%
        72h  -> 100%
        216h -> 300%
    """

    if now is None:
        now = datetime.now(timezone.utc)

    if created_at.tzinfo is None:
        created_at = created_at.replace(
            tzinfo=timezone.utc
        )

    elapsed_seconds = (
        now - created_at
    ).total_seconds()

    elapsed_hours = max(
        0.0,
        elapsed_seconds / 3600.0,
    )

    if target_hours <= 0:
        return (
            100.0,
            elapsed_hours,
            100.0,
        )

    elapsed_percentage = (
        elapsed_hours
        / target_hours
        * 100.0
    )

    # 300% SLA -> 100 time pressure
    time_score = min(
        100.0,
        elapsed_percentage / 3.0,
    )

    return (
        float(time_score),
        float(elapsed_hours),
        float(elapsed_percentage),
    )


# ============================================================
# SLA STATE
# ============================================================

def get_sla_state(
    elapsed_percentage: float,
) -> str:
    """
    Return current SLA state.
    """

    if elapsed_percentage >= 300:
        return "critical_backlog"

    if elapsed_percentage >= 100:
        return "overdue"

    if elapsed_percentage >= 80:
        return "supervisor"

    if elapsed_percentage >= 50:
        return "warning"

    return "normal"


# ============================================================
# PRIORITY
# ============================================================

def calculate_priority(
    *,
    category_code: str,
    cluster_size: int,
    created_at: datetime,
    target_hours: int,
    is_emergency: bool = False,
    now: datetime | None = None,
) -> dict:
    """
    Calculate dynamic complaint priority.

    Weighted score:

        category severity = 25%
        cluster pressure = 35%
        time/SLA pressure = 40%

    Emergency complaints are immediately critical.
    """

    category_score = get_category_severity(
        category_code,
        is_emergency=is_emergency,
    )

    cluster_score = get_cluster_score(
        cluster_size
    )

    (
        time_score,
        elapsed_hours,
        elapsed_percentage,
    ) = get_time_score(
        created_at=created_at,
        target_hours=target_hours,
        now=now,
    )

    # --------------------------------------------------------
    # Weighted score
    # --------------------------------------------------------

    final_score = (
        category_score * CATEGORY_WEIGHT
        + cluster_score * CLUSTER_WEIGHT
        + time_score * TIME_WEIGHT
    )

    # --------------------------------------------------------
    # Emergency
    # --------------------------------------------------------

    if is_emergency:
        final_score = 100.0

    # --------------------------------------------------------
    # Base priority
    # --------------------------------------------------------

    if final_score < 25:
        priority = "low"

    elif final_score < 50:
        priority = "medium"

    elif final_score < 75:
        priority = "high"

    else:
        priority = "critical"

    # --------------------------------------------------------
    # SLA state should also influence minimum urgency.
    #
    # Overdue => at least HIGH
    # Critical backlog => CRITICAL
    # --------------------------------------------------------

    sla_state = get_sla_state(
        elapsed_percentage
    )

    if sla_state == "critical_backlog":

        priority = "critical"

    elif (
        sla_state == "overdue"
        and priority in (
            "low",
            "medium",
        )
    ):

        priority = "high"

    return {
        "score": round(
            final_score,
            2,
        ),

        "priority": priority,

        "category_score": round(
            category_score,
            2,
        ),

        "cluster_score": round(
            cluster_score,
            2,
        ),

        "time_score": round(
            time_score,
            2,
        ),

        "cluster_size": int(
            cluster_size
        ),

        "elapsed_hours": round(
            elapsed_hours,
            2,
        ),

        "elapsed_percentage": round(
            elapsed_percentage,
            2,
        ),

        "sla_state": sla_state,

        "target_hours": int(
            target_hours
        ),
    }


# ============================================================
# ESCALATION TARGET
# ============================================================

def get_escalation_target(
    *,
    db: Session,
    complaint_id: int,
    department_id: int | None,
    level: int,
) -> int | None:
    """
    Determine escalation recipient.

    Level 1 -> assigned officer
    Level 2 -> supervisor
    Level 3 -> supervisor
    Level 4 -> department head
    """

    # --------------------------------------------------------
    # LEVEL 1 -> OFFICER
    # --------------------------------------------------------

    if level == 1:

        officer_id = db.execute(
            text(
                """
                SELECT ca.officer_id

                FROM complaint_assignments ca

                JOIN employees e
                    ON e.id = ca.officer_id

                WHERE ca.complaint_id = :complaint_id

                  AND ca.unassigned_at IS NULL

                  AND e.is_active = TRUE

                LIMIT 1
                """
            ),
            {
                "complaint_id": complaint_id,
            },
        ).scalar_one_or_none()

        return (
            int(officer_id)
            if officer_id is not None
            else None
        )

    # --------------------------------------------------------
    # LEVEL 2 / 3 -> SUPERVISOR
    # --------------------------------------------------------

    if level in (2, 3):

        if department_id is None:
            return None

        supervisor_id = db.execute(
            text(
                """
                SELECT e.id

                FROM employees e

                JOIN employee_roles er
                    ON er.employee_id = e.id

                JOIN roles r
                    ON r.id = er.role_id

                WHERE e.department_id = :department_id

                  AND e.is_active = TRUE

                  AND r.name = 'supervisor'

                ORDER BY e.id

                LIMIT 1
                """
            ),
            {
                "department_id": department_id,
            },
        ).scalar_one_or_none()

        return (
            int(supervisor_id)
            if supervisor_id is not None
            else None
        )

    # --------------------------------------------------------
    # LEVEL 4 -> DEPARTMENT HEAD
    # --------------------------------------------------------

    if level == 4:

        if department_id is None:
            return None

        head_id = db.execute(
            text(
                """
                SELECT e.id

                FROM employees e

                JOIN employee_roles er
                    ON er.employee_id = e.id

                JOIN roles r
                    ON r.id = er.role_id

                WHERE e.department_id = :department_id

                  AND e.is_active = TRUE

                  AND r.name = 'department_head'

                ORDER BY e.id

                LIMIT 1
                """
            ),
            {
                "department_id": department_id,
            },
        ).scalar_one_or_none()

        return (
            int(head_id)
            if head_id is not None
            else None
        )

    return None


# ============================================================
# RECORD ESCALATION
# ============================================================

def record_escalation(
    *,
    db: Session,
    complaint_id: int,
    department_id: int | None,
    level: int,
    percentage: int,
    reason: str,
) -> bool:
    """
    Create an escalation record.

    UNIQUE(complaint_id, escalation_level)
    prevents duplicate escalation records.
    """

    target_id = get_escalation_target(
        db=db,
        complaint_id=complaint_id,
        department_id=department_id,
        level=level,
    )

    inserted_id = db.execute(
        text(
            """
            INSERT INTO complaint_escalations (
                complaint_id,
                escalation_level,
                escalation_percentage,
                escalated_to,
                reason,
                escalated_at
            )

            VALUES (
                :complaint_id,
                :level,
                :percentage,
                :target_id,
                :reason,
                CURRENT_TIMESTAMP
            )

            ON CONFLICT (
                complaint_id,
                escalation_level
            )

            DO NOTHING

            RETURNING id
            """
        ),
        {
            "complaint_id": complaint_id,
            "level": level,
            "percentage": percentage,
            "target_id": target_id,
            "reason": reason,
        },
    ).scalar_one_or_none()

    return inserted_id is not None


# ============================================================
# SLA ESCALATION LEVEL
# ============================================================

def get_highest_escalation_level(
    elapsed_percentage: float,
) -> int:

    if elapsed_percentage >= 300:
        return 4

    if elapsed_percentage >= 100:
        return 3

    if elapsed_percentage >= 80:
        return 2

    if elapsed_percentage >= 50:
        return 1

    return 0


# ============================================================
# SLA ENGINE
# ============================================================

def run_sla_engine(
    db: Session,
) -> dict:
    """
    Process all open master complaints.

    This function is intended to run periodically,
    preferably once every hour.

    It:

    - refreshes clusters
    - recalculates priority
    - checks SLA percentage
    - creates escalation records
    """

    now = datetime.now(timezone.utc)

    category_ids = db.execute(
        text(
            """
            SELECT DISTINCT category_id

            FROM complaints

            WHERE master_complaint_id IS NULL

              AND status NOT IN (
                  'verified',
                  'closed',
                  'rejected'
              )

            ORDER BY category_id
            """
        )
    ).scalars().all()

    processed = 0
    escalations_created = 0

    # ========================================================
    # CATEGORY BY CATEGORY
    # ========================================================

    for category_id in category_ids:

        category_id = int(category_id)

        cluster_sizes = (
            refresh_category_clusters(
                db=db,
                category_id=category_id,
            )
        )

        complaints = db.execute(
            text(
                """
                SELECT

                    c.id,

                    c.department_id,

                    c.created_at,

                    cc.code AS category_code,

                    cc.is_emergency,

                    sla.target_hours

                FROM complaints c

                JOIN complaint_categories cc
                    ON cc.id = c.category_id

                LEFT JOIN complaint_sla sla
                    ON sla.category_id = c.category_id

                WHERE c.category_id = :category_id

                  AND c.master_complaint_id IS NULL

                  AND c.status NOT IN (
                      'verified',
                      'closed',
                      'rejected'
                  )

                ORDER BY c.created_at ASC
                """
            ),
            {
                "category_id": category_id,
            },
        ).mappings().all()

        # ====================================================
        # PROCESS EACH COMPLAINT
        # ====================================================

        for complaint in complaints:

            complaint_id = int(
                complaint["id"]
            )

            department_id = (
                int(complaint["department_id"])
                if complaint["department_id"] is not None
                else None
            )

            target_hours = complaint[
                "target_hours"
            ]

            if target_hours is None:
                target_hours = 72

            cluster_size = cluster_sizes.get(
                complaint_id,
                1,
            )

            priority_data = calculate_priority(
                category_code=(
                    complaint["category_code"]
                ),

                cluster_size=cluster_size,

                created_at=(
                    complaint["created_at"]
                ),

                target_hours=int(
                    target_hours
                ),

                is_emergency=bool(
                    complaint["is_emergency"]
                ),

                now=now,
            )

            # ------------------------------------------------
            # UPDATE PRIORITY
            # ------------------------------------------------

            db.execute(
                text(
                    """
                    UPDATE complaints

                    SET priority = :priority,
                        updated_at = CURRENT_TIMESTAMP

                    WHERE id = :complaint_id
                    """
                ),
                {
                    "priority": (
                        priority_data["priority"]
                    ),

                    "complaint_id": complaint_id,
                },
            )

            processed += 1

            # ------------------------------------------------
            # SLA ESCALATION
            # ------------------------------------------------

            highest_level = (
                get_highest_escalation_level(
                    priority_data[
                        "elapsed_percentage"
                    ]
                )
            )

            if highest_level == 0:
                continue

            escalation_config = {
                1: (
                    50,
                    "SLA reached 50% warning threshold.",
                ),

                2: (
                    80,
                    "SLA reached 80% supervisor threshold.",
                ),

                3: (
                    100,
                    "Complaint is overdue at 100% of SLA.",
                ),

                4: (
                    300,
                    "Complaint reached 300% SLA critical backlog.",
                ),
            }

            for level in range(
                1,
                highest_level + 1,
            ):

                percentage, reason = (
                    escalation_config[level]
                )

                created = record_escalation(
                    db=db,

                    complaint_id=complaint_id,

                    department_id=department_id,

                    level=level,

                    percentage=percentage,

                    reason=(
                        f"{reason} "
                        f"Elapsed: "
                        f"{priority_data['elapsed_percentage']:.2f}%."
                    ),
                )

                if created:
                    escalations_created += 1

        # ----------------------------------------------------
        # Duplicate tickets inherit master's priority
        # ----------------------------------------------------

        db.execute(
            text(
                """
                UPDATE complaints duplicate

                SET priority = master.priority,
                    updated_at = CURRENT_TIMESTAMP

                FROM complaints master

                WHERE duplicate.master_complaint_id
                    = master.id

                  AND duplicate.category_id
                    = :category_id

                  AND duplicate.status NOT IN (
                      'verified',
                      'closed',
                      'rejected'
                  )
                """
            ),
            {
                "category_id": category_id,
            },
        )

    # ========================================================
    # COMMIT
    # ========================================================

    db.commit()

    return {
        "processed_complaints": processed,
        "new_escalations": escalations_created,
    }


# ============================================================
# SLA ENGINE
# ============================================================

def _get_sla_escalation_level(
    *,
    elapsed_percentage: float,
    warning_percentage: int,
    supervisor_percentage: int,
    overdue_percentage: int,
    critical_backlog_percentage: int,
) -> int:
    """
    Determine the highest SLA escalation level reached.

    Level 0:
        Normal

    Level 1:
        Warning

    Level 2:
        Supervisor threshold

    Level 3:
        Overdue

    Level 4:
        Critical backlog
    """

    if (
        elapsed_percentage
        >= critical_backlog_percentage
    ):
        return 4

    if (
        elapsed_percentage
        >= overdue_percentage
    ):
        return 3

    if (
        elapsed_percentage
        >= supervisor_percentage
    ):
        return 2

    if (
        elapsed_percentage
        >= warning_percentage
    ):
        return 1

    return 0


# ============================================================
# ESCALATION TARGET
# ============================================================

def get_escalation_target(
    *,
    db: Session,
    complaint_id: int,
    department_id: int | None,
    level: int,
) -> int | None:
    """
    Find the employee who should receive the escalation.

    Level 1 -> assigned officer
    Level 2 -> supervisor
    Level 3 -> supervisor
    Level 4 -> department head
    """

    # --------------------------------------------------------
    # LEVEL 1 -> ASSIGNED OFFICER
    # --------------------------------------------------------

    if level == 1:

        officer_id = db.execute(
            text(
                """
                SELECT ca.officer_id

                FROM complaint_assignments ca

                JOIN employees e
                    ON e.id = ca.officer_id

                WHERE ca.complaint_id = :complaint_id

                  AND ca.unassigned_at IS NULL

                  AND e.is_active = TRUE

                ORDER BY ca.assigned_at DESC

                LIMIT 1
                """
            ),
            {
                "complaint_id": complaint_id,
            },
        ).scalar_one_or_none()

        if officer_id is None:
            return None

        return int(officer_id)

    # --------------------------------------------------------
    # LEVEL 2 / 3 -> SUPERVISOR
    # --------------------------------------------------------

    if level in (2, 3):

        if department_id is None:
            return None

        supervisor_id = db.execute(
            text(
                """
                SELECT e.id

                FROM employees e

                JOIN employee_roles er
                    ON er.employee_id = e.id

                JOIN roles r
                    ON r.id = er.role_id

                WHERE e.department_id = :department_id

                  AND e.is_active = TRUE

                  AND r.name = 'supervisor'

                ORDER BY e.id

                LIMIT 1
                """
            ),
            {
                "department_id": department_id,
            },
        ).scalar_one_or_none()

        if supervisor_id is None:
            return None

        return int(supervisor_id)

    # --------------------------------------------------------
    # LEVEL 4 -> DEPARTMENT HEAD
    # --------------------------------------------------------

    if level == 4:

        if department_id is None:
            return None

        department_head_id = db.execute(
            text(
                """
                SELECT e.id

                FROM employees e

                JOIN employee_roles er
                    ON er.employee_id = e.id

                JOIN roles r
                    ON r.id = er.role_id

                WHERE e.department_id = :department_id

                  AND e.is_active = TRUE

                  AND r.name = 'department_head'

                ORDER BY e.id

                LIMIT 1
                """
            ),
            {
                "department_id": department_id,
            },
        ).scalar_one_or_none()

        if department_head_id is None:
            return None

        return int(department_head_id)

    return None


# ============================================================
# RECORD ESCALATION
# ============================================================

def record_escalation(
    *,
    db: Session,
    complaint_id: int,
    department_id: int | None,
    level: int,
    percentage: int,
    reason: str,
) -> bool:
    """
    Record one SLA escalation.

    Existing schema has:

        UNIQUE (complaint_id, escalation_level)

    Therefore the same escalation cannot be inserted twice.
    """

    target_id = get_escalation_target(
        db=db,
        complaint_id=complaint_id,
        department_id=department_id,
        level=level,
    )

    inserted_id = db.execute(
        text(
            """
            INSERT INTO complaint_escalations (
                complaint_id,
                escalation_level,
                escalation_percentage,
                escalated_to,
                reason,
                escalated_at
            )

            VALUES (
                :complaint_id,
                :level,
                :percentage,
                :target_id,
                :reason,
                CURRENT_TIMESTAMP
            )

            ON CONFLICT (
                complaint_id,
                escalation_level
            )

            DO NOTHING

            RETURNING id
            """
        ),
        {
            "complaint_id": complaint_id,
            "level": level,
            "percentage": percentage,
            "target_id": target_id,
            "reason": reason,
        },
    ).scalar_one_or_none()

    return inserted_id is not None


# ============================================================
# RUN SLA ENGINE
# ============================================================

def run_sla_engine(
    db: Session,
) -> dict:
    """
    Run the complete SLA processing cycle.

    This should be called periodically, ideally every hour.

    Responsibilities:

    1. Refresh category clusters.
    2. Recalculate priority of every open master complaint.
    3. Calculate elapsed SLA percentage.
    4. Detect warning / supervisor / overdue /
       critical-backlog thresholds.
    5. Create escalation records.
    6. Keep duplicate complaints synchronized
       with their master complaint priority.
    """

    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)

    # ========================================================
    # FIND CATEGORIES WITH OPEN MASTER COMPLAINTS
    # ========================================================

    category_ids = db.execute(
        text(
            """
            SELECT DISTINCT c.category_id

            FROM complaints c

            WHERE c.master_complaint_id IS NULL

              AND c.status NOT IN (
                  'verified',
                  'closed',
                  'rejected'
              )

            ORDER BY c.category_id
            """
        )
    ).scalars().all()

    processed_complaints = 0
    warning_complaints = 0
    overdue_complaints = 0
    critical_backlog_complaints = 0
    escalations_created = 0

    # ========================================================
    # PROCESS CATEGORY BY CATEGORY
    # ========================================================

    for raw_category_id in category_ids:

        category_id = int(
            raw_category_id
        )

        # ----------------------------------------------------
        # REFRESH CLUSTERS
        # ----------------------------------------------------

        cluster_sizes = (
            refresh_category_clusters(
                db=db,
                category_id=category_id,
            )
        )

        # ----------------------------------------------------
        # GET SLA CONFIGURATION
        # ----------------------------------------------------

        sla = db.execute(
            text(
                """
                SELECT
                    target_hours,
                    warning_percentage,
                    supervisor_percentage,
                    overdue_percentage,
                    critical_backlog_percentage

                FROM complaint_sla

                WHERE category_id = :category_id
                """
            ),
            {
                "category_id": category_id,
            },
        ).mappings().one_or_none()

        # No SLA configuration means this category cannot
        # participate in SLA escalation.
        if sla is None:
            continue

        target_hours = int(
            sla["target_hours"]
        )

        warning_percentage = int(
            sla["warning_percentage"]
        )

        supervisor_percentage = int(
            sla["supervisor_percentage"]
        )

        overdue_percentage = int(
            sla["overdue_percentage"]
        )

        critical_backlog_percentage = int(
            sla["critical_backlog_percentage"]
        )

        # ----------------------------------------------------
        # GET OPEN MASTER COMPLAINTS
        # ----------------------------------------------------

        complaints = db.execute(
            text(
                """
                SELECT

                    c.id,

                    c.department_id,

                    c.created_at,

                    cc.code AS category_code,

                    cc.is_emergency

                FROM complaints c

                JOIN complaint_categories cc
                    ON cc.id = c.category_id

                WHERE c.category_id = :category_id

                  AND c.master_complaint_id IS NULL

                  AND c.status NOT IN (
                      'verified',
                      'closed',
                      'rejected'
                  )

                ORDER BY c.created_at ASC
                """
            ),
            {
                "category_id": category_id,
            },
        ).mappings().all()

        # ====================================================
        # PROCESS EVERY OPEN COMPLAINT
        # ====================================================

        for complaint in complaints:

            complaint_id = int(
                complaint["id"]
            )

            department_id = (
                int(complaint["department_id"])
                if complaint["department_id"] is not None
                else None
            )

            cluster_size = cluster_sizes.get(
                complaint_id,
                1,
            )

            # ------------------------------------------------
            # CALCULATE PRIORITY
            # ------------------------------------------------

            priority_data = calculate_priority(
                category_code=(
                    complaint["category_code"]
                ),

                cluster_size=cluster_size,

                created_at=(
                    complaint["created_at"]
                ),

                target_hours=target_hours,

                is_emergency=bool(
                    complaint["is_emergency"]
                ),

                now=now,
            )

            # ------------------------------------------------
            # UPDATE PRIORITY
            # ------------------------------------------------

            db.execute(
                text(
                    """
                    UPDATE complaints

                    SET priority = :priority,
                        updated_at = CURRENT_TIMESTAMP

                    WHERE id = :complaint_id
                    """
                ),
                {
                    "priority": (
                        priority_data["priority"]
                    ),

                    "complaint_id": complaint_id,
                },
            )

            processed_complaints += 1

            elapsed_percentage = float(
                priority_data[
                    "elapsed_percentage"
                ]
            )

            # ------------------------------------------------
            # GET SLA LEVEL
            # ------------------------------------------------

            highest_level = (
                _get_sla_escalation_level(
                    elapsed_percentage=(
                        elapsed_percentage
                    ),

                    warning_percentage=(
                        warning_percentage
                    ),

                    supervisor_percentage=(
                        supervisor_percentage
                    ),

                    overdue_percentage=(
                        overdue_percentage
                    ),

                    critical_backlog_percentage=(
                        critical_backlog_percentage
                    ),
                )
            )

            # ------------------------------------------------
            # STATISTICS
            # ------------------------------------------------

            if highest_level >= 1:
                warning_complaints += 1

            if highest_level >= 3:
                overdue_complaints += 1

            if highest_level >= 4:
                critical_backlog_complaints += 1

            # ------------------------------------------------
            # NO ESCALATION YET
            # ------------------------------------------------

            if highest_level == 0:
                continue

            # ------------------------------------------------
            # ESCALATION DEFINITIONS
            # ------------------------------------------------

            escalation_config = {
                1: (
                    warning_percentage,

                    "SLA warning threshold reached.",
                ),

                2: (
                    supervisor_percentage,

                    "SLA supervisor threshold reached.",
                ),

                3: (
                    overdue_percentage,

                    "Complaint is overdue.",
                ),

                4: (
                    critical_backlog_percentage,

                    "Complaint reached critical backlog threshold.",
                ),
            }

            # ------------------------------------------------
            # CREATE ALL REACHED ESCALATIONS
            # ------------------------------------------------
            #
            # Example:
            #
            # If scheduler was down for 4 hours and a complaint
            # jumps from 40% directly to 85%, both level 1 and
            # level 2 records are created.
            # ------------------------------------------------

            for level in range(
                1,
                highest_level + 1,
            ):

                percentage, reason = (
                    escalation_config[level]
                )

                created = record_escalation(
                    db=db,

                    complaint_id=complaint_id,

                    department_id=department_id,

                    level=level,

                    percentage=percentage,

                    reason=(
                        f"{reason} "
                        f"Elapsed SLA: "
                        f"{elapsed_percentage:.2f}%."
                    ),
                )

                if created:
                    escalations_created += 1

    # ========================================================
    # DUPLICATES FOLLOW MASTER PRIORITY
    # ========================================================

    db.execute(
        text(
            """
            UPDATE complaints duplicate

            SET priority = master.priority,
                updated_at = CURRENT_TIMESTAMP

            FROM complaints master

            WHERE duplicate.master_complaint_id
                = master.id

              AND duplicate.status NOT IN (
                  'verified',
                  'closed',
                  'rejected'
              )
            """
        )
    )

    # ========================================================
    # COMMIT
    # ========================================================

    db.commit()

    return {
        "success": True,

        "processed_complaints": (
            processed_complaints
        ),

        "warning_complaints": (
            warning_complaints
        ),

        "overdue_complaints": (
            overdue_complaints
        ),

        "critical_backlog_complaints": (
            critical_backlog_complaints
        ),

        "new_escalations": (
            escalations_created
        ),

        "run_at": now.isoformat(),
    }