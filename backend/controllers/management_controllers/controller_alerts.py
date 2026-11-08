from models.management_models import model_alerts as model
from controllers.controller_utils import serialize, validate_id, validate_data

def get_all_alerts_controller():
    return serialize(model.get_all_alerts())

def get_alert_controller(alert_id):
    return serialize(model.get_alert(validate_id(alert_id, "alert ID")))

def get_alerts_by_status_controller(status):
    if status not in ("UNACKNOWLEDGED", "ACKNOWLEDGED", "RESOLVED"):
        raise ValueError("Invalid alert status")
    return serialize(model.get_alerts_by_status(status))

def get_alerts_by_reading_controller(reading_id):
    return serialize(model.get_alerts_by_reading(validate_id(reading_id, "reading ID")))

def add_alert_controller(reading_id, alert_type, condition, value, message, status="UNACKNOWLEDGED"):
    validate_id(reading_id, "reading ID")
    if alert_type not in ("TEMPERATURE", "HUMIDITY", "SYSTEM"):
        raise ValueError("Invalid alert type")
    if status not in ("UNACKNOWLEDGED", "ACKNOWLEDGED", "RESOLVED"):
        raise ValueError("Invalid alert status")
    return model.add_alert(reading_id, alert_type, condition, value, message, status)

def update_alert_controller(alert_id, values):
    return model.update_alert(validate_id(alert_id, "alert ID"), validate_data(values))

def delete_alert_controller(alert_id):
    return model.delete_alert(validate_id(alert_id, "alert ID"))