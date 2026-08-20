const express = require('express');
const router = express.Router();
const { pool } = require('../db/client');

// GET /api/products - List products
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM products ORDER BY id');
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
    // FIX: Use parameterized query to prevent SQL injection
    const query = `SELECT * FROM products WHERE name ILIKE $1 OR description ILIKE $2`;
    const { rows } = await pool.query(query, ['%' + q + '%', '%' + q + '%']); // parameterize query
    res.json({ products: rows, query: q });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;