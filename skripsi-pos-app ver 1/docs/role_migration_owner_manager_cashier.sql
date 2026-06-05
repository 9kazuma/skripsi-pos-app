USE umkm_pos;

-- Safe migration from old roles to the new role model:
-- owner   = can see everything
-- manager = cannot access reports and cannot create/edit owner accounts
-- cashier = POS/cashier access

ALTER TABLE users
MODIFY COLUMN role ENUM('owner', 'manager', 'cashier', 'admin') NOT NULL;

-- Keep the main admin login as owner.
UPDATE users
SET role = 'owner'
WHERE username = 'admin';

-- Convert any other old admin accounts to manager.
UPDATE users
SET role = 'manager'
WHERE role = 'admin';

ALTER TABLE users
MODIFY COLUMN role ENUM('owner', 'manager', 'cashier') NOT NULL;

SELECT id, name, username, role
FROM users
ORDER BY FIELD(role, 'owner', 'manager', 'cashier'), name ASC;
