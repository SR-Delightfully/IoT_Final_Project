from models.checkout_models import model_barcodes as model
from controllers.controller_utils import serialize, validate_id, validate_data

def get_all_barcodes_controller():
    return serialize(model.get_all_barcodes())

def get_barcode_controller(barcode_id):
    return serialize(model.get_barcode(validate_id(barcode_id, "barcode ID")))

def get_barcode_by_value_controller(barcode_value):
    if not isinstance(barcode_value, str) or not barcode_value.strip():
        raise ValueError("Invalid barcode")
    return serialize(model.get_barcode_by_value(barcode_value))

def get_barcodes_by_product_controller(product_id):
    return serialize(model.get_barcodes_by_product(validate_id(product_id, "product ID")))

def add_barcode_controller(product_id, barcode_value):
    validate_id(product_id, "product ID")
    if not isinstance(barcode_value, str) or not barcode_value.strip() or len(barcode_value) > 13:
        raise ValueError("Invalid barcode value")
    return model.add_barcode(product_id, barcode_value)

def update_barcode_controller(barcode_id, values):
    return model.update_barcode(validate_id(barcode_id, "barcode ID"), validate_data(values))

def delete_barcode_controller(barcode_id):
    return model.delete_barcode(validate_id(barcode_id, "barcode ID"))