from models.checkout_models import model_purchase_items as model
from controllers.controller_utils import serialize, validate_id, validate_data

def get_all_purchase_items_controller():
    return serialize(model.get_all_purchase_items())

def get_purchase_item_controller(purchase_item_id):
    return serialize(model.get_purchase_item(validate_id(purchase_item_id, "purchase item ID")))

def get_items_by_purchase_controller(purchase_id):
    return serialize(model.get_items_by_purchase(validate_id(purchase_id, "purchase ID")))

def add_purchase_item_controller(purchase_id, product_id, quantity, unit_price_cents):
    validate_id(purchase_id, "purchase ID")
    validate_id(product_id, "product ID")
    if type(quantity) is not int or quantity <= 0:
        raise ValueError("Invalid quantity")
    if type(unit_price_cents) is not int or unit_price_cents < 0:
        raise ValueError("Invalid unit price")
    return model.add_purchase_item(purchase_id, product_id, quantity, unit_price_cents)

def update_purchase_item_controller(purchase_item_id, values):
    return model.update_purchase_item(validate_id(purchase_item_id, "purchase item ID"), validate_data(values))

def delete_purchase_item_controller(purchase_item_id):
    return model.delete_purchase_item(validate_id(purchase_item_id, "purchase item ID"))