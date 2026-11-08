from models.client_models import model_customers as model
from controllers.controller_utils import serialize, validate_id, validate_data

def add_customer_controller(first_name, last_name, address, phone, email, password, customer_code=None, is_member=False):
    required = (first_name, last_name, email, password)

    if not all(isinstance(value, str) and value.strip() for value in required):
        raise ValueError("Missing required customer information")

    if not isinstance(is_member, (bool, int)) or is_member not in (0, 1):
        raise ValueError("Invalid membership status")

    return model.add_customer(
        first_name,
        last_name,
        address,
        phone,
        email,
        password,
        customer_code,
        is_member
    )

def get_customer_controller(customer_id):
    return serialize(model.get_customer(validate_id(customer_id, "customer ID")))

def get_customer_by_email_controller(email):
    if not isinstance(email, str) or not email.strip():
        raise ValueError("Invalid email")

    return serialize(model.get_customer_by_email(email))

def get_all_customers_controller():
    return serialize(model.get_all_customers())

def update_customer_controller(customer_id, values):
    values = validate_data(values)

    if "customer_is_member" in values:
        membership = values["customer_is_member"]

        if not isinstance(membership, (bool, int)) or membership not in (0, 1):
            raise ValueError("Invalid membership status")

    return model.update_customer(
        validate_id(customer_id, "customer ID"),
        values
    )

def delete_customer_controller(customer_id):
    return model.delete_customer(validate_id(customer_id, "customer ID"))