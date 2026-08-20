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
    // Check if quantity is greater than 0 before performing division
    if (quantity > 0) {
      const discount = 100 / quantity; // discount per item
      const total_price = quantity * unit_price - discount;
      // ... rest of the code remains the same ...
    } else {
      // Handle the case when quantity is not greater than 0
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;