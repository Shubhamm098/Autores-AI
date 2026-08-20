// ecommerce-app/src/routes/cart.js
const express = require('express');
const router = express.Router();

// ... other routes ...

router.post('/discount', (req, res) => {
  const { original_price, discount_pct } = req.body;
  const discount = original_price * (discount_pct / 100);
  const finalPrice = original_price - discount;
  // Fix: Round the final price to two decimal places
  const roundedFinalPrice = Number(finalPrice.toFixed(2));
  res.json({ finalPrice: roundedFinalPrice });
});

// ... other routes ...

module.exports = router;