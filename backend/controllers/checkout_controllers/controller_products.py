from models.checkout_models import model_products as model
from controllers.controller_utils import serialize, validate_id, validate_data

def get_all_products_controller():
    return serialize(model.get_all_products())

def get_product_controller(product_id):
    return serialize(model.get_product(validate_id(product_id, "product ID")))

def add_product_controller(category_id, name, description, company, price_cents, stock_quantity, is_active=1):
    validate_id(category_id, "category ID")
    if not isinstance(name, str) or not name.strip():
        raise ValueError("Product name is required")
    if type(price_cents) is not int or price_cents < 0:
        raise ValueError("Invalid product price")
    if type(stock_quantity) is not int or stock_quantity < 0:
        raise ValueError("Invalid stock quantity")
    return model.add_product(category_id, name, description, company, price_cents, stock_quantity, is_active)

def update_product_controller(product_id, values):
    return model.update_product(validate_id(product_id, "product ID"), validate_data(values))

def delete_product_controller(product_id):
    return model.delete_product(validate_id(product_id, "product ID"))