from models.checkout_models import model_product_tag_sales as model
from controllers.controller_utils import serialize, validate_id

def get_all_product_tag_sales_controller():
    return serialize(model.get_all_product_tag_sales())

def get_product_tag_sale_controller(sale_id):
    return serialize(model.get_product_tag_sale(validate_id(sale_id, "sale ID")))

def get_sales_by_purchase_item_controller(purchase_item_id):
    return serialize(model.get_sales_by_purchase_item(validate_id(purchase_item_id, "purchase item ID")))

def add_product_tag_sale_controller(product_tag_id, purchase_item_id):
    validate_id(product_tag_id, "product tag ID")
    validate_id(purchase_item_id, "purchase item ID")
    return model.add_product_tag_sale(product_tag_id, purchase_item_id)

def delete_product_tag_sale_controller(sale_id):
    return model.delete_product_tag_sale(validate_id(sale_id, "sale ID"))