"""
NagarSetu spatial complaint clustering.

PostGIS DBSCAN is used to identify geographically dense
complaint hotspots.

Rules:
- Same category is clustered together.
- Only master complaints participate.
- Duplicate complaints are excluded.
- Closed and rejected complaints are excluded.
- Isolated complaints are treated as cluster size 1
  for priority calculation.
"""

from sqlalchemy import text
from sqlalchemy.orm import Session


# ============================================================
# CONFIGURATION
# ============================================================

CLUSTER_RADIUS_METERS = 50
CLUSTER_MIN_POINTS = 2


# ============================================================
# REFRESH CATEGORY CLUSTERS
# ============================================================

def refresh_category_clusters(
    *,
    db: Session,
    category_id: int,
) -> dict[int, int]:
    """
    Rebuild clusters for one complaint category.

    Returns:

        {
            complaint_id: cluster_size
        }

    Every active master complaint is returned.

    Isolated complaints receive size 1.
    """

    # --------------------------------------------------------
    # Delete old clusters
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
    # DBSCAN
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