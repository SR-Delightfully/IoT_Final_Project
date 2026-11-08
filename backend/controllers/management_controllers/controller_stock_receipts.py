from models.management_models import model_stock_receipts as model
from controllers.controller_utils import serialize, validate_id

def get_all_stock_receipts_controller():
    return serialize(model.get_all_stock_receipts())

def get_stock_receipt_controller(stock_receipt_id):
    return serialize(model.get_stock_receipt(validate_id(stock_receipt_id, "stock receipt ID")))

def get_stock_receipt_items_controller(stock_receipt_id):
    return serialize(model.get_stock_receipt_items(validate_id(stock_receipt_id, "stock receipt ID")))

def add_stock_receipt_controller(supplier=None, items=None):
    if not isinstance(items, list) or not items:
        raise ValueError("Stock receipt must contain items")

    for item in items:
        if not isinstance(item, dict):
            raise ValueError("Invalid stock receipt item")
        validate_id(item.get("product_id"), "product ID")
        quantity = item.get("quantity")
        if type(quantity) is not int or quantity <= 0:
            raise ValueError("Invalid stock quantity")

    return model.add_stock_receipt(supplier, items)

def delete_stock_receipt_controller(stock_receipt_id):
    return model.delete_stock_receipt(validate_id(stock_receipt_id, "stock receipt ID"))