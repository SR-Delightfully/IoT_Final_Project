from models.database import fetch_all, fetch_by_id, insert_record, update_record, delete_record

TABLE = "Rewards"
PRIMARY_KEY = "reward_id"

def get_all_rewards():
    return fetch_all(TABLE, PRIMARY_KEY)

def get_reward(reward_id):
    return fetch_by_id(TABLE, PRIMARY_KEY, reward_id)

def add_reward(name, description, points_cost, is_active=1):
    return insert_record(TABLE, {
        "reward_name": name,
        "reward_description": description,
        "reward_points_cost": points_cost,
        "reward_is_active": is_active
    })

def update_reward(reward_id, values):
    return update_record(TABLE, PRIMARY_KEY, reward_id, values)

def delete_reward(reward_id):
    return delete_record(TABLE, PRIMARY_KEY, reward_id)