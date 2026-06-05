const db = require('../config/db');

exports.salesSummary = async (req, res) => {
  try {
    const { start_date, end_date, cashier_id } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'start_date and end_date are required',
      });
    }

    const whereClauses = ['DATE(created_at) BETWEEN ? AND ?'];
    const summaryParams = [start_date, end_date];
    const detailParams = [start_date, end_date];

    if (cashier_id) {
      whereClauses.push('cashier_id = ?');
      summaryParams.push(Number(cashier_id));
      detailParams.push(Number(cashier_id));
    }

    const whereSql = whereClauses.join(' AND ');

    const [summaryRows] = await db.execute(
      `SELECT COUNT(*) AS total_transactions,
              COALESCE(SUM(total_amount), 0) AS total_sales,
              COALESCE(AVG(total_amount), 0) AS average_sale
       FROM sales
       WHERE ${whereSql}`,
      summaryParams
    );

    const [detailRows] = await db.execute(
      `SELECT s.id, s.created_at, s.total_amount, s.cashier_id, u.name AS cashier_name
       FROM sales s
       JOIN users u ON u.id = s.cashier_id
       WHERE DATE(s.created_at) BETWEEN ? AND ?
       ${cashier_id ? 'AND s.cashier_id = ?' : ''}
       ORDER BY s.created_at DESC`,
      detailParams
    );

    return res.status(200).json({
      success: true,
      message: 'Report loaded successfully',
      data: {
        range: { start_date, end_date },
        filter: {
          cashier_id: cashier_id ? Number(cashier_id) : null,
        },
        summary: summaryRows[0],
        details: detailRows,
      },
    });
  } catch (error) {
    console.error('SALES SUMMARY ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load report',
    });
  }
};

exports.cashierSummary = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'start_date and end_date are required',
      });
    }

    const [rows] = await db.execute(
      `SELECT
         u.id,
         u.name AS cashier_name,
         COUNT(s.id) AS total_transactions,
         COALESCE(SUM(s.total_amount), 0) AS total_sales,
         COALESCE(AVG(s.total_amount), 0) AS average_sale
       FROM users u
       LEFT JOIN sales s
         ON s.cashier_id = u.id
         AND DATE(s.created_at) BETWEEN ? AND ?
       WHERE u.role = 'cashier'
       GROUP BY u.id, u.name
       ORDER BY total_sales DESC, u.name ASC`,
      [start_date, end_date]
    );

    return res.status(200).json({
      success: true,
      message: 'Cashier summary loaded successfully',
      data: rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load cashier summary',
    });
  }
};

exports.getCashiers = async (_req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, name
       FROM users
       WHERE role = 'cashier'
       ORDER BY name ASC`
    );

    return res.status(200).json({
      success: true,
      message: 'Cashiers loaded successfully',
      data: rows,
    });
  } catch (error) {
    console.error('GET CASHIERS ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load cashiers',
    });
  }
};

exports.getCurrentTarget = async (_req, res) => {
  try {
    const currentYear = new Date().getFullYear();

    const [[targetRow]] = await db.execute(
      `SELECT annual_target_amount
       FROM sales_targets
       WHERE target_year = ?
       LIMIT 1`,
      [currentYear]
    );

    return res.status(200).json({
      success: true,
      message: 'Current target loaded successfully',
      data: {
        targetYear: currentYear,
        annualTarget: Number(targetRow?.annual_target_amount || 0),
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load current target',
    });
  }
};

exports.setAnnualTarget = async (req, res) => {
  try {
    const { target_year, annual_target_amount } = req.body;

    if (!target_year || annual_target_amount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'target_year and annual_target_amount are required',
      });
    }

    await db.execute(
      `INSERT INTO sales_targets (target_year, annual_target_amount, created_by)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         annual_target_amount = VALUES(annual_target_amount),
         created_by = VALUES(created_by)`,
      [target_year, annual_target_amount, req.user.id]
    );

    return res.status(200).json({
      success: true,
      message: 'Annual target saved successfully',
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save annual target',
    });
  }
};

exports.dashboard = async (req, res) => {
  try {
    const { period = 'week', cashier_period = 'month', location_id = 1 } = req.query;
    const selectedLocationId = Number(location_id || 1);

    const [[selectedLocation]] = await db.execute(
      `SELECT id, name FROM locations WHERE id = ? LIMIT 1`,
      [selectedLocationId]
    );

    let intervalCondition = 'DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)';
    let labelFormat = '%d/%m';

    if (period === 'month') {
      intervalCondition = 'DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)';
      labelFormat = '%d/%m';
    }

    if (period === 'year') {
      intervalCondition = 'DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 11 MONTH)';
      labelFormat = '%m/%Y';
    }

    let cashierSalesCondition = `
      YEAR(s.created_at) = YEAR(CURDATE())
      AND MONTH(s.created_at) = MONTH(CURDATE())
    `;

    if (cashier_period === 'day') {
      cashierSalesCondition = `DATE(s.created_at) = CURDATE()`;
    }

    if (cashier_period === 'year') {
      cashierSalesCondition = `YEAR(s.created_at) = YEAR(CURDATE())`;
    }

    const currentYear = new Date().getFullYear();

    const [[salesToday]] = await db.execute(
      `SELECT COALESCE(SUM(total_amount), 0) AS total_sales_today,
              COUNT(*) AS transactions_today
       FROM sales
       WHERE DATE(created_at) = CURDATE()`
    );

    const [[productCount]] = await db.execute(
      `SELECT COUNT(p.id) AS total_products,
              COALESCE(SUM(COALESCE(ps.stock, p.stock, 0)), 0) AS total_stock
       FROM products p
       LEFT JOIN product_stocks ps
         ON ps.product_id = p.id
        AND ps.location_id = ?
       WHERE p.is_active = 1`,
      [selectedLocationId]
    );

    const [outOfStock] = await db.execute(
      `SELECT p.id, p.name, p.base_name, p.variant_name,
              COALESCE(ps.stock, p.stock, 0) AS stock,
              COALESCE(ps.minimum_stock, p.minimum_stock, 5) AS minimum_stock
       FROM products p
       LEFT JOIN product_stocks ps
         ON ps.product_id = p.id
        AND ps.location_id = ?
       WHERE p.is_active = 1
         AND COALESCE(ps.stock, p.stock, 0) <= 0
       ORDER BY p.name ASC`,
      [selectedLocationId]
    );

    const [lowStock] = await db.execute(
      `SELECT p.id, p.name, p.base_name, p.variant_name,
              COALESCE(ps.stock, p.stock, 0) AS stock,
              COALESCE(ps.minimum_stock, p.minimum_stock, 5) AS minimum_stock
       FROM products p
       LEFT JOIN product_stocks ps
         ON ps.product_id = p.id
        AND ps.location_id = ?
       WHERE p.is_active = 1
         AND COALESCE(ps.stock, p.stock, 0) > 0
         AND COALESCE(ps.minimum_stock, p.minimum_stock, 5) > 0
         AND COALESCE(ps.stock, p.stock, 0) <= COALESCE(ps.minimum_stock, p.minimum_stock, 5)
       ORDER BY stock ASC, p.name ASC`,
      [selectedLocationId]
    );

    const [[stockDistribution]] = await db.execute(
      `SELECT
         SUM(CASE WHEN COALESCE(ps.stock, p.stock, 0) <= 0 THEN 1 ELSE 0 END) AS out_of_stock,
         SUM(CASE WHEN COALESCE(ps.stock, p.stock, 0) > 0
                   AND COALESCE(ps.minimum_stock, p.minimum_stock, 5) > 0
                   AND COALESCE(ps.stock, p.stock, 0) <= COALESCE(ps.minimum_stock, p.minimum_stock, 5) THEN 1 ELSE 0 END) AS low_stock,
         SUM(CASE WHEN COALESCE(ps.stock, p.stock, 0) > 0
                   AND (COALESCE(ps.minimum_stock, p.minimum_stock, 5) <= 0
                        OR COALESCE(ps.stock, p.stock, 0) > COALESCE(ps.minimum_stock, p.minimum_stock, 5)) THEN 1 ELSE 0 END) AS safe_stock
       FROM products p
       LEFT JOIN product_stocks ps
         ON ps.product_id = p.id
        AND ps.location_id = ?
       WHERE p.is_active = 1`,
      [selectedLocationId]
    );

    const [activityRows] = await db.execute(
      `SELECT a.id, a.action_type, a.description, a.created_at, u.name AS user_name, u.role
       FROM activity_logs a
       JOIN users u ON u.id = a.user_id
       ORDER BY a.created_at DESC
       LIMIT 30`
    );

    const stockAlertActivities = [
      ...outOfStock.map((item) => ({
        id: `stock-out-${item.id}`,
        action_type: 'STOCK_OUT_ALERT',
        description: `Stok habis: ${item.base_name || item.name}${item.variant_name ? ` - ${item.variant_name}` : ''}`,
        created_at: new Date(),
        user_name: 'Sistem',
        role: 'system',
        alert_level: 'danger',
      })),
      ...lowStock.map((item) => ({
        id: `stock-low-${item.id}`,
        action_type: 'LOW_STOCK_ALERT',
        description: `Stok menipis: ${item.base_name || item.name}${item.variant_name ? ` - ${item.variant_name}` : ''} tersisa ${item.stock}, minimum ${item.minimum_stock}`,
        created_at: new Date(),
        user_name: 'Sistem',
        role: 'system',
        alert_level: 'warning',
      })),
    ];

    const recentActivities = [
      ...stockAlertActivities,
      ...activityRows.map((item) => ({ ...item, alert_level: null })),
    ].slice(0, 30);

    const [salesTrendRaw] = await db.execute(
      `SELECT DATE_FORMAT(created_at, ?) AS label,
              COALESCE(SUM(total_amount), 0) AS total
       FROM sales
       WHERE ${intervalCondition}
       GROUP BY DATE_FORMAT(created_at, ?)
       ORDER BY MIN(created_at) ASC`,
      [labelFormat, labelFormat]
    );

    const [[dailyProfit]] = await db.execute(
      `SELECT
         COALESCE((SELECT SUM(total_amount) FROM sales WHERE DATE(created_at) = CURDATE()), 0) -
         COALESCE((SELECT SUM(quantity * unit_cost) FROM stock_movements WHERE type = 'IN' AND location_id = ? AND DATE(created_at) = CURDATE()), 0)
         AS profit_today`,
      [selectedLocationId]
    );

    const [[monthlyProfit]] = await db.execute(
      `SELECT
         COALESCE((SELECT SUM(total_amount) FROM sales WHERE YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())), 0) -
         COALESCE((SELECT SUM(quantity * unit_cost) FROM stock_movements WHERE type = 'IN' AND location_id = ? AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())), 0)
         AS profit_month`,
      [selectedLocationId]
    );

    const [[prevMonthlyProfit]] = await db.execute(
      `SELECT
         COALESCE((SELECT SUM(total_amount) FROM sales
           WHERE YEAR(created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
             AND MONTH(created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))), 0) -
         COALESCE((SELECT SUM(quantity * unit_cost) FROM stock_movements
           WHERE type = 'IN'
             AND location_id = ?
             AND YEAR(created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
             AND MONTH(created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))), 0)
         AS prev_profit_month`,
      [selectedLocationId]
    );

    const [[salesPurchaseSummary]] = await db.execute(
      `SELECT
        COALESCE((SELECT SUM(total_amount) FROM sales WHERE MONTH(created_at)=MONTH(CURDATE()) AND YEAR(created_at)=YEAR(CURDATE())), 0) AS sales_total,
        COALESCE((SELECT SUM(quantity * unit_cost) FROM stock_movements WHERE type='IN' AND location_id = ? AND MONTH(created_at)=MONTH(CURDATE()) AND YEAR(created_at)=YEAR(CURDATE())), 0) AS purchase_total`,
      [selectedLocationId]
    );

    const [[currentYearSales]] = await db.execute(
      `SELECT COALESCE(SUM(total_amount), 0) AS total
       FROM sales
       WHERE YEAR(created_at) = YEAR(CURDATE())`
    );

    const [[targetRow]] = await db.execute(
      `SELECT annual_target_amount
       FROM sales_targets
       WHERE target_year = YEAR(CURDATE())
       LIMIT 1`
    );

    const [cashierSales] = await db.execute(
      `SELECT
         u.id,
         u.name AS cashier_name,
         COALESCE(SUM(s.total_amount), 0) AS total_sales,
         COUNT(s.id) AS total_transactions
       FROM users u
       LEFT JOIN sales s
         ON s.cashier_id = u.id
         AND ${cashierSalesCondition}
       WHERE u.role = 'cashier'
       GROUP BY u.id, u.name
       ORDER BY total_sales DESC, u.name ASC`
    );

    const [bestSellers] = await db.execute(
      `SELECT
         p.id,
         p.name,
         p.base_name,
         p.variant_name,
         COALESCE(SUM(si.quantity), 0) AS total_quantity,
         COALESCE(SUM(si.total), 0) AS total_sales
       FROM sale_items si
       JOIN products p ON p.id = si.product_id
       JOIN sales s ON s.id = si.sale_id
       WHERE YEAR(s.created_at) = YEAR(CURDATE()) AND MONTH(s.created_at) = MONTH(CURDATE())
       GROUP BY p.id, p.name, p.base_name, p.variant_name
       ORDER BY total_quantity DESC, total_sales DESC
       LIMIT 5`
    );

    const annualTarget = Number(targetRow?.annual_target_amount || 0);
    const annualProgressValue = Number(currentYearSales.total || 0);
    const annualProgressPercent =
      annualTarget > 0 ? (annualProgressValue / annualTarget) * 100 : 0;

    const profitGrowth =
      Number(prevMonthlyProfit.prev_profit_month || 0) === 0
        ? null
        : ((Number(monthlyProfit.profit_month) - Number(prevMonthlyProfit.prev_profit_month)) /
            Math.abs(Number(prevMonthlyProfit.prev_profit_month))) *
          100;

    return res.status(200).json({
      success: true,
      message: 'Dashboard loaded successfully',
      data: {
        location: selectedLocation || { id: selectedLocationId, name: 'Lokasi Utama' },
        salesToday,
        productCount,
        outOfStock,
        lowStock,
        stockDistribution: {
          outOfStock: Number(stockDistribution?.out_of_stock || 0),
          lowStock: Number(stockDistribution?.low_stock || 0),
          safeStock: Number(stockDistribution?.safe_stock || 0),
        },
        recentActivities,
        salesTrend: salesTrendRaw,
        bestSellers,
        profit: {
          daily: Number(dailyProfit.profit_today || 0),
          monthly: Number(monthlyProfit.profit_month || 0),
          previousMonthly: Number(prevMonthlyProfit.prev_profit_month || 0),
          growthPercentage: profitGrowth ?? null,
        },
        salesPurchase: {
          sales: Number(salesPurchaseSummary.sales_total || 0),
          purchases: Number(salesPurchaseSummary.purchase_total || 0),
        },
        targets: {
          targetYear: currentYear,
          annualTarget,
          currentYearSales: annualProgressValue,
          annualProgressPercent,
        },
        cashierSales,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load dashboard',
    });
  }
};