from models.client_models import model_rewards as model
from controllers.controller_utils import serialize, validate_id, validate_data

def get_all_rewards_controller():
    return serialize(model.get_all_rewards())

def get_reward_controller(reward_id):
    return serialize(model.get_reward(validate_id(reward_id, "reward ID")))

def add_reward_controller(name, description, points_cost, is_active=1):
    if not isinstance(name, str) or not name.strip():
        raise ValueError("Reward name is required")
    if type(points_cost) is not int or points_cost <= 0:
        raise ValueError("Invalid reward points cost")
    if is_active not in (0, 1):
        raise ValueError("Invalid reward status")
    return model.add_reward(name, description, points_cost, is_active)

def update_reward_controller(reward_id, values):
    return model.update_reward(validate_id(reward_id, "reward ID"), validate_data(values))

def delete_reward_controller(reward_id):
    return model.delete_reward(validate_id(reward_id, "reward ID"))