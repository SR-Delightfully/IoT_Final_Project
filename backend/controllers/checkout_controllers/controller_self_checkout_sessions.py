from models.checkout_models import model_self_checkout_sessions as model
from controllers.controller_utils import serialize, validate_id, validate_data

def get_all_sessions_controller():
    return serialize(model.get_all_sessions())

def get_session_controller(session_id):
    return serialize(model.get_session(validate_id(session_id, "session ID")))

def get_user_sessions_controller(user_id):
    return serialize(model.get_user_sessions(validate_id(user_id, "user ID")))

def add_session_controller(user_id=None, status="ACTIVE"):
    if user_id is not None:
        validate_id(user_id, "user ID")
    if status not in ("ACTIVE", "COMPLETED", "CANCELLED", "EXPIRED"):
        raise ValueError("Invalid session status")
    return model.add_session(user_id, status)

def update_session_controller(session_id, values):
    return model.update_session(validate_id(session_id, "session ID"), validate_data(values))

def delete_session_controller(session_id):
    return model.delete_session(validate_id(session_id, "session ID"))