const inventoryService = require('../services/inventoryService');
const stockAdjustmentService = require('../services/stockAdjustmentService');
const productService = require('../services/productService');
const { successResponse, errorResponse } = require('../utils/response');
const { logActivity } = require('../services/activityLogService');

exports.addStock = async (req, res) => {
  try {
    const { product_id, quantity, supplier_name, unit_cost, location_id } = req.body;

    if (!product_id || !quantity || Number(quantity) <= 0) {
      return errorResponse(res, 'Valid product and quantity are required', 400);
    }

    const product = await productService.getProductById(product_id, location_id);

    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    const finalUnitCost =
      unit_cost !== undefined && unit_cost !== null && unit_cost !== ''
        ? Number(unit_cost)
        : Number(product.buy_price || 0);

    await inventoryService.addStock({
      product_id,
      location_id,
      quantity: Number(quantity),
      supplier_name: supplier_name || null,
      unit_cost: finalUnitCost,
      created_by: req.user.id,
    });

    await logActivity({
      user_id: req.user.id,
      action_type: 'PURCHASE_STOCK',
      description: `Membeli/restock produk ${product.name} sebanyak ${quantity} di ${product.location_name || 'lokasi utama'}`,
      related_id: product_id,
    });

    return successResponse(res, 'Stock added successfully');
  } catch (error) {
    return errorResponse(res, error.message || 'Failed to add stock');
  }
};

exports.adjustStock = async (req, res) => {
  try {
    const { product_id, new_stock, reason, location_id } = req.body;

    if (!product_id || new_stock === undefined || !reason) {
      return errorResponse(res, 'Product, new stock, and reason are required', 400);
    }

    const product = await productService.getProductById(product_id, location_id);

    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    const oldStock = Number(product.stock || 0);
    const nextStock = Number(new_stock);

    if (nextStock < 0) {
      return errorResponse(res, 'New stock cannot be negative', 400);
    }

    const difference = nextStock - oldStock;

    await stockAdjustmentService.adjustStock({
      product_id: Number(product_id),
      location_id,
      old_stock: oldStock,
      new_stock: nextStock,
      difference,
      reason,
      created_by: req.user.id,
    });

    await logActivity({
      user_id: req.user.id,
      action_type: 'STOCK_ADJUSTMENT',
      description: `Menyesuaikan stok ${product.name} di ${product.location_name || 'lokasi utama'} dari ${oldStock} ke ${nextStock}`,
      related_id: product_id,
    });

    return successResponse(res, 'Stock adjusted successfully');
  } catch (error) {
    return errorResponse(res, error.message || 'Failed to adjust stock');
  }
};