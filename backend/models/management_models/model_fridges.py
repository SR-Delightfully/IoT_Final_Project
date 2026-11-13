from models.database import fetch_all, fetch_by_id, insert_record, update_record, delete_record

TABLE = "Fridges"
PRIMARY_KEY = "fridge_id"

def get_all_fridges():
    return fetch_all(TABLE, PRIMARY_KEY)

def get_fridge(fridge_id):
    return fetch_by_id(TABLE, PRIMARY_KEY, fridge_id)

def add_fridge(name, location, min_temperature, max_temperature, min_humidity, max_humidity):
    return insert_record(TABLE, {
        "fridge_name": name,
        "fridge_location": location,
        "fridge_min_temperature": min_temperature,
        "fridge_max_temperature": max_temperature,
        "fridge_min_humidity": min_humidity,
        "fridge_max_humidity": max_humidity
    })

def update_fridge(fridge_id, values):
    return update_record(TABLE, PRIMARY_KEY, fridge_id, values)

def delete_fridge(fridge_id):
    return delete_record(TABLE, PRIMARY_KEY, fridge_id)