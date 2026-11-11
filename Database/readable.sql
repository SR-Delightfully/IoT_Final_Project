PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;
--* Reworked Database to make it 3FN so it's easier to read, use, and update later. 
--? INITIALIZING 'Smart TCG Store' DB TABLES (normalized to 3FN):

CREATE TABLE IF NOT EXISTS Users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_role TEXT NOT NULL DEFAULT 'customer'
        CHECK (user_role IN ('customer', 'employee', 'admin')),
    user_fname TEXT NOT NULL,
    user_lname TEXT NOT NULL,
    user_email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    user_password_hash TEXT NOT NULL,
    user_is_verified INTEGER NOT NULL DEFAULT 0
        CHECK (user_is_verified IN (0, 1)),
    user_created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Categories (
    category_id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_name TEXT NOT NULL UNIQUE,
    category_description TEXT,
    category_icon TEXT,
    category_created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    category_image_url TEXT
);

CREATE TABLE IF NOT EXISTS Rewards (
    reward_id INTEGER PRIMARY KEY AUTOINCREMENT,
    reward_name TEXT NOT NULL,
    reward_description TEXT,
    reward_image_url TEXT,
    reward_points_cost INTEGER NOT NULL
        CHECK (reward_points_cost > 0),
    reward_is_active INTEGER NOT NULL DEFAULT 1
        CHECK (reward_is_active IN (0, 1)),
    reward_created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Fridges refers to.. fridges? xD
CREATE TABLE IF NOT EXISTS Fridges (
    fridge_id INTEGER PRIMARY KEY AUTOINCREMENT,
    fridge_name TEXT NOT NULL,
    fridge_location TEXT,
    fridge_min_temperature REAL NOT NULL,
    fridge_max_temperature REAL NOT NULL,
    fridge_min_humidity REAL NOT NULL,
    fridge_max_humidity REAL NOT NULL,
    fridge_fan_on INTEGER NOT NULL DEFAULT 0
        CHECK (fridge_fan_on IN (0, 1)),
    fridge_created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (fridge_min_temperature <= fridge_max_temperature),
    CHECK (fridge_min_humidity <= fridge_max_humidity),
    CHECK (fridge_min_humidity >= 0 AND fridge_max_humidity <= 100)
);

CREATE TABLE IF NOT EXISTS MembershipTiers (
    membership_tier_id INTEGER PRIMARY KEY AUTOINCREMENT,
    membership_tier_name TEXT NOT NULL UNIQUE,
    membership_tier_min_points INTEGER NOT NULL UNIQUE
        CHECK (membership_tier_min_points >= 0)
);

-- Users become customers once they make a purchase
CREATE TABLE IF NOT EXISTS Customers (
    customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    customer_code TEXT UNIQUE,
    customer_phone TEXT,
    customer_address TEXT,
    customer_is_member INTEGER NOT NULL DEFAULT 0
        CHECK (customer_is_member IN (0, 1)),
    customer_membership_date TEXT,
    customer_created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)
        REFERENCES Users(user_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS CustomerMemberships (
    customer_membership_id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL UNIQUE,
    membership_tier_id INTEGER NOT NULL DEFAULT 1,
    customer_membership_points INTEGER NOT NULL DEFAULT 0
        CHECK (customer_membership_points >= 0),
    customer_membership_updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id)
        REFERENCES Customers(customer_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    FOREIGN KEY (membership_tier_id)
        REFERENCES MembershipTiers(membership_tier_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

-- Products includes individual cards, booster packs and boxes, starter decks, gaming accessories (play mat, dice, sleeves), and hobby supplies (binders, miniatures) etc.
CREATE TABLE IF NOT EXISTS Products (
    product_id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    product_name TEXT NOT NULL,
    product_description TEXT,
    product_company TEXT,
    product_image_url TEXT,
    product_price_cents INTEGER NOT NULL
        CHECK (product_price_cents >= 0),
    product_stock_quantity INTEGER NOT NULL DEFAULT 0
        CHECK (product_stock_quantity >= 0),
    product_is_active INTEGER NOT NULL DEFAULT 1
        CHECK (product_is_active IN (0, 1)),
    product_created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    product_updated_at TEXT,

    FOREIGN KEY (category_id)
        REFERENCES Categories(category_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS SelfCheckoutSessions (
    session_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    session_status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (session_status IN ('ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED')),
    session_created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    session_completed_at TEXT,

    FOREIGN KEY (user_id)
        REFERENCES Users(user_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

-- Readings refers to the content received by the Fridge's sensors
CREATE TABLE IF NOT EXISTS Readings (
    reading_id INTEGER PRIMARY KEY AUTOINCREMENT,
    fridge_id INTEGER NOT NULL,
    reading_temperature REAL NOT NULL,
    reading_humidity REAL NOT NULL
        CHECK (reading_humidity >= 0 AND reading_humidity <= 100),
    reading_created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (fridge_id)
        REFERENCES Fridges(fridge_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

-- Purchases refers to a list of Product BarCodes
CREATE TABLE IF NOT EXISTS Purchases (
    purchase_id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    session_id INTEGER UNIQUE,
    purchase_subtotal_cents INTEGER NOT NULL DEFAULT 0
        CHECK (purchase_subtotal_cents >= 0),
    purchase_gst_cents INTEGER NOT NULL DEFAULT 0
        CHECK (purchase_gst_cents >= 0),
    purchase_qst_cents INTEGER NOT NULL DEFAULT 0
        CHECK (purchase_qst_cents >= 0),
    purchase_discount_cents INTEGER NOT NULL DEFAULT 0
        CHECK (
            purchase_discount_cents >= 0
            AND purchase_discount_cents <=
                purchase_subtotal_cents + purchase_gst_cents + purchase_qst_cents
        ),
    purchase_total_cents INTEGER NOT NULL DEFAULT 0
        CHECK (
            purchase_total_cents =
            purchase_subtotal_cents
            + purchase_gst_cents
            + purchase_qst_cents
            - purchase_discount_cents
        ),
    purchase_payment_method TEXT,
    purchase_status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (purchase_status IN ('PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED')),
    purchase_created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (customer_id)
        REFERENCES Customers(customer_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    FOREIGN KEY (session_id)
        REFERENCES SelfCheckoutSessions(session_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS PurchaseItems (
    purchase_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    purchase_item_quantity INTEGER NOT NULL
        CHECK (purchase_item_quantity > 0),
    purchase_item_unit_price_cents INTEGER NOT NULL
        CHECK (purchase_item_unit_price_cents >= 0),

    UNIQUE (purchase_id, product_id),
    UNIQUE (purchase_item_id, product_id),

    FOREIGN KEY (purchase_id)
        REFERENCES Purchases(purchase_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    FOREIGN KEY (product_id)
        REFERENCES Products(product_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

-- Customers gain Loyalty Points when shopping

CREATE TABLE IF NOT EXISTS LoyaltyTransactions (
    loyalty_transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    purchase_id INTEGER,
    loyalty_transaction_type TEXT NOT NULL
        CHECK (loyalty_transaction_type IN ('EARN', 'REDEEM', 'ADJUST')),
    loyalty_points_change INTEGER NOT NULL
        CHECK (loyalty_points_change <> 0),
    loyalty_transaction_description TEXT,
    loyalty_transaction_created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (
        (loyalty_transaction_type = 'EARN' AND loyalty_points_change > 0)
        OR
        (loyalty_transaction_type = 'REDEEM' AND loyalty_points_change < 0)
        OR
        (loyalty_transaction_type = 'ADJUST')
    ),

    FOREIGN KEY (customer_id)
        REFERENCES Customers(customer_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    FOREIGN KEY (purchase_id)
        REFERENCES Purchases(purchase_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

-- Customers receive receipts for their purchases
CREATE TABLE IF NOT EXISTS Receipts (
    receipt_id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL UNIQUE,
    receipt_number TEXT NOT NULL UNIQUE,
    receipt_created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (purchase_id)
        REFERENCES Purchases(purchase_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

-- BarCodes can be found on products
CREATE TABLE IF NOT EXISTS BarCodes (
    barcode_id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    barcode_value TEXT NOT NULL UNIQUE
        CHECK (length(barcode_value) <= 13),
    barcode_created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (product_id)
        REFERENCES Products(product_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

-- Products are equipped with RFID tags to all selfcheckout
CREATE TABLE IF NOT EXISTS ProductTags (
    product_tag_id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    product_tag_epc TEXT NOT NULL UNIQUE
        CHECK (length(product_tag_epc) <= 24),
    product_tag_status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (product_tag_status IN ('ACTIVE', 'INACTIVE')),
    product_tag_created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (product_id)
        REFERENCES Products(product_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS SessionItems (
    session_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    session_item_quantity INTEGER NOT NULL DEFAULT 1
        CHECK (session_item_quantity > 0),

    UNIQUE (session_id, product_id),

    FOREIGN KEY (session_id)
        REFERENCES SelfCheckoutSessions(session_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    FOREIGN KEY (product_id)
        REFERENCES Products(product_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

-- Alerts are dire notifications meant only for staff and admin.
CREATE TABLE IF NOT EXISTS Alerts (
    alert_id INTEGER PRIMARY KEY AUTOINCREMENT,
    reading_id INTEGER NOT NULL,
    alert_type TEXT NOT NULL
        CHECK (alert_type IN ('TEMPERATURE', 'HUMIDITY', 'SYSTEM')),
    alert_condition TEXT NOT NULL,
    alert_value REAL,
    alert_message TEXT NOT NULL,
    alert_status TEXT NOT NULL DEFAULT 'UNACKNOWLEDGED'
        CHECK (alert_status IN ('UNACKNOWLEDGED', 'ACKNOWLEDGED', 'RESOLVED')),
    alert_created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    alert_acknowledged_at TEXT,
    alert_resolved_at TEXT,
    alert_acknowledged_by INTEGER,

    FOREIGN KEY (reading_id)
        REFERENCES Readings(reading_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    FOREIGN KEY (alert_acknowledged_by)
        REFERENCES Users(user_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ProductTagSales (
    product_tag_sale_id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_tag_id INTEGER NOT NULL UNIQUE,
    purchase_item_id INTEGER NOT NULL,
    product_tag_sale_created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (product_tag_id)
        REFERENCES ProductTags(product_tag_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    FOREIGN KEY (purchase_item_id)
        REFERENCES PurchaseItems(purchase_item_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS RewardRedemptions (
    redemption_id INTEGER PRIMARY KEY AUTOINCREMENT,
    reward_id INTEGER NOT NULL,
    loyalty_transaction_id INTEGER NOT NULL UNIQUE,
    redemption_status TEXT NOT NULL DEFAULT 'COMPLETED'
        CHECK (redemption_status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
    redemption_created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (reward_id)
        REFERENCES Rewards(reward_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    FOREIGN KEY (loyalty_transaction_id)
        REFERENCES LoyaltyTransactions(loyalty_transaction_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

-- Notifications refers to content sent to customers and users
CREATE TABLE IF NOT EXISTS Notifications (
    notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    alert_id INTEGER,
    notification_type TEXT NOT NULL
        CHECK (notification_type IN ('EMAIL', 'SYSTEM', 'ALERT')),
    notification_title TEXT NOT NULL,
    notification_summary TEXT,
    notification_message_brief TEXT NOT NULL,
    notification_message_full TEXT NOT NULL,
    notification_status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (notification_status IN ('PENDING', 'SENT', 'READ', 'FAILED')),
    notification_created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notification_sent_at TEXT,
    notification_read_at TEXT,

    FOREIGN KEY (user_id)
        REFERENCES Users(user_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    FOREIGN KEY (alert_id)
        REFERENCES Alerts(alert_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS StockReceipts (
    stock_receipt_id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_receipt_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    stock_receipt_supplier TEXT
);

CREATE TABLE IF NOT EXISTS StockReceiptItems (
    stock_receipt_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_receipt_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    stock_receipt_item_quantity INTEGER NOT NULL
        CHECK (stock_receipt_item_quantity > 0),

    UNIQUE (stock_receipt_id, product_id),

    FOREIGN KEY (stock_receipt_id)
        REFERENCES StockReceipts(stock_receipt_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    FOREIGN KEY (product_id)
        REFERENCES Products(product_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

INSERT OR IGNORE INTO MembershipTiers (
    membership_tier_name,
    membership_tier_min_points
)
VALUES
    ('Iron', 0),
    ('Bronze', 100),
    ('Silver', 250),
    ('Gold', 500),
    ('Platinum', 1000),
    ('Emerald', 2500),
    ('Diamond', 5000),
    ('Master', 7500),
    ('Grandmaster', 10000),
    ('Challenger', 25000);

CREATE TRIGGER IF NOT EXISTS update_customer_membership_tier
AFTER UPDATE OF customer_membership_points ON CustomerMemberships
FOR EACH ROW
BEGIN
    UPDATE CustomerMemberships
    SET
        membership_tier_id = (
            SELECT membership_tier_id
            FROM MembershipTiers
            WHERE membership_tier_min_points <= NEW.customer_membership_points
            ORDER BY membership_tier_min_points DESC
            LIMIT 1
        ),
        customer_membership_updated_at = CURRENT_TIMESTAMP
    WHERE customer_membership_id = NEW.customer_membership_id;
END;


CREATE TRIGGER IF NOT EXISTS set_initial_customer_membership_tier
AFTER INSERT ON CustomerMemberships
FOR EACH ROW
BEGIN
    UPDATE CustomerMemberships
    SET
        membership_tier_id = (
            SELECT membership_tier_id
            FROM MembershipTiers
            WHERE membership_tier_min_points <= NEW.customer_membership_points
            ORDER BY membership_tier_min_points DESC
            LIMIT 1
        )
    WHERE customer_membership_id = NEW.customer_membership_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_product_tag_sale_validate
BEFORE INSERT ON ProductTagSales
FOR EACH ROW
WHEN (
    SELECT product_id
    FROM ProductTags
    WHERE product_tag_id = NEW.product_tag_id
) <> (
    SELECT product_id
    FROM PurchaseItems
    WHERE purchase_item_id = NEW.purchase_item_id
)
BEGIN
    SELECT RAISE(ABORT, 'Product tag and purchase item must belong to the same product');
END;

CREATE TRIGGER IF NOT EXISTS trg_product_tag_sale_update_validate
BEFORE UPDATE OF product_tag_id, purchase_item_id ON ProductTagSales
FOR EACH ROW
WHEN (
    SELECT product_id
    FROM ProductTags
    WHERE product_tag_id = NEW.product_tag_id
) <> (
    SELECT product_id
    FROM PurchaseItems
    WHERE purchase_item_id = NEW.purchase_item_id
)
BEGIN
    SELECT RAISE(ABORT, 'Product tag and purchase item must belong to the same product');
END;

CREATE INDEX IF NOT EXISTS idx_customers_user
    ON Customers(user_id);

CREATE INDEX IF NOT EXISTS idx_products_category
    ON Products(category_id);

CREATE INDEX IF NOT EXISTS idx_barcodes_product
    ON BarCodes(product_id);

CREATE INDEX IF NOT EXISTS idx_product_tags_product_status
    ON ProductTags(product_id, product_tag_status);

CREATE INDEX IF NOT EXISTS idx_product_tag_sales_purchase_item
    ON ProductTagSales(purchase_item_id);

CREATE INDEX IF NOT EXISTS idx_session_items_session
    ON SessionItems(session_id);

CREATE INDEX IF NOT EXISTS idx_purchases_customer_date
    ON Purchases(customer_id, purchase_created_at);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase
    ON PurchaseItems(purchase_id);

CREATE INDEX IF NOT EXISTS idx_purchase_items_product
    ON PurchaseItems(product_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_customer_date
    ON LoyaltyTransactions(customer_id, loyalty_transaction_created_at);

CREATE INDEX IF NOT EXISTS idx_loyalty_purchase
    ON LoyaltyTransactions(purchase_id);

CREATE INDEX IF NOT EXISTS idx_redemptions_reward
    ON RewardRedemptions(reward_id);

CREATE INDEX IF NOT EXISTS idx_readings_fridge_date
    ON Readings(fridge_id, reading_created_at);

CREATE INDEX IF NOT EXISTS idx_alerts_reading
    ON Alerts(reading_id);

CREATE INDEX IF NOT EXISTS idx_alerts_status
    ON Alerts(alert_status);

CREATE INDEX IF NOT EXISTS idx_notifications_user_status
    ON Notifications(user_id, notification_status);

CREATE INDEX IF NOT EXISTS idx_notifications_alert
    ON Notifications(alert_id);

CREATE INDEX IF NOT EXISTS idx_stock_receipts_date
    ON StockReceipts(stock_receipt_date);

CREATE INDEX IF NOT EXISTS idx_stock_receipt_items_receipt
    ON StockReceiptItems(stock_receipt_id);

CREATE INDEX IF NOT EXISTS idx_stock_receipt_items_product
    ON StockReceiptItems(product_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_earn_per_purchase
    ON LoyaltyTransactions(purchase_id)
    WHERE purchase_id IS NOT NULL
      AND loyalty_transaction_type = 'EARN';

CREATE VIEW IF NOT EXISTS CustomerLoyaltyBalances AS
SELECT
    Customers.customer_id,
    Customers.user_id,
    COALESCE(SUM(LoyaltyTransactions.loyalty_points_change), 0)
        AS customer_loyalty_points
FROM Customers
LEFT JOIN LoyaltyTransactions
    ON Customers.customer_id = LoyaltyTransactions.customer_id
GROUP BY
    Customers.customer_id,
    Customers.user_id;


COMMIT;