const pool = require('../config/db');
const productService = require('./productService');

exports.addStock = async ({ product_id, location_id, quantity, supplier_name, unit_cost, created_by }) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const effectiveLocationId = await productService.getEffectiveLocationId(location_id, connection);

    await connection.execute(
      `INSERT INTO stock_movements (product_id, location_id, type, quantity, unit_cost, supplier_name, created_by)
       VALUES (?, ?, 'IN', ?, ?, ?, ?)`,
      [product_id, effectiveLocationId, quantity, unit_cost, supplier_name, created_by]
    );

    await connection.execute(
      `INSERT INTO product_stocks (product_id, location_id, stock, minimum_stock)
       VALUES (?, ?, ?, COALESCE((SELECT minimum_stock FROM products WHERE id = ?), 5))
       ON DUPLICATE KEY UPDATE stock = stock + VALUES(stock)`,
      [product_id, effectiveLocationId, quantity, product_id]
    );

    await connection.execute(
      `UPDATE products p
       SET p.stock = COALESCE((SELECT SUM(ps.stock) FROM product_stocks ps WHERE ps.product_id = p.id), 0)
       WHERE p.id = ?`,
      [product_id]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
