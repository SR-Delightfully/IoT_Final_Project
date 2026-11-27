from models.database import get_connection

#Records what arrived and quantity\




def add_stock_reception(product_id, quantity, note=None):
    conn = get_connection()

    try:
        with conn:
            cursor = conn.execute("""
                INSERT INTO StockReceptions (
                    product_id,
                    reception_quantity_received,
                    reception_note
                )
                VALUES (?, ?, ?)
            """, (
                product_id,
                quantity,
                note
            ))

            return cursor.lastrowid
    finally:
        conn.close()