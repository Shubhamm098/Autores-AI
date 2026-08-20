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
// BUG: SQL injection vulnerability - raw string interpolation
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Search query required' });

  try {
    // BUG: Direct string interpolation - SQL injection vulnerability!
    const query = `SELECT * FROM products WHERE name ILIKE '%${q}%' OR description ILIKE '%${q}%'`;
    const { rows } = await pool.query(query);
    res.json({ products: rows, query: q });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
