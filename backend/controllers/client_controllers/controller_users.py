from models.client_models import model_users as model
from controllers.controller_utils import serialize, validate_id, validate_data

def get_all_users_controller():
    return serialize(model.get_all_users())

def get_user_controller(user_id):
    return serialize(model.get_user(validate_id(user_id, "user ID")))

def add_user_controller(user_role, first_name, last_name, email, password_hash, is_verified=0):
    if user_role not in ("customer", "employee", "admin"):
        raise ValueError("Invalid user role")
    if not all(isinstance(value, str) and value.strip() for value in (first_name, last_name, email, password_hash)):
        raise ValueError("Missing required user information")
    return model.add_user(user_role, first_name, last_name, email, password_hash, is_verified)

def get_user_by_email_controller(email):
    if not isinstance(email, str) or not email.strip():
        raise ValueError("Invalid email")
    return serialize(model.get_user_by_email(email))

def update_user_controller(user_id, values):
    return model.update_user(validate_id(user_id, "user ID"), validate_data(values))

def delete_user_controller(user_id):
    return model.delete_user(validate_id(user_id, "user ID"))