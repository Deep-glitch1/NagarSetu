"""
NagarSetu complaint priority calculation.

Priority is dynamically calculated from:

1. Category severity
2. Independent citizen cluster size
3. Elapsed time relative to the category SLA

The SLA state itself is calculated separately:
- 50%  -> warning
- 80%  -> supervisor
- 100% -> overdue
- 300% -> critical backlog
"""

from datetime import datetime, timezone


# ============================================================
# CONFIGURATION
# ============================================================

CATEGORY_SEVERITY = {
    "ROAD_DAMAGED": 80,
    "POTHOLE": 80,
    "STREET_LIGHT": 70,
    "GARBAGE": 60,
    "OTHER": 40,
}

CATEGORY_WEIGHT = 0.25
CLUSTER_WEIGHT = 0.35
TIME_WEIGHT = 0.40


# Priority score thresholds
LOW_MAX = 24
MEDIUM_MAX = 49
HIGH_MAX = 74


# ============================================================
# CATEGORY SCORE
# ============================================================

def get_category_severity(
    category_code: str,
    is_emergency: bool = False,
) -> float:
    """
    Return category severity on a 0-100 scale.

    Emergency categories immediately receive maximum
    category severity.
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
    Convert independent complaint count into a 0-100 score.

    1 complaint  -> 0
    2 complaints -> 20
    3 complaints -> 40
    4 complaints -> 60
    5 complaints -> 80
    6+           -> 100

    Duplicate complaints are not included in this count.
    """

    if cluster_size is None:
        cluster_size = 1

    cluster_size = max(
        1,
        int(cluster_size),
    )

    score = (
        (cluster_size - 1)
        * 20
    )

    return float(
        min(
            100,
            score,
        )
    )


# ============================================================
# TIME / SLA SCORE
# ============================================================

def get_time_score(
    created_at: datetime,
    target_hours: int,
    now: datetime | None = None,
) -> tuple[float, float, float]:
    """
    Return:

    (
        time_score,
        elapsed_hours,
        elapsed_percentage
    )

    Time score reaches 100 at 300% of the SLA target.

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

    # 100 score at 300% SLA.
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
    Determine the current SLA state.
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
    cluster_size: int | None,
    created_at: datetime,
    target_hours: int,
    is_emergency: bool = False,
    now: datetime | None = None,
) -> dict:
    """
    Calculate complete dynamic priority information.

    Weighted score:

        category severity : 25%
        cluster pressure  : 35%
        SLA/time pressure : 40%

    Returns score, label and SLA information.
    """

    category_score = get_category_severity(
        category_code=category_code,
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

    # Emergency category is always critical.
    if is_emergency:
        final_score = 100.0
        priority = "critical"

    else:
        final_score = (
            category_score * CATEGORY_WEIGHT
            + cluster_score * CLUSTER_WEIGHT
            + time_score * TIME_WEIGHT
        )

        if final_score <= LOW_MAX:
            priority = "low"

        elif final_score <= MEDIUM_MAX:
            priority = "medium"

        elif final_score <= HIGH_MAX:
            priority = "high"

        else:
            priority = "critical"

    sla_state = get_sla_state(
        elapsed_percentage
    )

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

        "cluster_size": (
            int(cluster_size)
            if cluster_size is not None
            else 1
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

        "target_hours": target_hours,
    }