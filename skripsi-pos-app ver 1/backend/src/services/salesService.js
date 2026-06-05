const pool = require('../config/db');

exports.createSale = async ({ cashier_id, items, payment_amount, payment_method = 'cash' }) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let total_amount = 0;

    for (const item of items) {
      const [productRows] = await connection.execute(
        'SELECT * FROM products WHERE id = ? LIMIT 1',
        [item.product_id]
      );

      if (productRows.length === 0) {
        throw new Error(`Product ID ${item.product_id} not found`);
      }

      const product = productRows[0];

      if (product.stock < item.quantity) {
        throw new Error(`Stock not enough for ${product.name}`);
      }

      total_amount += product.sell_price * item.quantity;
    }

    if (payment_amount < total_amount) {
      throw new Error('Payment is less than total amount');
    }

    const change_amount = payment_amount - total_amount;

    const [saleResult] = await connection.execute(
      `INSERT INTO sales (cashier_id, total_amount, payment_amount, change_amount, payment_method)
       VALUES (?, ?, ?, ?, ?)`,
      [cashier_id, total_amount, payment_amount, change_amount, payment_method]
    );

    const sale_id = saleResult.insertId;

    for (const item of items) {
      const [productRows] = await connection.execute(
        'SELECT * FROM products WHERE id = ? LIMIT 1',
        [item.product_id]
      );

      const product = productRows[0];
      const unit_price = product.sell_price;
      const subtotal = unit_price * item.quantity;

      await connection.execute(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [sale_id, item.product_id, item.quantity, unit_price, subtotal]
      );

      await connection.execute(
        `UPDATE products SET stock = stock - ? WHERE id = ?`,
        [item.quantity, item.product_id]
      );
    }

    await connection.commit();

    return {
      sale_id,
      total_amount,
      payment_amount,
      change_amount,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};