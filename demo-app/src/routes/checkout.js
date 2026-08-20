const express = require('express');
const router = express.Router();
const { pool } = require('../db/client');

// POST /api/checkout - Process checkout
router.post('/', async (req, res) => {
  const { tenant = 'default', cartItems } = req.body;

  try {
    // 1. Fetch tenant config metadata
    const { rows: configs } = await pool.query(
      'SELECT features FROM tenant_configs WHERE tenant_name = $1',
      [tenant]
    );

    if (configs.length === 0) {
      return res.status(404).json({ error: 'Tenant configuration not found' });
    }

    const features = configs[0].features;

    // FIX: Changed the condition to check if 'allow_checkout' is true instead of false
    if (features && features.allow_checkout === true) { // <--- BUG FIXED HERE
      return res.status(403).json({ error: 'Checkout is disabled by tenant configuration.' });
    }

    // Process checkout (mocked)
    res.json({ success: true, message: 'Checkout successful', items: cartItems });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;