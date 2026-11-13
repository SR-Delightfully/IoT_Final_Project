from models.checkout_models import model_categories as model
from controllers.controller_utils import serialize, validate_id, validate_data

def get_all_categories_controller():
    return serialize(model.get_all_categories())

def get_category_controller(category_id):
    return serialize(model.get_category(validate_id(category_id, "category ID")))

def add_category_controller(category_name, category_description=None):
    if not isinstance(category_name, str) or not category_name.strip():
        raise ValueError("Category name is required")
    return model.add_category(category_name, category_description)

def update_category_controller(category_id, values):
    return model.update_category(validate_id(category_id, "category ID"), validate_data(values))

def delete_category_controller(category_id):
    return model.delete_category(validate_id(category_id, "category ID"))