import smtplib
from email.message import EmailMessage
from services.email_credentials import our_email, app_password


# Email the purchased items, total, points and date to the customer.
def send_receipt_email(customer_email, receipt):
    lines = [
        "Thank you for shopping at Smart TCG!",
        f"Receipt: {receipt['receipt_number']}",
        f"Date: {receipt['receipt_created_at']}",
        "",
        "Purchased items:"
    ]

    for item in receipt["items"]:
        quantity = item["session_item_quantity"]
        price = item["product_price"]

        lines.append(
            f"{item['product_name']} - "
            f"{quantity} x ${price:.2f} = ${quantity * price:.2f}"
        )

    lines.extend([
        "",
        f"Total: ${receipt['total']:.2f}",
        f"Points earned: {receipt['points_earned']}"
    ])

    message = EmailMessage()
    message["Subject"] = f"Your receipt - {receipt['receipt_number']}"
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