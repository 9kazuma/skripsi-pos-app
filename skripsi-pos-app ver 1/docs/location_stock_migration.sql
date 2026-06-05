USE umkm_pos;

CREATE TABLE IF NOT EXISTS locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO locations (id, name) VALUES
(1, 'Alam Sutera'),
(2, 'Kemang');

CREATE TABLE IF NOT EXISTS product_stocks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  location_id INT NOT NULL,
  stock INT DEFAULT 0,
  minimum_stock INT DEFAULT 5,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_product_location (product_id, location_id),
  CONSTRAINT fk_product_stocks_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_product_stocks_location FOREIGN KEY (location_id) REFERENCES locations(id)
);

INSERT INTO product_stocks (product_id, location_id, stock, minimum_stock)
SELECT p.id, l.id,
  CASE
    WHEN l.id = 1 THEN COALESCE(p.stock, 0)
    WHEN l.id = 2 THEN GREATEST(FLOOR(COALESCE(p.stock, 0) / 2), 0)
    ELSE 0
  END AS stock,
  COALESCE(p.minimum_stock, 5) AS minimum_stock
FROM products p
CROSS JOIN locations l
ON DUPLICATE KEY UPDATE
  stock = VALUES(stock),
  minimum_stock = VALUES(minimum_stock);

ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS location_id INT NULL AFTER product_id;

ALTER TABLE stock_movements
  MODIFY COLUMN type ENUM('IN', 'OUT', 'ADJUSTMENT') NOT NULL;

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS location_id INT NULL AFTER cashier_id;

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  location_id INT NULL,
  old_stock INT NOT NULL,
  new_stock INT NOT NULL,
  difference INT NOT NULL,
  reason TEXT NOT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
