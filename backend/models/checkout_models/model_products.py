from models.database import db_connection, fetch_by_id, insert_record, update_record, delete_record

TABLE = "Products"
PRIMARY_KEY = "product_id"

def get_all_products():
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT p.*, c.category_name,
                   b.barcode_value
            FROM Products p
            LEFT JOIN Categories c ON p.category_id = c.category_id
            LEFT JOIN BarCodes b ON p.product_id = b.product_id
            ORDER BY p.product_id
            """
        ).fetchall()

        return [dict(row) for row in rows]

def get_product(product_id):
    with db_connection() as conn:
        row = conn.execute(
            """
            SELECT p.*, c.category_name,
                   b.barcode_value
            FROM Products p
            LEFT JOIN Categories c ON p.category_id = c.category_id
            LEFT JOIN BarCodes b ON p.product_id = b.product_id
            WHERE p.product_id = ?
            """,
            (product_id,)
        ).fetchone()

        return dict(row) if row else None

def add_product(category_id, name, description, company, price_cents, stock_quantity, is_active=1):
    return insert_record(TABLE, {
        "category_id": category_id,
        "product_name": name,
        "product_description": description,
        "product_company": company,
        "product_price_cents": price_cents,
        "product_stock_quantity": stock_quantity,
        "product_is_active": is_active
    })

def update_product(product_id, values):
    return update_record(TABLE, PRIMARY_KEY, product_id, values)

def delete_product(product_id):
    return delete_record(TABLE, PRIMARY_KEY, product_id)