from models.database import fetch_all, fetch_by_id, insert_record, update_record, delete_record

TABLE = "Categories"
PRIMARY_KEY = "category_id"

def get_all_categories():
    return fetch_all(TABLE, PRIMARY_KEY)

def get_category(category_id):
    return fetch_by_id(TABLE, PRIMARY_KEY, category_id)

def add_category(category_name, category_description=None):
    return insert_record(TABLE, {
        "category_name": category_name,
        "category_description": category_description
    })

def update_category(category_id, values):
    return update_record(TABLE, PRIMARY_KEY, category_id, values)

def delete_category(category_id):
    return delete_record(TABLE, PRIMARY_KEY, category_id)