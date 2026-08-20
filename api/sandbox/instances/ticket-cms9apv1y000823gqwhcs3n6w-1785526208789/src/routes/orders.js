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
router.post('/', async (req, res) => {
  const { user_id, product_name, quantity, unit_price } = req.body;
  if (!user_id || !product_name || !unit_price)
    return res.status(400).json({ error: 'Missing required fields' });

  try {
    // Check if quantity is greater than zero before calculating the discount
    if (quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than zero' });
    }

    const discount = 100 / quantity; // discount per item
    const total_price = quantity * unit_price - discount;

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