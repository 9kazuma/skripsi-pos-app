const productService = require('../services/productService');
const { successResponse, errorResponse } = require('../utils/response');
const { logActivity } = require('../services/activityLogService');

function buildDisplayName(baseName, variantName) {
  const base = String(baseName || '').trim();
  const variant = String(variantName || '').trim();

  if (!variant) return base;
  return `${base} ${variant}`;
}

exports.getLocations = async (_req, res) => {
  try {
    const locations = await productService.getLocations();
    return successResponse(res, 'Locations fetched successfully', locations);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch locations');
  }
};

exports.getProducts = async (req, res) => {
  try {
    const products = await productService.getAllProducts(req.query.location_id);
    return successResponse(res, 'Products fetched successfully', products);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch products');
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await productService.getProductById(req.params.id, req.query.location_id);

    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    return successResponse(res, 'Product fetched successfully', product);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch product');
  }
};

exports.createProduct = async (req, res) => {
  try {
    const {
      base_name,
      variant_name,
      category_name,
      sell_unit,
      sell_price,
      buy_unit,
      buy_price,
      stock,
      minimum_stock,
      location_id,
    } = req.body;

    if (!base_name || !sell_unit || !sell_price || !buy_unit || !buy_price) {
      return errorResponse(
        res,
        'Base name, sell unit, sell price, buy unit, and buy price are required',
        400
      );
    }

    const displayName = buildDisplayName(base_name, variant_name);

    const productId = await productService.createProduct({
      name: displayName,
      base_name,
      variant_name,
      category_name,
      sell_unit,
      sell_price,
      buy_unit,
      buy_price,
      stock: Number(stock || 0),
      minimum_stock: Number(minimum_stock || 5),
      sku: null,
      location_id,
    });

    await logActivity({
      user_id: req.user.id,
      action_type: 'CREATE_PRODUCT',
      description: `Menambah produk baru: ${displayName}`,
      related_id: productId,
    });

    return successResponse(res, 'Product created successfully', { id: productId }, 201);
  } catch (error) {
    return errorResponse(res, error.message || 'Failed to create product');
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const {
      base_name,
      variant_name,
      category_name,
      sell_unit,
      sell_price,
      buy_unit,
      buy_price,
      stock,
      minimum_stock,
      location_id,
    } = req.body;

    if (!base_name || !sell_unit || !sell_price || !buy_unit || !buy_price) {
      return errorResponse(
        res,
        'Base name, sell unit, sell price, buy unit, and buy price are required',
        400
      );
    }

    const displayName = buildDisplayName(base_name, variant_name);

    await productService.updateProduct(req.params.id, {
      name: displayName,
      base_name,
      variant_name,
      category_name,
      sell_unit,
      sell_price,
      buy_unit,
      buy_price,
      stock: Number(stock || 0),
      minimum_stock: Number(minimum_stock || 5),
      sku: null,
      location_id,
    });

    await logActivity({
      user_id: req.user.id,
      action_type: 'UPDATE_PRODUCT',
      description: `Mengubah produk ID ${req.params.id}: ${displayName}`,
      related_id: req.params.id,
    });

    return successResponse(res, 'Product updated successfully');
  } catch (error) {
    return errorResponse(res, error.message || 'Failed to update product');
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    await productService.softDeleteProduct(req.params.id);

    await logActivity({
      user_id: req.user.id,
      action_type: 'DELETE_PRODUCT',
      description: `Menghapus/nonaktifkan produk ID ${req.params.id}`,
      related_id: req.params.id,
    });

    return successResponse(res, 'Product removed successfully');
  } catch (error) {
    return errorResponse(res, 'Failed to remove product');
  }
};