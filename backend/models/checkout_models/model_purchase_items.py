from models.database import db_connection, fetch_all, fetch_by_id, insert_record, update_record, delete_record

TABLE = "PurchaseItems"
PRIMARY_KEY = "purchase_item_id"

def get_all_purchase_items():
    return fetch_all(TABLE, PRIMARY_KEY)

def get_purchase_item(purchase_item_id):
    return fetch_by_id(TABLE, PRIMARY_KEY, purchase_item_id)

def get_items_by_purchase(purchase_id):
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT pi.*, p.product_name
            FROM PurchaseItems pi
            JOIN Products p ON pi.product_id = p.product_id
            WHERE pi.purchase_id = ?
            ORDER BY pi.purchase_item_id
            """,
            (purchase_id,)
        ).fetchall()

        return [dict(row) for row in rows]

def add_purchase_item(purchase_id, product_id, quantity, unit_price_cents):
    return insert_record(TABLE, {
        "purchase_id": purchase_id,
        "product_id": product_id,
        "purchase_item_quantity": quantity,
        "purchase_item_unit_price_cents": unit_price_cents
    })

def update_purchase_item(purchase_item_id, values):
    return update_record(TABLE, PRIMARY_KEY, purchase_item_id, values)

def delete_purchase_item(purchase_item_id):
    return delete_record(TABLE, PRIMARY_KEY, purchase_item_id)