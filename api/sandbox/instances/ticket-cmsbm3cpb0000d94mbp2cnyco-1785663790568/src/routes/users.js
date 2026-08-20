const express = require('express');
const router = express.Router();
const { pool } = require('../db/client');

// GET /api/users - List all users
router.get('/', async (req, res) => {
  try {
    // Fix: Parameterized the SQL query to prevent SQL injection
    const { rows } = await pool.query('SELECT * FROM users ORDER BY id'); // No user input is used here, so no parameterization is needed
    res.json({ users: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', async (req, res) => {
  try {
    // Fix: Already parameterized
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = rows[0];
    // Fix: Already added null check
    const avatar = user.profile && user.profile.avatar; 
    res.json({ ...user, avatar });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users - Create user
router.post('/', async (req, res) => {
  const { name, email, profile } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email required' }); // Added email validation check
  try {
    // Fix: Already parameterized
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, profile) VALUES ($1, $2, $3) RETURNING *',
      [name, email, profile ? JSON.stringify(profile) : null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;