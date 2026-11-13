from models.database import db_connection, fetch_by_id, insert_record, update_record, delete_record

TABLE = "Products"
PRIMARY_KEY = "product_id"

# Return each product once, using its first registered barcode.
def get_all_products():
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT p.*, c.category_id, c.category_name, c.category_image_url,
                b.barcode_value
            FROM Products p
            LEFT JOIN Categories c ON p.category_id = c.category_id
            LEFT JOIN BarCodes b ON b.barcode_id = (
                SELECT MIN(b2.barcode_id)
                FROM BarCodes b2
                WHERE b2.product_id = p.product_id
            )
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

# Save a product with its category and barcode.
# Save everything together so a failure does not leave an incomplete product.
def add_product_with_barcode(name, category, price, upc, company):
    with db_connection() as conn:
        conn.execute(
            """
            INSERT INTO Categories (category_name)
            VALUES (?)
            ON CONFLICT(category_name) DO NOTHING
            """,
            (category,)
        )

        category_row = conn.execute(
            "SELECT category_id FROM Categories WHERE category_name = ?",
            (category,)
        ).fetchone()

        cursor = conn.execute(
            """
            INSERT INTO Products (
                category_id,
                product_name,
                product_price_cents,
                product_company
            )
            VALUES (?, ?, ?, ?)
            """,
            (category_row["category_id"], name, price, company)
        )

        product_id = cursor.lastrowid

        conn.execute(
            """
            INSERT INTO BarCodes (product_id, barcode_value)
            VALUES (?, ?)
            """,
            (product_id, upc)
        )

        return product_id
# Update the product, category and barcode together.
def update_product_with_barcode(product_id, name, category, price, upc, company):
    with db_connection() as conn:
        product = conn.execute(
            "SELECT product_id FROM Products WHERE product_id = ?",
            (product_id,)
        ).fetchone()

        if product is None:
            return False

        conn.execute(
            """
            INSERT INTO Categories (category_name)
            VALUES (?)
            ON CONFLICT(category_name) DO NOTHING
            """,
            (category,)
        )

        category_row = conn.execute(
            "SELECT category_id FROM Categories WHERE category_name = ?",
            (category,)
        ).fetchone()

        conn.execute(
            """
            UPDATE Products
            SET product_name = ?,
                category_id = ?,
                product_price_cents = ?,
                product_company = ?,
                product_updated_at = CURRENT_TIMESTAMP
            WHERE product_id = ?
            """,
            (name, category_row["category_id"], price, company, product_id)
        )

        barcode = conn.execute(
            """
            SELECT barcode_id FROM BarCodes
            WHERE product_id = ?
            ORDER BY barcode_id
            LIMIT 1
            """,
            (product_id,)
        ).fetchone()

        if barcode:
            conn.execute(
                "UPDATE BarCodes SET barcode_value = ? WHERE barcode_id = ?",
                (upc, barcode["barcode_id"])
            )
        else:
            conn.execute(
                "INSERT INTO BarCodes (product_id, barcode_value) VALUES (?, ?)",
                (product_id, upc)
            )

        return True