def serialize(value):
    if value is None:
        return None

    if isinstance(value, list):
        return [serialize(item) for item in value]

    if hasattr(value, "keys"):
        return dict(value)

    return value


def validate_id(value, field="ID"):
    if type(value) is not int or value <= 0:
        raise ValueError(f"Invalid {field}")
    return value


def validate_data(data):
    if not isinstance(data, dict) or not data:
        raise ValueError("Invalid data")
    return data