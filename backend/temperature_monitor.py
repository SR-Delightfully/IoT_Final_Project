from models.fridge_model import get_fridge


# Check if the fridge temperature exceeds its maximum
def check_temperature(fridge_id, temperature):
    fridge = get_fridge(fridge_id)

    if fridge is None:
        print("Refrigerator not found")
        return False

    max_temp = fridge["fridge_max_temperature"]

    return temperature > max_temp