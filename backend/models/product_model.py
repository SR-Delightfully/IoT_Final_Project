from models.database import get_connection


#Reads product details from products and returns a list I can send as JSON

def get_all_products():
    conn = get_connection()

    try:
        rows = conn.execute("""
            SELECT
                p.*,
                i.quantity_in_stock
            FROM Products AS p
            JOIN Inventory AS i
                ON p.product_id = i.product_id
            WHERE p.product_active = 1
            ORDER BY p.product_id
        """).fetchall()

        return [dict(row) for row in rows]
    finally:
        conn.close()
#Adding a product, using placeholders for safety, conn saves on success 
def add_product(
    name,
    category,
    price_cents,
    upc,
    company,
    image_url=None
):
    conn = get_connection()

    try:
        with conn:
            cursor = conn.execute("""
                INSERT INTO Products (
                    product_name,
                    product_category,
                    product_price,
                    product_upc,
                    product_producer_company,
                    product_image_url
                )
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                name,
                category,
                price_cents,
                upc,
                company,
                image_url
            ))

            return cursor.lastrowid
    finally:
        conn.close()
        #Update the product, using its product ID, T/F
def update_product(
    product_id,
    name,
    category,
    price_cents,
    upc,
    company
):
    conn = get_connection()

    try:
        with conn:
            cursor = conn.execute("""
                UPDATE Products
                SET product_name = ?,
                    product_category = ?,
                    product_price = ?,
                    product_upc = ?,
                    product_producer_company = ?
                WHERE product_id = ?
            """, (
                name,
                category,
                price_cents,
                upc,
                company,
                product_id
            ))

            return cursor.rowcount > 0
    finally:
        conn.close()

        #Delete by ID
def delete_product(product_id):
    conn = get_connection()

    try:
        with conn:
            cursor = conn.execute("""
                UPDATE Products
                SET product_active = 0
                WHERE product_id = ?
                  AND product_active = 1
            """, (product_id,))

            return cursor.rowcount > 0
    finally:
        conn.close()