from models.management_models import model_fridges as model
from controllers.controller_utils import serialize, validate_id, validate_data

def get_all_fridges_controller():
    return serialize(model.get_all_fridges())

def get_fridge_controller(fridge_id):
    return serialize(model.get_fridge(validate_id(fridge_id, "fridge ID")))

def add_fridge_controller(name, location, min_temperature, max_temperature, min_humidity, max_humidity):
    if not isinstance(name, str) or not name.strip():
        raise ValueError("Fridge name is required")
    if min_temperature >= max_temperature:
        raise ValueError("Invalid temperature limits")
    if min_humidity >= max_humidity:
        raise ValueError("Invalid humidity limits")
    return model.add_fridge(name, location, min_temperature, max_temperature, min_humidity, max_humidity)

def update_fridge_controller(fridge_id, values):
    return model.update_fridge(validate_id(fridge_id, "fridge ID"), validate_data(values))

def delete_fridge_controller(fridge_id):
    return model.delete_fridge(validate_id(fridge_id, "fridge ID"))