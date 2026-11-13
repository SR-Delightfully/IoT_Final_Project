
from models.database import db_connection

TABLE = "CustomerMemberships"
PRIMARY_KEY = "customer_membership_id"

def add_customer_membership(customer_id):
    with db_connection() as conn:
        cursor = conn.execute(
            """
            INSERT OR IGNORE INTO CustomerMemberships (
                customer_id,
                membership_tier_id,
                customer_membership_points
            )
            SELECT
                C.customer_id,
                MT.membership_tier_id,
                0
            FROM Customers C
            CROSS JOIN MembershipTiers MT
            WHERE C.customer_id = ?
                AND C.customer_is_member = 1
                AND MT.membership_tier_min_points = 0
            """,
            (customer_id,)
        )

        return cursor.rowcount > 0

def get_customer_membership(customer_id):
    with db_connection() as conn:
        row = conn.execute(
            """
            SELECT CM.*, MT.membership_tier_name,
                   MT.membership_tier_min_points
            FROM CustomerMemberships CM
            JOIN MembershipTiers MT
                ON CM.membership_tier_id = MT.membership_tier_id
            WHERE CM.customer_id = ?
            """,
            (customer_id,)
        ).fetchone()

        return dict(row) if row else None

def get_all_customer_memberships():
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT CM.*, MT.membership_tier_name,
                   MT.membership_tier_min_points,
                   C.customer_id
            FROM CustomerMemberships CM
            JOIN MembershipTiers MT
                ON CM.membership_tier_id = MT.membership_tier_id
            JOIN Customers C
                ON CM.customer_id = C.customer_id
            ORDER BY C.customer_id
            """
        ).fetchall()

        return [dict(row) for row in rows]

def add_customer_membership_points(customer_id, points):
    with db_connection() as conn:
        cursor = conn.execute(
            """
            UPDATE CustomerMemberships
            SET customer_membership_points =
                customer_membership_points + ?
            WHERE customer_id = ?
                AND EXISTS (
                    SELECT 1
                    FROM Customers
                    WHERE Customers.customer_id = CustomerMemberships.customer_id
                        AND customer_is_member = 1
                )
            """,
            (points, customer_id)
        )

        if cursor.rowcount == 0:
            return None

        row = conn.execute(
            """
            SELECT CM.*, MT.membership_tier_name,
                   MT.membership_tier_min_points
            FROM CustomerMemberships CM
            JOIN MembershipTiers MT
                ON CM.membership_tier_id = MT.membership_tier_id
            WHERE CM.customer_id = ?
            """,
            (customer_id,)
        ).fetchone()

        return dict(row) if row else None
