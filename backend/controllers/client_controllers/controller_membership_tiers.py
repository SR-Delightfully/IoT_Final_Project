
from models.client_models import model_membership_tiers as model
from controllers.controller_utils import serialize, validate_id

def get_membership_tier_controller(tier_id):
    return serialize(
        model.get_membership_tier(
            validate_id(tier_id, "membership tier ID")
        )
    )

def get_membership_tier_by_points_controller(points):
    if isinstance(points, bool) or not isinstance(points, int) or points < 0:
        raise ValueError("Invalid membership points")

    return serialize(model.get_membership_tier_by_points(points))

def get_all_membership_tiers_controller():
    return serialize(model.get_all_membership_tiers())
