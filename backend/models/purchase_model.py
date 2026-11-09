from models.customer_model import get_connection


def get_customer_points(customer_id):
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT customer_loyalty_points
            FROM Customers
            WHERE customer_id = ?
            """,
            (customer_id,)
        ).fetchone()

        return row["customer_loyalty_points"] if row else None


def get_customer_purchases(customer_id):
    with get_connection() as conn:
        purchases = conn.execute(
            """
            SELECT
                purchase_id,
                receipt_number,
                purchase_created_at,
                purchase_payment_status,
                purchase_total,
                purchase_points_earned
            FROM PurchaseReceipts
            WHERE customer_id = ?
            ORDER BY purchase_created_at DESC, purchase_id DESC
            """,
            (customer_id,)
        ).fetchall()

        result = []

        for purchase in purchases:
            items = conn.execute(
                """
                SELECT
                    purchase_item_name,
                    purchase_item_quantity,
                    purchase_item_unit_price
                FROM PurchaseItems
                WHERE purchase_id = ?
                ORDER BY purchase_item_id
                """,
                (purchase["purchase_id"],)
            ).fetchall()

            data = dict(purchase)
            data["items"] = [dict(item) for item in items]
            result.append(data)

        return result
