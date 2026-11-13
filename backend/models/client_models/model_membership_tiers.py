
from models.database import db_connection

TABLE = "MembershipTiers"
PRIMARY_KEY = "membership_tier_id"

def get_membership_tier(tier_id):
    with db_connection() as conn:
        row = conn.execute(
            """
            SELECT *
            FROM MembershipTiers
            WHERE membership_tier_id = ?
            """,
            (tier_id,)
        ).fetchone()

        return dict(row) if row else None

def get_membership_tier_by_points(points):
    with db_connection() as conn:
        row = conn.execute(
            """
            SELECT *
            FROM MembershipTiers
            WHERE membership_tier_min_points <= ?
            ORDER BY membership_tier_min_points DESC
            LIMIT 1
            """,
            (points,)
        ).fetchone()

        return dict(row) if row else None

def get_all_membership_tiers():
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM MembershipTiers
            ORDER BY membership_tier_min_points
            """
        ).fetchall()

        return [dict(row) for row in rows]
