// POST /api/orders - Create order
router.post('/', async (req, res) => {
  const { user_id, product_name, quantity, unit_price } = req.body;
  if (!user_id || !product_name || !unit_price)
    return res.status(400).json({ error: 'Missing required fields' });

  try {
    // Check if quantity > 0 before performing division
    if (quantity > 0) {
      const discount = 100 / quantity; // discount per item
      const total_price = quantity * unit_price - discount;

      const { rows } = await pool.query(
        'INSERT INTO orders (user_id, product_name, quantity, unit_price, total_price) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [user_id, product_name, quantity || 1, unit_price, total_price]
      );
      res.status(201).json(rows[0]);
    } else {
      // Return error if quantity is not greater than 0
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});