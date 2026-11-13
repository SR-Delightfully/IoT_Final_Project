from models.management_models import model_readings as model
from controllers.controller_utils import serialize, validate_id

def get_all_readings_controller():
    return serialize(model.get_all_readings())

def get_reading_controller(reading_id):
    return serialize(model.get_reading(validate_id(reading_id, "reading ID")))

def get_readings_by_fridge_controller(fridge_id):
    return serialize(model.get_readings_by_fridge(validate_id(fridge_id, "fridge ID")))

def get_latest_reading_controller(fridge_id):
    return serialize(model.get_latest_reading(validate_id(fridge_id, "fridge ID")))

def add_reading_controller(fridge_id, temperature, humidity):
    validate_id(fridge_id, "fridge ID")
    if type(temperature) not in (int, float):
        raise ValueError("Invalid temperature")
    if type(humidity) not in (int, float):
        raise ValueError("Invalid humidity")
    return model.add_reading(fridge_id, temperature, humidity)

def delete_reading_controller(reading_id):
    return model.delete_reading(validate_id(reading_id, "reading ID"))