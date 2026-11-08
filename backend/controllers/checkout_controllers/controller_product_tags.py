from models.checkout_models import model_product_tags as model
from controllers.controller_utils import serialize, validate_id, validate_data

def get_all_product_tags_controller():
    return serialize(model.get_all_product_tags())

def get_product_tag_controller(product_tag_id):
    return serialize(model.get_product_tag(validate_id(product_tag_id, "product tag ID")))

def get_product_tag_by_epc_controller(epc):
    if not isinstance(epc, str) or not epc.strip():
        raise ValueError("Invalid EPC")
    return serialize(model.get_product_tag_by_epc(epc))

def get_product_tags_by_product_controller(product_id):
    return serialize(model.get_product_tags_by_product(validate_id(product_id, "product ID")))

def add_product_tag_controller(product_id, epc, status="ACTIVE"):
    validate_id(product_id, "product ID")
    if not isinstance(epc, str) or not epc.strip() or len(epc) > 24:
        raise ValueError("Invalid EPC")
    if status not in ("ACTIVE", "INACTIVE"):
        raise ValueError("Invalid product tag status")
    return model.add_product_tag(product_id, epc, status)

def update_product_tag_controller(product_tag_id, values):
    return model.update_product_tag(validate_id(product_tag_id, "product tag ID"), validate_data(values))

def delete_product_tag_controller(product_tag_id):
    return model.delete_product_tag(validate_id(product_tag_id, "product tag ID"))