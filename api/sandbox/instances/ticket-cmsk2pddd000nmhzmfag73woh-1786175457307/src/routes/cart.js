const express = require('express');
const router = express.Router();
const { pool } = require('../db/client');

// GET /api/cart/:userId
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    let cartRes = await pool.query("SELECT * FROM ecom_carts WHERE user_id = $1 AND status = 'active'", [userId]);
    if (cartRes.rows.length === 0) {
      cartRes = await pool.query("INSERT INTO ecom_carts (user_id) VALUES ($1) RETURNING *", [userId]);
    }
    const cart = cartRes.rows[0];
    const itemsRes = await pool.query("SELECT * FROM ecom_cart_items WHERE cart_id = $1", [cart.id]);
    res.json({ cart, items: itemsRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cart/checkout
// BUG 1: Concurrency issue/race condition on stock check
router.post('/checkout', async (req, res) => {
  const { cart_id } = req.body;
  try {
    const itemsRes = await pool.query("SELECT * FROM ecom_cart_items WHERE cart_id = $1", [cart_id]);
    const items = itemsRes.rows;
    
    if (items.length === 0) return res.status(400).json({ error: 'Cart is empty' });

    let totalAmount = 0;
    
    // Check stock for all items
    for (const item of items) {
      const prodRes = await pool.query("SELECT stock_quantity, price FROM ecom_products WHERE id = $1", [item.product_id]);
      const product = prodRes.rows[0];
      
      if (product.stock_quantity < item.quantity) {
        return res.status(400).json({ error: 'Insufficient stock for product ' + item.product_id });
      }
      totalAmount += parseFloat(product.price) * item.quantity;
    }

    // Process checkout (DEDUCT STOCK)
    // BUG: If two requests hit simultaneously, they both pass the stock check above, 
    // and both deduct stock, leading to negative stock!
    // The fix should be to use a transaction and SELECT ... FOR UPDATE or check stock during UPDATE.
    for (const item of items) {
      await pool.query("UPDATE ecom_products SET stock_quantity = stock_quantity - $1 WHERE id = $2", [item.quantity, item.product_id]);
    }

    const orderRes = await pool.query("INSERT INTO ecom_orders (user_id, total_amount, status) VALUES (1, $1, 'completed') RETURNING *", [totalAmount]);
    await pool.query("UPDATE ecom_carts SET status = 'completed' WHERE id = $1", [cart_id]);

    res.status(201).json({ success: true, order: orderRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cart/discount
// BUG 2: Rounding error on discount calculation
router.post('/discount', async (req, res) => {
  const { original_price, discount_pct } = req.body;
  try {
    // BUG: Math.floor can lead to incorrect pricing for edge cases like 10.99 * 0.15
    const discountAmount = Math.floor(original_price * (discount_pct / 100));
    const finalPrice = original_price - discountAmount;
    
    res.json({ finalPrice });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
