const express = require('express');
const router = express.Router();
const { pool } = require('../db/client');

// GET /api/products - List products
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM product ORDER BY id');
    res.json({ products: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/search?q=term - Search products
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Search query required' });

  try {
    // Fix: Use a parameterized query to prevent SQL injection
    const query = {
      text: `SELECT * FROM products WHERE name ILIKE $1 OR description ILIKE $1`,
      values: [q], // <--- FIX: Pass the search query as a parameter
    };
    const { rows } = await pool.query(query);
    res.json({ products: rows, query: q });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;