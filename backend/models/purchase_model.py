from models.database import get_connection


def get_customer_purchases(customer_id):
    conn = get_connection()

    try:
        rows = conn.execute("""
            SELECT
                purchase_id,
                receipt_number,
                purchase_total,
                purchase_points_earned,
                purchase_created_at
            FROM PurchaseReceipts
            WHERE customer_id = ?
              AND purchase_payment_status = 'paid'
            ORDER BY purchase_created_at DESC, purchase_id DESC
        """, (customer_id,)).fetchall()

        return [dict(row) for row in rows]
    finally:
        conn.close()

        #
def get_customer_receipt(customer_id, purchase_id):
    conn = get_connection()

    try:
        receipt = conn.execute("""
            SELECT *
            FROM PurchaseReceipts
            WHERE customer_id IS ?
              AND purchase_id = ?
              AND purchase_payment_status = 'paid'
        """, (customer_id, purchase_id)).fetchone()

        if receipt is None:
            return None

        items = conn.execute("""
            SELECT
                product_id,
                purchase_item_name,
                purchase_item_quantity,
                purchase_item_unit_price,
                purchase_item_quantity * purchase_item_unit_price
                    AS line_total
            FROM PurchaseItems
            WHERE purchase_id = ?
            ORDER BY purchase_item_id
        """, (purchase_id,)).fetchall()

        data = dict(receipt)
        data["items"] = [dict(item) for item in items]

        return data
    finally:
        conn.close()
        #Identify the customer, read the list of scanned items, 
def complete_purchase(customer_id, epcs):
    if not isinstance(epcs, list) or not epcs:
        raise ValueError("Scan at least one item")

    for epc in epcs:
        if not isinstance(epc, str) or not epc.strip():
            raise ValueError("Invalid RFID tag")
    epcs = list(dict.fromkeys(epc.strip().upper() for epc in epcs))
    #Group the scanned tags by product
    conn = get_connection()

    try:
        with conn:
            conn.execute("BEGIN IMMEDIATE")
            products = {}



        #Looks up the EPC in ProductTags, joins info from products, stock from inventory, requires an unsold tag, and an active product
            for epc in epcs:
                item = conn.execute("""
                    SELECT
                        t.product_tag_id,
                        p.product_id,
                        p.product_name,
                        p.product_price,
                        i.quantity_in_stock
                    FROM ProductTags AS t
                    JOIN Products AS p ON p.product_id = t.product_id
                    JOIN Inventory AS i ON i.product_id = p.product_id
                    WHERE UPPER(t.product_tag_epc) = ?
                      AND t.purchase_item_id IS NULL
                      AND p.product_active = 1
                """, (epc,)).fetchone()

                if item is None:
                    raise ValueError(
                        f"Tag unavailable or already sold: {epc}"
                    )

                product_id = item["product_id"]

                if product_id not in products:
                    products[product_id] = dict(item)
                    products[product_id]["tag_ids"] = []

                products[product_id]["tag_ids"].append(
                    item["product_tag_id"]
                )  

                #product cost to total, goes through each grouped product.
            total = 0

            for product in products.values():
                quantity = len(product["tag_ids"])

                if quantity > product["quantity_in_stock"]:
                    raise ValueError(
                        f"Not enough stock: {product['product_name']}"
                    )

                total += product["product_price"] * quantity

            points = 0

            if customer_id is not None:
                points = total // 100

            #cust_id, or none for a guest, price in cents, points earned, payment status
            cursor = conn.execute("""
                INSERT INTO Purchases (
                    customer_id,
                    purchase_total,
                    purchase_points_earned,
                    purchase_payment_status
                )
                VALUES (?, ?, ?, 'paid')
            """, (
                customer_id,
                total,
                points
            ))

            purchase_id = cursor.lastrowid
            #
            for product in products.values():
                cursor = conn.execute("""
                    INSERT INTO PurchaseItems (
                        purchase_id,
                        product_id,
                        purchase_item_name,
                        purchase_item_quantity,
                        purchase_item_unit_price
                    )
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    purchase_id,
                    product["product_id"],
                    product["product_name"],
                    len(product["tag_ids"]),
                    product["product_price"]
                ))

                purchase_item_id = cursor.lastrowid

                for tag_id in product["tag_ids"]:
                    conn.execute("""
                        UPDATE ProductTags
                        SET purchase_item_id = ?
                        WHERE product_tag_id = ?
                    """, (purchase_item_id, tag_id))
                            # Add points once for the whole purchase.
            if customer_id is not None:
                conn.execute("""
                    UPDATE Customers
                    SET customer_loyalty_points =
                        customer_loyalty_points + ?
                    WHERE customer_id = ?
                """, (points, customer_id))

        return purchase_id
    finally:
        conn.close()