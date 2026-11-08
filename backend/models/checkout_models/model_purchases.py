from models.database import db_connection, fetch_all, fetch_by_id, insert_record, update_record, delete_record

TABLE = "Purchases"
PRIMARY_KEY = "purchase_id"

def get_all_purchases():
    return fetch_all(TABLE, PRIMARY_KEY)

def get_purchase(purchase_id):
    return fetch_by_id(TABLE, PRIMARY_KEY, purchase_id)

def get_customer_purchases(customer_id):
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT * FROM Purchases
            WHERE customer_id = ?
            ORDER BY purchase_created_at DESC
            """,
            (customer_id,)
        ).fetchall()

        return [dict(row) for row in rows]

def add_purchase(customer_id, session_id, subtotal_cents, gst_cents, qst_cents,
                 discount_cents, total_cents, payment_method, status="COMPLETED"):
    return insert_record(TABLE, {
        "customer_id": customer_id,
        "session_id": session_id,
        "purchase_subtotal_cents": subtotal_cents,
        "purchase_gst_cents": gst_cents,
        "purchase_qst_cents": qst_cents,
        "purchase_discount_cents": discount_cents,
        "purchase_total_cents": total_cents,
        "purchase_payment_method": payment_method,
        "purchase_status": status
    })

def update_purchase(purchase_id, values):
    return update_record(TABLE, PRIMARY_KEY, purchase_id, values)

def delete_purchase(purchase_id):
    return delete_record(TABLE, PRIMARY_KEY, purchase_id)