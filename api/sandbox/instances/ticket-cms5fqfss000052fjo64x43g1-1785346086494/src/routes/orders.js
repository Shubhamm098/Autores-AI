const express = require('express');
const router = express.Router();
const { pool } = require('../db/client');

// GET /api/orders - List orders
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json({ orders: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/orders - Create order
// BUG: Division by zero when quantity = 0
router.post('/', async (req, res) => {
  const { user_id, product_name, quantity, unit_price } = req.body;
  if (!user_id || !product_name || !unit_price)
    return res.status(400).json({ error: 'Missing required fields' });

  try {
    // Check if quantity is zero to prevent division by zero
    let discount = 0;
    let total_price;
    if (quantity === 0) {
      // If quantity is zero, set total price to zero
      total_price = 0;
    } else {
      // Calculate discount and total price if quantity is greater than zero
      discount = 100 / quantity; // discount per item
      total_price = quantity * unit_price - discount;
    }

    const { rows } = await pool.query(
      'INSERT INTO orders (user_id, product_name, quantity, unit_price, total_price) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [user_id, product_name, quantity || 1, unit_price, total_price]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;