
-- Separated some of the tables into a Users table because employees may not be customers.
CREATE TABLE IF NOT EXISTS Users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_role VARCHAR(30) NOT NULL DEFAULT 'customer',
    user_fname VARCHAR(100) NOT NULL,
    user_lname VARCHAR(100) NOT NULL,
    user_email VARCHAR(255) NOT NULL UNIQUE,
    user_password_hash VARCHAR(255) NOT NULL,
    user_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer-specific information is stored separately from Users.
CREATE TABLE IF NOT EXISTS Customers (
    customer_id INTEGER PRIMARY KEY,
    customer_code VARCHAR(20) UNIQUE,
    customer_address VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(30),
    FOREIGN KEY (customer_id)
        REFERENCES Users(user_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Fridges (
    fridge_id INTEGER PRIMARY KEY AUTOINCREMENT,
    fridge_name VARCHAR(100) NOT NULL,
    fridge_location VARCHAR(255),
    fridge_max_humidity INTEGER NOT NULL,
    fridge_min_humidity INTEGER NOT NULL,
    fridge_max_temperature INTEGER NOT NULL,
    fridge_min_temperature INTEGER NOT NULL,
    fridge_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (fridge_min_humidity <= fridge_max_humidity),
    CHECK (fridge_min_temperature <= fridge_max_temperature)
);

CREATE TABLE IF NOT EXISTS FridgeReadings (
    reading_id INTEGER PRIMARY KEY AUTOINCREMENT,
    fridge_id INTEGER NOT NULL,
    reading_humidity INTEGER NOT NULL,
    reading_temperature INTEGER NOT NULL,
    reading_recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fridge_id)
        REFERENCES Fridges(fridge_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_readings_fridge_time
ON FridgeReadings(fridge_id, reading_recorded_at);

CREATE TABLE IF NOT EXISTS Alerts (
    alert_id INTEGER PRIMARY KEY AUTOINCREMENT,
    fridge_id INTEGER NOT NULL,
    reading_id INTEGER NOT NULL,
    alert_type VARCHAR(30) NOT NULL,
    alert_condition VARCHAR(20) NOT NULL,
    alert_value INTEGER NOT NULL,
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
    notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        REFERENCES Users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_status
ON Notifications(user_id, notification_status);


-- INSERT INTO Fridges (
--     fridge_name,
--     fridge_location,
--     fridge_max_humidity,
--     fridge_min_humidity,
--     fridge_max_temperature,
--     fridge_min_temperature
-- ) VALUES
--     ('Fridge 1', 'Kitchen', 70, 30, 5, 1),
--     ('Fridge 2', 'Storage Room', 65, 35, 4, 2);

ALTER TABLE Customers
ADD COLUMN customer_loyalty_points INTEGER NOT NULL DEFAULT 0
CHECK (customer_loyalty_points >= 0);


CREATE TABLE IF NOT EXISTS Products (
    product_id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_name TEXT NOT NULL,
    product_category TEXT NOT NULL,
    product_price INTEGER NOT NULL CHECK (product_price >= 0),
    product_upc TEXT NOT NULL UNIQUE CHECK (length(product_upc) BETWEEN 12 AND 13),
    product_producer_company TEXT NOT NULL,
    product_image_url TEXT,
    product_active INTEGER NOT NULL DEFAULT 1 CHECK (product_active IN (0, 1)),
    product_created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS StockReceptions (
    reception_id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    reception_quantity_received INTEGER NOT NULL CHECK (reception_quantity_received > 0),
    reception_received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reception_note TEXT,

    FOREIGN KEY (product_id) REFERENCES Products(product_id)
);

CREATE TABLE IF NOT EXISTS Purchases (
    purchase_id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    purchase_total INTEGER NOT NULL DEFAULT 0 CHECK (purchase_total >= 0),
    purchase_points_earned INTEGER NOT NULL DEFAULT 0 CHECK (purchase_points_earned >= 0),
    purchase_payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (purchase_payment_status IN ('pending', 'paid')),
    purchase_created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    purchase_receipt_emailed_at TEXT,

    FOREIGN KEY (customer_id) REFERENCES Customers(customer_id)
);

CREATE TABLE IF NOT EXISTS PurchaseItems (
    purchase_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    purchase_item_name TEXT NOT NULL,
    purchase_item_quantity INTEGER NOT NULL CHECK (purchase_item_quantity > 0),
    purchase_item_unit_price INTEGER NOT NULL CHECK (purchase_item_unit_price >= 0),

    FOREIGN KEY (purchase_id) REFERENCES Purchases(purchase_id),
    FOREIGN KEY (product_id) REFERENCES Products(product_id)
);

CREATE TABLE IF NOT EXISTS ProductTags (
    product_tag_id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    product_tag_epc TEXT NOT NULL UNIQUE CHECK (length(product_tag_epc) BETWEEN 1 AND 24),
    purchase_item_id INTEGER,

    FOREIGN KEY (product_id) REFERENCES Products(product_id),
    FOREIGN KEY (purchase_item_id) REFERENCES PurchaseItems(purchase_item_id)
);


CREATE VIEW IF NOT EXISTS Inventory AS
SELECT
    p.product_id,
    p.product_name,
    p.product_category,
    p.product_upc,
    p.product_price,
    p.product_producer_company,
    p.product_active,
    COALESCE(received.total_received, 0) AS total_received,
    COALESCE(sold.total_sold, 0) AS total_sold,
    COALESCE(received.total_received, 0) - COALESCE(sold.total_sold, 0) AS quantity_in_stock,
    COALESCE(tags.available_epc_tags, 0) AS available_epc_tags
FROM Products AS p
LEFT JOIN (
    SELECT
        sr.product_id,
        SUM(sr.reception_quantity_received) AS total_received
    FROM StockReceptions AS sr
    GROUP BY sr.product_id
) AS received
    ON received.product_id = p.product_id
LEFT JOIN (
    SELECT
        pi.product_id,
        SUM(pi.purchase_item_quantity) AS total_sold
    FROM PurchaseItems AS pi
    JOIN Purchases AS pu
        ON pu.purchase_id = pi.purchase_id
    WHERE pu.purchase_payment_status = 'paid'
    GROUP BY pi.product_id
) AS sold
    ON sold.product_id = p.product_id
LEFT JOIN (
    SELECT
        pt.product_id,
        COUNT(*) AS available_epc_tags
    FROM ProductTags AS pt
    WHERE pt.purchase_item_id IS NULL
    GROUP BY pt.product_id
) AS tags
    ON tags.product_id = p.product_id;


CREATE VIEW IF NOT EXISTS PurchaseReceipts AS
SELECT
    pu.purchase_id,
    'R-' || printf('%06d', pu.purchase_id) AS receipt_number,
    pu.customer_id,
    c.customer_code AS membership_number,
    u.user_fname AS customer_first_name,
    u.user_lname AS customer_last_name,
    u.user_email AS customer_email,
    pu.purchase_created_at,
    pu.purchase_payment_status,
    pu.purchase_total,
    pu.purchase_points_earned,
    pu.purchase_receipt_emailed_at
FROM Purchases AS pu
LEFT JOIN Customers AS c
    ON c.customer_id = pu.customer_id
LEFT JOIN Users AS u
    ON u.user_id = c.customer_id;


CREATE INDEX IF NOT EXISTS idx_stock_receptions_product
ON StockReceptions(product_id);

CREATE INDEX IF NOT EXISTS idx_purchases_customer_date
ON Purchases(customer_id, purchase_created_at);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase
ON PurchaseItems(purchase_id);

CREATE INDEX IF NOT EXISTS idx_purchase_items_product
ON PurchaseItems(product_id);

CREATE INDEX IF NOT EXISTS idx_product_tags_product_sale
ON ProductTags(product_id, purchase_item_id);


INSERT OR IGNORE INTO Users (
    user_role, user_fname, user_lname, user_email, user_password_hash
)
VALUES ('customer', 'Alex', 'Martin', 'alex.martin@example.com', '12934ednde23230');

INSERT OR IGNORE INTO Customers (
    customer_id, customer_code, customer_address, customer_phone, customer_loyalty_points
)
SELECT user_id, 'MEM' || printf('%08d', user_id), '123 Acadie Street', '1234321230', 0
FROM Users
WHERE user_email = 'alex.martin@example.com';


INSERT OR IGNORE INTO Products (
    product_id, product_name, product_category, product_price, product_upc, product_producer_company
)
VALUES
    (1, 'Pikachu', 'Rare Card', 250, '0123456789012', 'Pikachu Inc.'),
    (2, 'Bulbasaur', 'Common Card', 300, '0987654321098', 'Bulbasaur Co.');


INSERT INTO StockReceptions (
    product_id, reception_quantity_received, reception_note
)
VALUES
    (1, 7, 'Initial Pikachu stock'),
    (2, 3, 'Initial bulbasaur stock');


INSERT INTO ProductTags (
    product_id, product_tag_epc
)
VALUES
    (1, 'PIKACHU-001'),
    (1, 'PIKACHU-002'),
    (1, 'PIKACHU-003'),
    (1, 'PIKACHU-004'),
    (1, 'PIKACHU-005'),
    (1, 'PIKACHU-006'),
    (1, 'PIKACHU-007'),
    (2, 'BULBASAUR-001'),
    (2, 'BULBASAUR-002'),
    (2, 'BULBASAUR-003');
