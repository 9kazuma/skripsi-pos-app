CREATE DATABASE IF NOT EXISTS umkm_pos;
USE umkm_pos;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('owner', 'manager', 'cashier') NOT NULL,
  email VARCHAR(100) NULL,
  whatsapp VARCHAR(30) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NULL,

  base_name VARCHAR(120) NULL,
  variant_name VARCHAR(120) NULL,
  category_name VARCHAR(120) NULL,

  name VARCHAR(120) NULL,
  sku VARCHAR(50) NULL UNIQUE,

  sell_unit VARCHAR(50) NULL,
  sell_price DECIMAL(12,2) NOT NULL,

  buy_unit VARCHAR(50) NULL,
  buy_price DECIMAL(12,2) DEFAULT 0,
  cost_price DECIMAL(12,2) DEFAULT 0,

  stock INT DEFAULT 0,
  minimum_stock INT DEFAULT 5,

  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE product_stocks (
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

CREATE TABLE activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  user_name VARCHAR(120) NULL,
  role VARCHAR(50) NULL,
  action_type VARCHAR(100) NULL,
  action VARCHAR(100) NULL,
  activity_type VARCHAR(100) NULL,
  description TEXT NOT NULL,
  entity_type VARCHAR(100) NULL,
  entity_id INT NULL,
  related_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE stock_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  location_id INT NULL,
  type ENUM('IN', 'OUT', 'ADJUSTMENT') NOT NULL,
  quantity INT NOT NULL,
  unit_cost DECIMAL(12,2) DEFAULT 0,
  supplier_name VARCHAR(120) NULL,
  note TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_stock_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_stock_location FOREIGN KEY (location_id) REFERENCES locations(id),
  CONSTRAINT fk_stock_user FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cashier_id INT NOT NULL,
  location_id INT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  payment_amount DECIMAL(12,2) NOT NULL,
  change_amount DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR(30) DEFAULT 'cash',
  payment_status VARCHAR(30) DEFAULT 'confirmed',
  proof_type VARCHAR(30) DEFAULT 'none',
  payment_proof_name VARCHAR(255) NULL,
  payment_proof_data LONGTEXT NULL,
  qris_reference VARCHAR(100) NULL,
  qris_confirmed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sales_user FOREIGN KEY (cashier_id) REFERENCES users(id),
  CONSTRAINT fk_sales_location FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE TABLE sale_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_sale_items_sale FOREIGN KEY (sale_id) REFERENCES sales(id),
  CONSTRAINT fk_sale_items_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE stock_adjustments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  location_id INT NULL,
  old_stock INT NOT NULL,
  new_stock INT NOT NULL,
  difference INT NOT NULL,
  reason TEXT NOT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_adjust_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_adjust_location FOREIGN KEY (location_id) REFERENCES locations(id),
  CONSTRAINT fk_adjust_user FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE sales_targets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  target_year INT NOT NULL UNIQUE,
  annual_target_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO categories (name) VALUES ('Minuman'), ('Makanan'), ('Snack');

INSERT INTO locations (name) VALUES ('Alam Sutera'), ('Kemang');

-- password for all starter users: password123
INSERT INTO users (name, username, password_hash, role, email, whatsapp) VALUES
('Owner UMKM', 'admin', 'password123', 'owner', 'owner@umkm.com', '085123412312'),
('Manager UMKM', 'manager', 'password123', 'manager', 'manager@umkm.com', NULL),
('Kasir 1', 'cashier', 'password123', 'cashier', NULL, NULL);

INSERT INTO products (
  category_id,
  base_name,
  variant_name,
  category_name,
  name,
  sku,
  sell_unit,
  sell_price,
  buy_unit,
  buy_price,
  cost_price,
  stock,
  minimum_stock,
  is_active
) VALUES
(1, 'Es Teh Manis', '', 'Minuman', 'Es Teh Manis', 'SKU-001', 'gelas', 5000, 'gelas', 3000, 3000, 40, 5, 1),
(2, 'Nasi Goreng', 'Biasa', 'Makanan', 'Nasi Goreng Biasa', 'SKU-002', 'piring', 18000, 'piring', 12000, 12000, 20, 5, 1),
(3, 'Keripik Singkong', '', 'Snack', 'Keripik Singkong', 'SKU-003', 'pcs', 7000, 'pcs', 4000, 4000, 35, 5, 1);

INSERT INTO sales_targets (target_year, annual_target_amount, created_by) VALUES
(YEAR(CURDATE()), 2000000000, 1);


INSERT INTO product_stocks (product_id, location_id, stock, minimum_stock)
SELECT p.id, l.id,
  CASE
    WHEN l.name = 'Alam Sutera' THEN p.stock
    WHEN l.name = 'Kemang' THEN GREATEST(FLOOR(p.stock / 2), 0)
    ELSE 0
  END,
  p.minimum_stock
FROM products p
CROSS JOIN locations l
ON DUPLICATE KEY UPDATE
  stock = VALUES(stock),
  minimum_stock = VALUES(minimum_stock);
