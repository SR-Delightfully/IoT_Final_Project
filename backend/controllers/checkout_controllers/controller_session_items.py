from models.checkout_models import model_session_items as model
from controllers.controller_utils import serialize, validate_id, validate_data

def get_all_session_items_controller():
    return serialize(model.get_all_session_items())

def get_session_item_controller(session_item_id):
    return serialize(model.get_session_item(validate_id(session_item_id, "session item ID")))

def get_items_by_session_controller(session_id):
    return serialize(model.get_items_by_session(validate_id(session_id, "session ID")))

def add_session_item_controller(session_id, product_id, quantity=1):
    validate_id(session_id, "session ID")
    validate_id(product_id, "product ID")
    if type(quantity) is not int or quantity <= 0:
        raise ValueError("Invalid quantity")
    return serialize(model.add_session_item(session_id, product_id, quantity))

def update_session_item_controller(session_item_id, values):
    return model.update_session_item(validate_id(session_item_id, "session item ID"), validate_data(values))

def delete_session_item_controller(session_item_id):
    return model.delete_session_item(validate_id(session_item_id, "session item ID"))

def clear_session_items_controller(session_id):
    return model.clear_session_items(validate_id(session_id, "session ID"))