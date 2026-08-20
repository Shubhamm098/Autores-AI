const express = require('express');
const router = express.Router();
const { pool } = require('../db/client');

// GET /api/inventory - Get all inventory
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT i.*, p.name as product_name FROM inventory i JOIN products p ON i.product_id = p.id'
    );
    res.json({ inventory: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventory/deduct - Deduct stock
// BUG: Off-by-one error — uses <= instead of < causing negative stock
router.post('/deduct', async (req, res) => {
  const { product_id, quantity } = req.body;
  if (!product_id || !quantity)
    return res.status(400).json({ error: 'product_id and quantity required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT quantity FROM inventory WHERE product_id = $1 FOR UPDATE',
      [product_id]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found in inventory' });
    }

    const current = rows[0].quantity;
    // BUG: Should be current < quantity (strict less-than) to prevent going negative
    // Using <= allows deducting when current === quantity, resulting in -1
    if (current <= 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Insufficient stock' });
    }

    const newQuantity = current - quantity; // goes to -1 when current === quantity
    await client.query(
      'UPDATE inventory SET quantity = $1, updated_at = NOW() WHERE product_id = $2',
      [newQuantity, product_id]
    );
    await client.query('COMMIT');
    res.json({ product_id, previous_quantity: current, new_quantity: newQuantity });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
