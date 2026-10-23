from imapclient import IMAPClient
import email
from email.header import decode_header
from email_credentials import our_email, app_password
import re
from fan_control import validate_email_reply
from fan_control import handle_email_response

def process_message(server, uid):
    raw = server.fetch([uid], ['RFC822'])[uid][b'RFC822']
    msg = email.message_from_bytes(raw)

    # Decodes
    decoded_subject = decode_header(msg.get('Subject', ''))
    subject_parts = []

    for part, encoding in decoded_subject:
        if isinstance(part, bytes):
            part = part.decode(encoding or 'utf-8', errors='replace')
        subject_parts.append(part)

    subject = ''.join(subject_parts)
    # Get the alert ID from the email subject
    match = re.search(r"Overheating Fridge Alert #(\d+)", subject)

    alert_id = int(match.group(1)) if match else None

    print("Alert ID:", alert_id)
    from_ = msg.get('From')

    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == 'text/plain':
                if 'attachment' not in str(part.get('Content-Disposition', '')).lower():
                    payload = part.get_payload(decode=True)
                    if payload:
                        charset = part.get_content_charset() or 'utf-8'
                        body = payload.decode(charset, errors='replace')
                        break
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or 'utf-8'
            body = payload.decode(charset, errors='replace')
        else:
            body = str(msg.get_payload())

    first_line = next(
    (line.strip() for line in body.splitlines() if line.strip()),"")

    print("First line detected:", repr(first_line))

    # Check if the first line is YES, Yes, or yes
    approved = first_line.casefold() == "yes"
    if approved:
        print("YES received! Fan activation approved.")
    else: 
        print("No valid Yes reply detected.")
        # THIS IS WHERE THE CODE WILL RETURN SOMETHING FOR THE BACKEND TO USE
    return{
        "alert_id": alert_id,
        "approved": approved,
        "sender": from_
    }


def main():
    print("Connecting...")
    with IMAPClient('imap.gmail.com') as server:
        print("Connected. Logging in...")
        server.login(our_email, app_password)
        print("Logged in. Selecting INBOX...")
        server.select_folder('INBOX')

        seen_uids = set(server.search('ALL'))
        print(f"Found {len(seen_uids)} existing emails. Listening for new ones (Ctrl+C to stop)...")

        while True:
            server.idle()
            try:
                responses = server.idle_check(timeout=10)
            finally:
                server.idle_done()

            print(f"[tick] responses = {responses}")

            if responses:
                server.noop()
                current_uids = set(server.search('ALL'))
                new_uids = current_uids - seen_uids
                for uid in sorted(new_uids):
                    response = process_message(server, uid)

                    if validate_email_reply(response):
                        print("TEST ONLY: Motor ON requested")
                    else:
                        print("Fan activiation denied")

                seen_uids = current_uids
                
if __name__ == '__main__':
    main()