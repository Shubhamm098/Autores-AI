const express = require('express');
const cors = require('cors');
const { initSchema } = require('./db/client');

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/cart', require('./routes/cart'));

// Health
app.get('/health', (req, res) => res.json({ status: 'ok', app: 'ecommerce-app' }));

if (require.main === module) {
  const PORT = process.env.DEMO_APP_PORT || 3002;
  initSchema().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 E-Commerce API running on port ${PORT}`);
    });
  });
}

module.exports = app;