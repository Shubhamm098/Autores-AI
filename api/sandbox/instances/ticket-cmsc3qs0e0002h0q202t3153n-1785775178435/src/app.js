// routes/payments.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db/client');

// Create a new payment
router.post('/', async (req, res) => {
  try {
    const { order_id, amount, method } = req.body;
    const result = await pool.query('INSERT INTO payments (order_id, amount, method) VALUES ($1, $2, $3) RETURNING *', [order_id, amount, method]);
    res.status(201).json(result.rows[0]); // Return 201 status code
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;