from models.client_models import model_receipts as model
from controllers.controller_utils import serialize, validate_id

def get_all_receipts_controller():
    return serialize(model.get_all_receipts())

def get_receipt_controller(receipt_id):
    return serialize(model.get_receipt(validate_id(receipt_id, "receipt ID")))

def get_receipt_by_purchase_controller(purchase_id):
    return serialize(model.get_receipt_by_purchase(validate_id(purchase_id, "purchase ID")))

def add_receipt_controller(purchase_id, receipt_number):
    validate_id(purchase_id, "purchase ID")
    if not isinstance(receipt_number, str) or not receipt_number.strip():
        raise ValueError("Receipt number is required")
    return model.add_receipt(purchase_id, receipt_number)

def update_receipt_controller(receipt_id, values):
    if not isinstance(values, dict) or not values:
        raise ValueError("Invalid receipt data")
    return model.update_receipt(validate_id(receipt_id, "receipt ID"), values)

def delete_receipt_controller(receipt_id):
    return model.delete_receipt(validate_id(receipt_id, "receipt ID"))