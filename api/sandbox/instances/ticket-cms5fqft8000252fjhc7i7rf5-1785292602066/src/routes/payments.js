const express = require('express');
const router = express.Router();
const { pool } = require('../db/client');
const crypto = require('crypto');

// GET /api/payments - List payments
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM payments ORDER BY created_at DESC');
    res.json({ payments: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payments - Create payment
// BUG: Returns 200 instead of 201 on successful creation
router.post('/', async (req, res) => {
  const { order_id, amount, method } = req.body;
  if (!order_id || !amount) return res.status(400).json({ error: 'order_id and amount required' });

  try {
    const transaction_id = crypto.randomUUID();
    const { rows } = await pool.query(
      'INSERT INTO payments (order_id, amount, method, status, transaction_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [order_id, amount, method || 'card', 'completed', transaction_id]
    );
    // Fix: Changed status code to 201 for resource creation
    res.status(201).json({ payment: rows[0], message: 'Payment processed successfully' }); // Fix: Changed status code to 201
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
