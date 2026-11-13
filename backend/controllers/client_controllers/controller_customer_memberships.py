
from models.client_models import model_customer_memberships as model
from controllers.controller_utils import serialize, validate_id

def add_customer_membership_controller(customer_id):
    return model.add_customer_membership(
        validate_id(customer_id, "customer ID")
    )

def get_customer_membership_controller(customer_id):
    return serialize(
        model.get_customer_membership(
            validate_id(customer_id, "customer ID")
        )
    )

def get_all_customer_memberships_controller():
    return serialize(model.get_all_customer_memberships())

def add_customer_membership_points_controller(customer_id, points):
    customer_id = validate_id(customer_id, "customer ID")

    if isinstance(points, bool) or not isinstance(points, int) or points <= 0:
        raise ValueError("Invalid membership points")

    return serialize(
        model.add_customer_membership_points(customer_id, points)
    )
