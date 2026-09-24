from models.customer_model import add_customer
from breadboardCode import login    # LED / buzzer (Raspberry Pi only)

# Laptop testing only: comment out the import above and uncomment this
# def login(attempt=False):
#     print("blue LED" if attempt else "red LED + buzzer")


def register(data):   
    try:
        add_customer(
            data["first_name"],
            data["last_name"],
            data["address"],
            data["phone"],
            data["email"],
        )
    except Exception as e:
        print(e)
        login(False)                                   # error: buzzer
        return 500, {"error": "Could not add customer"}

    login(True)                                        # success: LED
    return 201, {"message": "Customer added"}