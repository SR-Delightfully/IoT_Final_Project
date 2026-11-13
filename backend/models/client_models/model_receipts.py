from models.database import db_connection, fetch_all, fetch_by_id, insert_record, update_record, delete_record
from models.checkout_models.model_purchase_items import get_items_by_purchase

TABLE = "Receipts"
PRIMARY_KEY = "receipt_id"

def get_all_receipts():
    return fetch_all(TABLE, PRIMARY_KEY)

def get_receipt(receipt_id):
    return fetch_by_id(TABLE, PRIMARY_KEY, receipt_id)

def get_receipt_by_purchase(purchase_id):
    with db_connection() as conn:
        row = conn.execute(
            "SELECT * FROM Receipts WHERE purchase_id = ?",
            (purchase_id,)
        ).fetchone()

        return dict(row) if row else None

def add_receipt(purchase_id, receipt_number):
    return insert_record(TABLE, {
        "purchase_id": purchase_id,
        "receipt_number": receipt_number
    })

def update_receipt(receipt_id, values):
    return update_record(TABLE, PRIMARY_KEY, receipt_id, values)

def delete_receipt(receipt_id):
    return delete_record(TABLE, PRIMARY_KEY, receipt_id)

# Return a completed purchase's receipt only if it belongs to this customer.
def get_customer_receipt(customer_id, purchase_id):
    with db_connection() as conn:
        receipt = conn.execute(
            # Include points earned from this purchase's loyalty records.
            """
            SELECT p.*, r.receipt_id, r.receipt_number,
                   r.receipt_created_at,
                   COALESCE((
                       SELECT SUM(lt.loyalty_points_change)
                       FROM LoyaltyTransactions lt
                       WHERE lt.purchase_id = p.purchase_id
                         AND lt.loyalty_transaction_type = 'EARN'
                   ), 0) AS points_earned
            FROM Purchases p
            JOIN Receipts r ON p.purchase_id = r.purchase_id
            WHERE p.customer_id = ?
              AND p.purchase_id = ?
              AND p.purchase_status = 'COMPLETED'
            """,
            (customer_id, purchase_id)
        ).fetchone()

    if receipt is None:
        return None

    data = dict(receipt)
    data["items"] = get_items_by_purchase(purchase_id)

    return data