-- Separated some of the table into a 'Users' table, because employees may not be customers.
CREATE TABLE IF NOT EXISTS Users (
    user_id INTEGER PRIMARY KEY AUTO_INCREMENT,
    user_role VARCHAR(30) NOT NULL DEFAULT 'customer',
    user_fname VARCHAR(100) NOT NULL,
    user_lname VARCHAR(100) NOT NULL,
    user_email VARCHAR(255) NOT NULL UNIQUE,
    user_password_hash VARCHAR(255) NOT NULL,
    user_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Adding 'customer_' prefix to table records to save my sanity when i work on the frontend
CREATE TABLE IF NOT EXISTS Customers ( -- table names should be caps, no? pls correct me if i'm wrong
    customer_id INTEGER PRIMARY KEY,
    customer_code VARCHAR(20) UNIQUE,
    customer_address VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(30),

    FOREIGN KEY (customer_id)
        REFERENCES Users(user_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Fridges (
    fridge_id INTEGER PRIMARY KEY AUTO_INCREMENT,
    fridge_name VARCHAR(100) NOT NULL,
    fridge_location VARCHAR(255),
    fridge_max_humidity FLOAT NOT NULL,
    fridge_min_humidity FLOAT NOT NULL,
    fridge_max_temperature FLOAT NOT NULL,
    fridge_min_temperature FLOAT NOT NULL,
    fridge_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CHECK (fridge_min_humidity <= fridge_max_humidity),
    CHECK (fridge_min_temperature <= fridge_max_temperature)
);

CREATE TABLE IF NOT EXISTS FridgeReadings (
    reading_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    fridge_id INTEGER NOT NULL,
    reading_humidity FLOAT NOT NULL,
    reading_temperature FLOAT NOT NULL,
    reading_recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (fridge_id)
        REFERENCES Fridges(fridge_id)
        ON DELETE CASCADE,

    INDEX idx_readings_fridge_time
        (fridge_id, reading_recorded_at)
);

CREATE TABLE IF NOT EXISTS Alerts (
    alert_id INTEGER PRIMARY KEY AUTO_INCREMENT,
    fridge_id INTEGER NOT NULL,
    reading_id BIGINT NOT NULL,
    alert_type VARCHAR(30) NOT NULL,
    alert_condition VARCHAR(20) NOT NULL,
    alert_value FLOAT NOT NULL,
    alert_message TEXT NOT NULL,
    alert_status VARCHAR(20) NOT NULL DEFAULT 'unacknowledged',
    alert_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    alert_acknowledged_at TIMESTAMP NULL,
    alert_resolved_at TIMESTAMP NULL,
    alert_acknowledged_by INTEGER,

    FOREIGN KEY (fridge_id)
        REFERENCES Fridges(fridge_id),

    FOREIGN KEY (reading_id)
        REFERENCES FridgeReadings(reading_id),

    FOREIGN KEY (alert_acknowledged_by)
        REFERENCES Users(user_id)
);

CREATE TABLE IF NOT EXISTS Notifications (
    notification_id INTEGER PRIMARY KEY AUTO_INCREMENT,
    alert_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    notification_type VARCHAR(30) NOT NULL,
    notification_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    notification_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notification_sent_at TIMESTAMP NULL,
    notification_read_at TIMESTAMP NULL,

    FOREIGN KEY (alert_id)
        REFERENCES Alerts(alert_id),

    FOREIGN KEY (user_id)
        REFERENCES Users(user_id),

    INDEX idx_notifications_user_status
        (user_id, notification_status)
);