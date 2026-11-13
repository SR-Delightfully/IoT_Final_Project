from models.database import db_connection, fetch_all, fetch_by_id, insert_record, update_record, delete_record

TABLE = "ProductTags"
PRIMARY_KEY = "product_tag_id"

def get_all_product_tags():
    return fetch_all(TABLE, PRIMARY_KEY)

def get_product_tag(product_tag_id):
    return fetch_by_id(TABLE, PRIMARY_KEY, product_tag_id)

def get_product_tag_by_epc(epc):
    with db_connection() as conn:
        row = conn.execute(
            "SELECT * FROM ProductTags WHERE product_tag_epc = ?",
            (epc,)
        ).fetchone()

        return dict(row) if row else None

def get_product_tags_by_product(product_id):
    with db_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM ProductTags WHERE product_id = ?",
            (product_id,)
        ).fetchall()

        return [dict(row) for row in rows]

def add_product_tag(product_id, epc, status="ACTIVE"):
    return insert_record(TABLE, {
        "product_id": product_id,
        "product_tag_epc": epc,
        "product_tag_status": status
    })

def update_product_tag(product_tag_id, values):
    return update_record(TABLE, PRIMARY_KEY, product_tag_id, values)

def delete_product_tag(product_tag_id):
    return delete_record(TABLE, PRIMARY_KEY, product_tag_id)