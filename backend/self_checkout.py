from models.database import get_connection


class SelfCheckout:
    def scan_products(self, scanned_epcs):
        if not scanned_epcs:
            return None

        unique_epcs = list(dict.fromkeys(
            epc.strip().lower()
            for epc in scanned_epcs
            if isinstance(epc, str) and epc.strip()
        ))

        if not unique_epcs:
            return None

        with get_connection() as conn:
            placeholders = ', '.join(['?'] * len(unique_epcs))

            rows = conn.execute(
                f'''
                SELECT
                    p.product_id,
                    p.product_name,
                    p.product_category,
                    p.product_price,
                    p.product_producer_company,
                    pt.product_tag_epc
                FROM Products AS p
                JOIN ProductTags AS pt
                    ON pt.product_id = p.product_id
                WHERE LOWER(pt.product_tag_epc) IN ({placeholders})
                    AND pt.purchase_item_id IS NULL
                    AND p.product_active = 1
                ''',
                unique_epcs
            ).fetchall()

        scanned_products = [dict(row) for row in rows]
        subtotal = sum(product['product_price'] for product in scanned_products)
        gst = round(subtotal * 0.05)
        qst = round(subtotal * 0.09975)

        return {
            "items": scanned_products,
            "subtotal": subtotal,
            "gst": gst,
            "qst": qst,
            "total": subtotal + gst + qst,
            "item_count": len(scanned_products)
        }

    def complete_purchase(self, scanned_products, customer_id=None):
        if not scanned_products:
            return False

        product_epcs = list(dict.fromkeys(
            epc.strip().lower()
            for product in scanned_products
            for epc in (
                product.get('product_epcs', [])
                if product.get('product_epcs')
                else [product['product_tag_epc']]
                if product.get('product_tag_epc')
                else []
            )
            if isinstance(epc, str) and epc.strip()
        ))

        if not product_epcs:
            return False

        with get_connection() as conn:
            conn.execute("BEGIN IMMEDIATE")

            if customer_id is not None:
                customer = conn.execute(
                    '''
                    SELECT customer_id
                    FROM Customers
                    WHERE customer_id = ?
                    ''',
                    (customer_id,)
                ).fetchone()

                if customer is None:
                    return False

            placeholders = ', '.join(['?'] * len(product_epcs))

            rows = conn.execute(
                f'''
                SELECT
                    p.product_id,
                    p.product_name,
                    p.product_price,
                    pt.product_tag_epc
                FROM Products AS p
                JOIN ProductTags AS pt
                    ON pt.product_id = p.product_id
                WHERE LOWER(pt.product_tag_epc) IN ({placeholders})
                    AND pt.purchase_item_id IS NULL
                    AND p.product_active = 1
                ''',
                product_epcs
            ).fetchall()

            if len(rows) != len(product_epcs):
                return False

            products_by_id = {}

            for row in rows:
                product = dict(row)
                product_id = product['product_id']

                if product_id not in products_by_id:
                    products_by_id[product_id] = {
                        "product_id": product_id,
                        "product_name": product['product_name'],
                        "product_price": product['product_price'],
                        "product_epcs": []
                    }

                products_by_id[product_id]['product_epcs'].append(
                    product['product_tag_epc']
                )

            subtotal = sum(
                product['product_price'] * len(product['product_epcs'])
                for product in products_by_id.values()
            )
            gst = round(subtotal * 0.05)
            qst = round(subtotal * 0.09975)
            total = subtotal + gst + qst

            purchase_id = conn.execute(
                '''
                INSERT INTO Purchases (
                    customer_id,
                    purchase_total,
                    purchase_payment_status
                )
                VALUES (?, ?, 'paid')
                ''',
                (customer_id, total)
            ).lastrowid

            for product in products_by_id.values():
                quantity = len(product['product_epcs'])

                purchase_item_id = conn.execute(
                    '''
                    INSERT INTO PurchaseItems (
                        purchase_id,
                        product_id,
                        purchase_item_name,
                        purchase_item_quantity,
                        purchase_item_unit_price
                    )
                    VALUES (?, ?, ?, ?, ?)
                    ''',
                    (
                        purchase_id,
                        product['product_id'],
                        product['product_name'],
                        quantity,
                        product['product_price']
                    )
                ).lastrowid

                tag_placeholders = ', '.join(['?'] * quantity)

                updated = conn.execute(
                    f'''
                    UPDATE ProductTags
                    SET purchase_item_id = ?
                    WHERE product_id = ?
                        AND LOWER(product_tag_epc) IN ({tag_placeholders})
                        AND purchase_item_id IS NULL
                    ''',
                    (
                        purchase_item_id,
                        product['product_id'],
                        *product['product_epcs']
                    )
                ).rowcount

                if updated != quantity:
                    raise ValueError("Could not assign all scanned RFID tags.")

            receipt = conn.execute(
                '''
                SELECT *
                FROM PurchaseReceipts
                WHERE purchase_id = ?
                ''',
                (purchase_id,)
            ).fetchone()

            if receipt is None:
                raise ValueError("Purchase was saved, but its receipt could not be retrieved.")

            return {
                **dict(receipt),
                "subtotal": subtotal,
                "gst": gst,
                "qst": qst,
                "total": total
            }