const pool = require('../config/db');
const productService = require('./productService');

exports.adjustStock = async ({
  product_id,
  location_id,
  old_stock,
  new_stock,
  difference,
  reason,
  created_by,
}) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const effectiveLocationId = await productService.getEffectiveLocationId(location_id, connection);

    await connection.execute(
      `INSERT INTO stock_adjustments (product_id, location_id, old_stock, new_stock, difference, reason, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [product_id, effectiveLocationId, old_stock, new_stock, difference, reason, created_by]
    );

    await connection.execute(
      `INSERT INTO product_stocks (product_id, location_id, stock, minimum_stock)
       VALUES (?, ?, ?, COALESCE((SELECT minimum_stock FROM products WHERE id = ?), 5))
       ON DUPLICATE KEY UPDATE stock = VALUES(stock)`,
      [product_id, effectiveLocationId, new_stock, product_id]
    );

    await connection.execute(
      `INSERT INTO stock_movements (product_id, location_id, type, quantity, unit_cost, note, created_by)
       VALUES (?, ?, 'ADJUSTMENT', ?, 0, ?, ?)`,
      [product_id, effectiveLocationId, Math.abs(difference), `Stock adjustment: ${reason}`, created_by]
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
