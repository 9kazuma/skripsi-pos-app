const pool = require('../config/db');

async function getDefaultLocationId(connection = pool) {
  const [rows] = await connection.execute(
    `SELECT id FROM locations ORDER BY id ASC LIMIT 1`
  );
  return rows[0]?.id || 1;
}

async function getEffectiveLocationId(locationId, connection = pool) {
  if (locationId !== undefined && locationId !== null && locationId !== '') {
    return Number(locationId);
  }
  return getDefaultLocationId(connection);
}

exports.getLocations = async () => {
  const [rows] = await pool.execute(
    `SELECT id, name, created_at
     FROM locations
     ORDER BY name ASC`
  );
  return rows;
};

exports.getAllProducts = async (locationId) => {
  const effectiveLocationId = await getEffectiveLocationId(locationId);

  const [rows] = await pool.execute(
    `SELECT
       p.*,
       ? AS location_id,
       l.name AS location_name,
       COALESCE(ps.stock, p.stock, 0) AS stock,
       COALESCE(ps.minimum_stock, p.minimum_stock, 5) AS minimum_stock,
       CASE
         WHEN COALESCE(ps.stock, p.stock, 0) <= 0 THEN 'habis'
         WHEN COALESCE(ps.stock, p.stock, 0) <= COALESCE(ps.minimum_stock, p.minimum_stock, 5) THEN 'menipis'
         ELSE 'aman'
       END AS stock_status
     FROM products p
     LEFT JOIN product_stocks ps
       ON ps.product_id = p.id
      AND ps.location_id = ?
     LEFT JOIN locations l
       ON l.id = ?
     WHERE p.is_active = 1
     ORDER BY
       CASE
         WHEN COALESCE(ps.stock, p.stock, 0) <= 0 THEN 0
         WHEN COALESCE(ps.stock, p.stock, 0) <= COALESCE(ps.minimum_stock, p.minimum_stock, 5) THEN 1
         ELSE 2
       END ASC,
       p.base_name ASC,
       p.variant_name ASC,
       p.name ASC`,
    [effectiveLocationId, effectiveLocationId, effectiveLocationId]
  );

  return rows;
};

exports.getProductById = async (id, locationId) => {
  const effectiveLocationId = await getEffectiveLocationId(locationId);

  const [rows] = await pool.execute(
    `SELECT
       p.*,
       ? AS location_id,
       l.name AS location_name,
       COALESCE(ps.stock, p.stock, 0) AS stock,
       COALESCE(ps.minimum_stock, p.minimum_stock, 5) AS minimum_stock,
       CASE
         WHEN COALESCE(ps.stock, p.stock, 0) <= 0 THEN 'habis'
         WHEN COALESCE(ps.stock, p.stock, 0) <= COALESCE(ps.minimum_stock, p.minimum_stock, 5) THEN 'menipis'
         ELSE 'aman'
       END AS stock_status
     FROM products p
     LEFT JOIN product_stocks ps
       ON ps.product_id = p.id
      AND ps.location_id = ?
     LEFT JOIN locations l
       ON l.id = ?
     WHERE p.id = ? AND p.is_active = 1
     LIMIT 1`,
    [effectiveLocationId, effectiveLocationId, effectiveLocationId, id]
  );

  return rows[0] || null;
};

exports.createProduct = async ({
  name,
  base_name,
  variant_name,
  category_name,
  sell_unit,
  sell_price,
  buy_unit,
  buy_price,
  stock = 0,
  minimum_stock = 5,
  sku = null,
  location_id = null,
}) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const effectiveLocationId = await getEffectiveLocationId(location_id, connection);

    const [result] = await connection.execute(
      `INSERT INTO products
        (name, base_name, variant_name, category_name, sell_unit, sell_price, buy_unit, buy_price, stock, minimum_stock, sku)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        base_name,
        variant_name,
        category_name,
        sell_unit,
        sell_price,
        buy_unit,
        buy_price,
        stock,
        minimum_stock,
        sku,
      ]
    );

    const productId = result.insertId;

    await connection.execute(
      `INSERT INTO product_stocks (product_id, location_id, stock, minimum_stock)
       SELECT ?, id, CASE WHEN id = ? THEN ? ELSE 0 END, ?
       FROM locations`,
      [productId, effectiveLocationId, Number(stock || 0), Number(minimum_stock || 5)]
    );

    await connection.commit();
    return productId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

exports.updateProduct = async (
  id,
  {
    name,
    base_name,
    variant_name,
    category_name,
    sell_unit,
    sell_price,
    buy_unit,
    buy_price,
    stock,
    minimum_stock = 5,
    sku = null,
    location_id = null,
  }
) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const effectiveLocationId = await getEffectiveLocationId(location_id, connection);

    await connection.execute(
      `UPDATE products
       SET name = ?, base_name = ?, variant_name = ?, category_name = ?, sell_unit = ?, sell_price = ?, buy_unit = ?, buy_price = ?, minimum_stock = ?, sku = ?
       WHERE id = ?`,
      [
        name,
        base_name,
        variant_name,
        category_name,
        sell_unit,
        sell_price,
        buy_unit,
        buy_price,
        minimum_stock,
        sku,
        id,
      ]
    );

    await connection.execute(
      `INSERT INTO product_stocks (product_id, location_id, stock, minimum_stock)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         stock = VALUES(stock),
         minimum_stock = VALUES(minimum_stock)`,
      [id, effectiveLocationId, Number(stock || 0), Number(minimum_stock || 5)]
    );

    await connection.execute(
      `UPDATE products p
       SET p.stock = COALESCE((SELECT SUM(ps.stock) FROM product_stocks ps WHERE ps.product_id = p.id), 0),
           p.minimum_stock = ?
       WHERE p.id = ?`,
      [Number(minimum_stock || 5), id]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

exports.softDeleteProduct = async (id) => {
  await pool.execute(
    `UPDATE products
     SET is_active = 0
     WHERE id = ?`,
    [id]
  );
};

exports.updateStockDirectly = async (id, newStock, locationId) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const effectiveLocationId = await getEffectiveLocationId(locationId, connection);

    await connection.execute(
      `INSERT INTO product_stocks (product_id, location_id, stock, minimum_stock)
       VALUES (?, ?, ?, COALESCE((SELECT minimum_stock FROM products WHERE id = ?), 5))
       ON DUPLICATE KEY UPDATE stock = VALUES(stock)`,
      [id, effectiveLocationId, Number(newStock || 0), id]
    );

    await connection.execute(
      `UPDATE products p
       SET p.stock = COALESCE((SELECT SUM(ps.stock) FROM product_stocks ps WHERE ps.product_id = p.id), 0)
       WHERE p.id = ?`,
      [id]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

exports.getDefaultLocationId = getDefaultLocationId;
exports.getEffectiveLocationId = getEffectiveLocationId;
