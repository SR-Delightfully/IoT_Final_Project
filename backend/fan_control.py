from models.alert_model import get_alert
import os
from email.utils import parseaddr


# is alert is eligible for the fan to start ?
def can_turn_on_fan(alert_id, approved):
    if approved is not True:
        return False

    alert = get_alert(alert_id)

    if alert is None:
        return False

    return (
        alert["alert_type"] == "temperature"
        and alert["alert_condition"] == "above"
        and alert["alert_status"] != "resolved"
    )
# Validate the email response before approving the fan
def validate_email_reply(response):
    if not isinstance(response, dict):
        return False

    expected_sender = os.getenv("ALERT_EMAIL")
    actual_sender = parseaddr(response.get("sender") or "")[1]

    if not expected_sender or actual_sender.lower() != expected_sender.lower():
        return False

    return can_turn_on_fan(
        response.get("alert_id"),
        response.get("approved")
    )
# Handle an approved email response
def handle_email_response(response, turn_on_motor):
    if not validate_email_reply(response):
        print("Fan activation denied")
        return False

    turn_on_motor()
    return True