from models.database import db_connection, fetch_all, fetch_by_id, insert_record, delete_record

TABLE = "ProductTagSales"
PRIMARY_KEY = "product_tag_sale_id"

def get_all_product_tag_sales():
    return fetch_all(TABLE, PRIMARY_KEY)

def get_product_tag_sale(sale_id):
    return fetch_by_id(TABLE, PRIMARY_KEY, sale_id)

def get_sales_by_purchase_item(purchase_item_id):
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT * FROM ProductTagSales
            WHERE purchase_item_id = ?
            ORDER BY product_tag_sale_id
            """,
            (purchase_item_id,)
        ).fetchall()

        return [dict(row) for row in rows]

def add_product_tag_sale(product_tag_id, purchase_item_id):
    return insert_record(TABLE, {
        "product_tag_id": product_tag_id,
        "purchase_item_id": purchase_item_id
    })

def delete_product_tag_sale(sale_id):
    return delete_record(TABLE, PRIMARY_KEY, sale_id)