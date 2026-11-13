from models.database import db_connection


def get_customer_points(customer_id):
    with db_connection() as conn:
        row = conn.execute(
            """
            SELECT customer_membership_points
            FROM CustomerMemberships
            WHERE customer_id = ?
            """,
            (customer_id,)
        ).fetchone()

        return row["customer_membership_points"] if row else 0


# Purchase history in the shape the account and purchases pages expect
# (totals in cents, status in lowercase, one list of items per purchase).
def get_customer_purchases(customer_id):
    with db_connection() as conn:
        purchases = conn.execute(
            """
            SELECT
                p.purchase_id,
                COALESCE(r.receipt_number, 'P' || p.purchase_id) AS receipt_number,
                p.purchase_created_at,
                CASE p.purchase_status
                    WHEN 'COMPLETED' THEN 'paid'
                    ELSE LOWER(p.purchase_status)
                END AS purchase_payment_status,
                p.purchase_total_cents AS purchase_total,
                COALESCE((
                    SELECT SUM(lt.loyalty_points_change)
                    FROM LoyaltyTransactions lt
                    WHERE lt.purchase_id = p.purchase_id
                      AND lt.loyalty_transaction_type = 'EARN'
                ), 0) AS purchase_points_earned
            FROM Purchases p
            LEFT JOIN Receipts r ON r.purchase_id = p.purchase_id
            WHERE p.customer_id = ?
            ORDER BY p.purchase_created_at DESC, p.purchase_id DESC
            """,
            (customer_id,)
        ).fetchall()

        result = []

        for purchase in purchases:
            items = conn.execute(
                """
                SELECT
                    pr.product_name AS purchase_item_name,
                    pi.purchase_item_quantity,
                    pi.purchase_item_unit_price_cents AS purchase_item_unit_price
                FROM PurchaseItems pi
                JOIN Products pr ON pr.product_id = pi.product_id
                WHERE pi.purchase_id = ?
                ORDER BY pi.purchase_item_id
                """,
                (purchase["purchase_id"],)
            ).fetchall()

            data = dict(purchase)
            data["items"] = [dict(item) for item in items]
            result.append(data)

        return result
