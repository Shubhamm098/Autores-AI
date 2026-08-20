const express = require('express');
const router = express.Router();
const { pool } = require('../db/client');

// POST /api/checkout - Process checkout
// BUG: Depends on tenant metadata which was accidentally disabled!
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

    // BUG: If 'allow_checkout' is false in the database, this throws 403.
    // The seed data intentionally has this set to false.
    if (features && features.allow_checkout === false) {
      // Fix: Return a more informative error message instead of 403
      return res.status(400).json({ error: 'Checkout is disabled by tenant configuration. Please contact the administrator to enable it.' });
    }

    // Process checkout (mocked)
    res.json({ success: true, message: 'Checkout successful', items: cartItems });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;