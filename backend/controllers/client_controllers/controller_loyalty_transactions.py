from models.client_models import model_loyalty_transactions as model
from controllers.controller_utils import serialize, validate_id, validate_data

def get_all_loyalty_transactions_controller():
    return serialize(model.get_all_loyalty_transactions())

def get_loyalty_transaction_controller(transaction_id):
    return serialize(model.get_loyalty_transaction(validate_id(transaction_id, "transaction ID")))

def get_customer_loyalty_transactions_controller(customer_id):
    return serialize(model.get_customer_loyalty_transactions(validate_id(customer_id, "customer ID")))

def add_loyalty_transaction_controller(customer_id, transaction_type, points_change, description=None, purchase_id=None):
    validate_id(customer_id, "customer ID")
    if transaction_type not in ("EARN", "REDEEM", "ADJUST"):
        raise ValueError("Invalid loyalty transaction type")
    if type(points_change) is not int or points_change == 0:
        raise ValueError("Invalid points change")
    if purchase_id is not None:
        validate_id(purchase_id, "purchase ID")
    return model.add_loyalty_transaction(customer_id, transaction_type, points_change, description, purchase_id)

def update_loyalty_transaction_controller(transaction_id, values):
    return model.update_loyalty_transaction(validate_id(transaction_id, "transaction ID"), validate_data(values))

def delete_loyalty_transaction_controller(transaction_id):
    return model.delete_loyalty_transaction(validate_id(transaction_id, "transaction ID"))