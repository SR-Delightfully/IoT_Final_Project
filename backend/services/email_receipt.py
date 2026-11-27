import smtplib
from email.message import EmailMessage
from services.email_credentials import our_email, app_password


# Receipt text in English and French (the language picked at the self-checkout).
TEXT = {
    "en": {
        "thanks": "Thank you for shopping at Smart TCG!",
        "receipt": "Receipt",
        "date": "Date",
        "items": "Purchased items:",
        "summary": "Payment summary (CAD):",
        "subtotal": "Subtotal",
        "gst": "GST (5%)",
        "qst": "QST (9.975%)",
        "discount": "Discount",
        "method": "Payment method",
        "points": "Points earned",
        "balance": "Current points balance",
        "subject": "Your receipt",
        "methods": {"card": "Card", "cash": "Cash", "mobile": "Mobile"},
    },
    "fr": {
        "thanks": "Merci d'avoir magasiné chez Smart TCG!",
        "receipt": "Reçu",
        "date": "Date",
        "items": "Articles achetés :",
        "summary": "Résumé du paiement (CAD) :",
        "subtotal": "Sous-total",
        "gst": "TPS (5 %)",
        "qst": "TVQ (9,975 %)",
        "discount": "Rabais",
        "method": "Mode de paiement",
        "points": "Points obtenus",
        "balance": "Solde de points actuel",
        "subject": "Votre reçu",
        "methods": {"card": "Carte", "cash": "Comptant", "mobile": "Mobile"},
    },
}


def money(amount, language):
    text = f"{amount:.2f}"
    return f"{text.replace('.', ',')} $" if language == "fr" else f"${text}"


# Email the purchased items, total, points and date to the customer.
def send_receipt_email(customer_email, receipt, language="en"):
    words = TEXT.get(language, TEXT["en"])
    lines = [
        words["thanks"],
        f"{words['receipt']}: {receipt['receipt_number']}",
        f"{words['date']}: {receipt['receipt_created_at']}",
        "",
        words["items"],
    ]

    for item in receipt["items"]:
        quantity = item["session_item_quantity"]
        price = item["product_price"]

        lines.append(
            f"{item['product_name']} - "
            f"{quantity} x {money(price, language)} = {money(quantity * price, language)}"
        )

    method = receipt["payment_method"]
    lines.extend([
        "",
        words["summary"],
        f"{words['subtotal']}: {money(receipt['subtotal'], language)}",
        f"{words['gst']}: {money(receipt['gst'], language)}",
        f"{words['qst']}: {money(receipt['qst'], language)}",
        f"{words['discount']}: -{money(receipt['discount'], language)}",
        f"{words['method']}: {words['methods'].get(method, method.capitalize())}",
        "",
        f"{words['points']}: {receipt['points_earned']}",
        f"{words['balance']}: {receipt['loyalty_points_balance']}"
    ])

    message = EmailMessage()
    message["Subject"] = f"{words['subject']} - {receipt['receipt_number']}"
    message["From"] = our_email
    message["To"] = customer_email
    message.set_content("\n".join(lines))

    print("[Receipt email] Connecting to Gmail...")
    with smtplib.SMTP("smtp.gmail.com", 587, timeout=10) as smtp:
        print("[Receipt email] Starting secure connection...")
        smtp.starttls()

        print("[Receipt email] Logging in...")
        smtp.login(our_email, app_password)

        print("[Receipt email] Sending message...")
        smtp.send_message(message)

        print("[Receipt email] Gmail accepted the message.")

    print("[Receipt email] Connection closed normally.")
