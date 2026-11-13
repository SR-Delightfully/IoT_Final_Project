from models.database import db_connection, fetch_all, fetch_by_id, insert_record, update_record, delete_record

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