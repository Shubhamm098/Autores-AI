const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { initSchema } = require('./db/client');

const app = express();
const PORT = process.env.DEMO_APP_PORT || 3002;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/users', require('./routes/users'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/products', require('./routes/products'));
app.use('/api/inventory', require('./routes/inventory'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'autores-demo-app', version: '1.0.0', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

const start = async () => {
  try {
    await initSchema();
    app.listen(PORT, () => {
      console.log(`🚀 Demo App running on http://localhost:${PORT}`);
      console.log(`  Buggy routes ready for AutoRes AI agents!`);
    });
  } catch (err) {
    console.error('Failed to start demo app:', err);
    process.exit(1);
  }
};

start();
module.exports = app;
