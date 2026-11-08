from models.database import fetch_all, fetch_by_id, insert_record, update_record, delete_record, db_connection

TABLE = "BarCodes"
PRIMARY_KEY = "barcode_id"

def get_all_barcodes():
    return fetch_all(TABLE, PRIMARY_KEY)

def get_barcode(barcode_id):
    return fetch_by_id(TABLE, PRIMARY_KEY, barcode_id)

def get_barcode_by_value(barcode_value):
    with db_connection() as conn:
        row = conn.execute(
            "SELECT * FROM BarCodes WHERE barcode_value = ?",
            (barcode_value,)
        ).fetchone()

        return dict(row) if row else None

def get_barcodes_by_product(product_id):
    with db_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM BarCodes WHERE product_id = ?",
            (product_id,)
        ).fetchall()

        return [dict(row) for row in rows]

def add_barcode(product_id, barcode_value):
    return insert_record(TABLE, {
        "product_id": product_id,
        "barcode_value": barcode_value
    })

def update_barcode(barcode_id, values):
    return update_record(TABLE, PRIMARY_KEY, barcode_id, values)

def delete_barcode(barcode_id):
    return delete_record(TABLE, PRIMARY_KEY, barcode_id)