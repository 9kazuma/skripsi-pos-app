const db = require('../config/db');

function buildQrisReference() {
  return `QRIS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

exports.createSale = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const {
      items,
      payment_amount,
      payment_method = 'cash',
      payment_proof_name = null,
      payment_proof_data = null,
      qris_auto_confirm = false,
      location_id = 1,
    } = req.body;

    const selectedLocationId = Number(location_id || 1);

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({
        success: false,
        message: 'Transaction items are required',
      });
    }

    const allowedPaymentMethods = ['cash', 'card', 'manual_transfer', 'qris'];
    if (!allowedPaymentMethods.includes(payment_method)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method',
      });
    }

    const [[locationRow]] = await connection.execute(
      'SELECT id, name FROM locations WHERE id = ? LIMIT 1',
      [selectedLocationId]
    );

    await connection.beginTransaction();

    let subtotal = 0;
    const detailedItems = [];

    for (const item of items) {
      const [products] = await connection.execute(
        `SELECT p.id, p.name, p.base_name, p.variant_name, p.sell_price,
                COALESCE(ps.stock, p.stock, 0) AS stock
         FROM products p
         LEFT JOIN product_stocks ps
           ON ps.product_id = p.id
          AND ps.location_id = ?
         WHERE p.id = ? AND p.is_active = 1
         LIMIT 1`,
        [selectedLocationId, item.product_id]
      );

      if (!products.length) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: `Product ${item.product_id} not found`,
        });
      }

      const product = products[0];
      const quantity = Number(item.quantity || 0);

      if (quantity <= 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Quantity must be greater than zero',
        });
      }

      if (Number(product.stock || 0) < quantity) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}`,
        });
      }

      const price = Number(product.sell_price);
      const total = price * quantity;
      subtotal += total;
      detailedItems.push({ product, quantity, price, total });
    }

    if (Number(payment_amount) < subtotal) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Payment amount is less than total',
      });
    }

    const qrisReference = payment_method === 'qris' ? buildQrisReference() : null;
    const qrisConfirmedAt = payment_method === 'qris' && qris_auto_confirm ? new Date() : null;
    const paymentStatus = payment_method === 'qris'
      ? qris_auto_confirm ? 'confirmed' : 'pending'
      : 'confirmed';
    const proofType = payment_method === 'qris'
      ? 'qris_auto'
      : payment_proof_data
        ? 'manual_picture'
        : 'none';

    const [saleResult] = await connection.execute(
      `INSERT INTO sales (
         cashier_id,
         location_id,
         total_amount,
         payment_amount,
         change_amount,
         payment_method,
         payment_status,
         proof_type,
         payment_proof_name,
         payment_proof_data,
         qris_reference,
         qris_confirmed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        selectedLocationId,
        subtotal,
        Number(payment_amount),
        Number(payment_amount) - subtotal,
        payment_method,
        paymentStatus,
        proofType,
        payment_proof_name || null,
        payment_proof_data || null,
        qrisReference,
        qrisConfirmedAt,
      ]
    );

    for (const item of detailedItems) {
      await connection.execute(
        `INSERT INTO sale_items (sale_id, product_id, quantity, price, total)
         VALUES (?, ?, ?, ?, ?)`,
        [saleResult.insertId, item.product.id, item.quantity, item.price, item.total]
      );

      await connection.execute(
        `INSERT INTO product_stocks (product_id, location_id, stock, minimum_stock)
         VALUES (?, ?, 0, COALESCE((SELECT minimum_stock FROM products WHERE id = ?), 5))
         ON DUPLICATE KEY UPDATE stock = stock - ?`,
        [item.product.id, selectedLocationId, item.product.id, item.quantity]
      );

      await connection.execute(
        `INSERT INTO stock_movements (product_id, location_id, type, quantity, note, created_by)
         VALUES (?, ?, 'OUT', ?, ?, ?)`,
        [item.product.id, selectedLocationId, item.quantity, `Sale #${saleResult.insertId}`, req.user.id]
      );

      await connection.execute(
        `UPDATE products p
         SET p.stock = COALESCE((SELECT SUM(ps.stock) FROM product_stocks ps WHERE ps.product_id = p.id), 0)
         WHERE p.id = ?`,
        [item.product.id]
      );
    }

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: 'Sale created successfully',
      data: {
        sale_id: saleResult.insertId,
        cashier_id: req.user.id,
        location_id: selectedLocationId,
        location_name: locationRow?.name || null,
        total_amount: subtotal,
        payment_amount: Number(payment_amount),
        change_amount: Number(payment_amount) - subtotal,
        payment_method,
        payment_status: paymentStatus,
        proof_type: proofType,
        payment_proof_name: payment_proof_name || null,
        qris_reference: qrisReference,
        qris_confirmed_at: qrisConfirmedAt,
        items: detailedItems.map((item) => ({
          product_id: item.product.id,
          product_name: `${item.product.base_name || item.product.name || 'Produk'}${
            item.product.variant_name ? ` - ${item.product.variant_name}` : ''
          }`,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
        })),
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error('CREATE SALE ERROR:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create sale',
    });
  } finally {
    connection.release();
  }
};

exports.getSalesHistory = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const whereClauses = [];
    const params = [];

    if (req.user.role === 'cashier') {
      whereClauses.push('s.cashier_id = ?');
      params.push(req.user.id);
    }

    if (start_date && end_date) {
      whereClauses.push('DATE(s.created_at) BETWEEN ? AND ?');
      params.push(start_date, end_date);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const [rows] = await db.execute(
      `SELECT
         s.id,
         s.cashier_id,
         s.location_id,
         l.name AS location_name,
         s.total_amount,
         s.payment_amount,
         s.change_amount,
         s.payment_method,
         s.payment_status,
         s.proof_type,
         s.payment_proof_name,
         s.qris_reference,
         s.qris_confirmed_at,
         s.created_at,
         u.name AS cashier_name,
         COUNT(si.id) AS total_items
       FROM sales s
       JOIN users u ON u.id = s.cashier_id
       LEFT JOIN locations l ON l.id = s.location_id
       LEFT JOIN sale_items si ON si.sale_id = s.id
       ${whereSql}
       GROUP BY
         s.id,
         s.cashier_id,
         s.location_id,
         l.name,
         s.total_amount,
         s.payment_amount,
         s.change_amount,
         s.payment_method,
         s.payment_status,
         s.proof_type,
         s.payment_proof_name,
         s.qris_reference,
         s.qris_confirmed_at,
         s.created_at,
         u.name
       ORDER BY s.created_at DESC`,
      params
    );

    return res.status(200).json({
      success: true,
      message: 'Sales history fetched successfully',
      data: rows,
    });
  } catch (error) {
    console.error('GET SALES HISTORY ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load sales history',
    });
  }
};

exports.getSaleDetail = async (req, res) => {
  try {
    const saleId = Number(req.params.id);

    const whereClauses = ['s.id = ?'];
    const params = [saleId];

    if (req.user.role === 'cashier') {
      whereClauses.push('s.cashier_id = ?');
      params.push(req.user.id);
    }

    const [[sale]] = await db.execute(
      `SELECT
         s.id,
         s.cashier_id,
         s.location_id,
         l.name AS location_name,
         s.total_amount,
         s.payment_amount,
         s.change_amount,
         s.payment_method,
         s.payment_status,
         s.proof_type,
         s.payment_proof_name,
         s.payment_proof_data,
         s.qris_reference,
         s.qris_confirmed_at,
         s.created_at,
         u.name AS cashier_name
       FROM sales s
       JOIN users u ON u.id = s.cashier_id
       LEFT JOIN locations l ON l.id = s.location_id
       WHERE ${whereClauses.join(' AND ')}
       LIMIT 1`,
      params
    );

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found',
      });
    }

    const [items] = await db.execute(
      `SELECT
         si.id,
         si.product_id,
         si.quantity,
         si.price,
         si.total,
         p.name,
         p.base_name,
         p.variant_name
       FROM sale_items si
       JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = ?
       ORDER BY si.id ASC`,
      [saleId]
    );

    return res.status(200).json({
      success: true,
      message: 'Sale detail fetched successfully',
      data: {
        sale,
        items,
      },
    });
  } catch (error) {
    console.error('GET SALE DETAIL ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load sale detail',
    });
  }
};
