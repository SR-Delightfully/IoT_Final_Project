from models.checkout_models import model_purchases as model
from controllers.controller_utils import serialize, validate_id, validate_data

def get_all_purchases_controller():
    return serialize(model.get_all_purchases())

def get_purchase_controller(purchase_id):
    return serialize(model.get_purchase(validate_id(purchase_id, "purchase ID")))

def get_customer_purchases_controller(customer_id):
    return serialize(model.get_customer_purchases(validate_id(customer_id, "customer ID")))

def add_purchase_controller(customer_id, session_id, subtotal_cents, gst_cents, qst_cents, discount_cents, total_cents, payment_method, status="COMPLETED"):
    if customer_id is not None:
        validate_id(customer_id, "customer ID")
    if session_id is not None:
        validate_id(session_id, "session ID")
    amounts = (subtotal_cents, gst_cents, qst_cents, discount_cents, total_cents)
    if any(type(amount) is not int or amount < 0 for amount in amounts):
        raise ValueError("Invalid purchase amount")
    return model.add_purchase(customer_id, session_id, subtotal_cents, gst_cents, qst_cents, discount_cents, total_cents, payment_method, status)

def update_purchase_controller(purchase_id, values):
    return model.update_purchase(validate_id(purchase_id, "purchase ID"), validate_data(values))

def delete_purchase_controller(purchase_id):
    return model.delete_purchase(validate_id(purchase_id, "purchase ID"))