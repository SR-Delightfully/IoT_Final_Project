from models.management_models import model_notifications as model
from controllers.controller_utils import serialize, validate_id, validate_data

def get_all_notifications_controller():
    return serialize(model.get_all_notifications())

def get_notification_controller(notification_id):
    return serialize(model.get_notification(validate_id(notification_id, "notification ID")))

def get_user_notifications_controller(user_id):
    return serialize(model.get_user_notifications(validate_id(user_id, "user ID")))

def add_notification_controller(user_id, notification_type, title, summary, brief_message=None, full_message=None, alert_id=None):
    validate_id(user_id, "user ID")
    if notification_type not in ("EMAIL", "SYSTEM", "ALERT"):
        raise ValueError("Invalid notification type")
    if alert_id is not None:
        validate_id(alert_id, "alert ID")
    if not isinstance(title, str) or not title.strip():
        raise ValueError("Notification title is required")
    return model.add_notification(user_id, notification_type, title, summary, brief_message, full_message, alert_id)

def update_notification_controller(notification_id, values):
    return model.update_notification(validate_id(notification_id, "notification ID"), validate_data(values))

def delete_notification_controller(notification_id):
    return model.delete_notification(validate_id(notification_id, "notification ID"))