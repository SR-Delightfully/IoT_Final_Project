from models.client_models import model_reward_redemptions as model
from controllers.controller_utils import serialize, validate_id

def get_all_redemptions_controller():
    return serialize(model.get_all_redemptions())

def get_redemption_controller(redemption_id):
    return serialize(model.get_redemption(validate_id(redemption_id, "redemption ID")))

def get_redemption_by_transaction_controller(transaction_id):
    return serialize(model.get_redemption_by_transaction(validate_id(transaction_id, "transaction ID")))

def add_redemption_controller(reward_id, loyalty_transaction_id, status="PENDING"):
    validate_id(reward_id, "reward ID")
    validate_id(loyalty_transaction_id, "loyalty transaction ID")
    if status not in ("PENDING", "COMPLETED", "CANCELLED"):
        raise ValueError("Invalid redemption status")
    return model.add_redemption(reward_id, loyalty_transaction_id, status)

def update_redemption_controller(redemption_id, values):
    if not isinstance(values, dict) or not values:
        raise ValueError("Invalid redemption data")
    return model.update_redemption(validate_id(redemption_id, "redemption ID"), values)

def delete_redemption_controller(redemption_id):
    return model.delete_redemption(validate_id(redemption_id, "redemption ID"))