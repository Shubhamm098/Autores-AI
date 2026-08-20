const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const pool = new Pool({
  connectionString: process.env.DEMO_APP_DB_URL || process.env.DATABASE_URL,
});

// Initialize demo tables
const initSchema = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        profile JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        product_name VARCHAR(255) NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2),
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        amount DECIMAL(10,2) NOT NULL,
        method VARCHAR(50) DEFAULT 'card',
        status VARCHAR(50) DEFAULT 'pending',
        transaction_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        category VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS inventory (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER NOT NULL DEFAULT 0,
        warehouse VARCHAR(100) DEFAULT 'main',
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS tenant_configs (
        id SERIAL PRIMARY KEY,
        tenant_name VARCHAR(255) NOT NULL,
        features JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS promotions (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        discount_pct DECIMAL(5,2) NOT NULL,
        min_cart_value DECIMAL(10,2) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        valid_until TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Seed some base data if empty
    const { rows } = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(rows[0].count) === 0) {
      await client.query(`
        INSERT INTO users (name, email, profile) VALUES
          ('Alice Johnson', 'alice@corp.com', '{"avatar": "alice.png", "role": "admin"}'),
          ('Bob Smith', 'bob@corp.com', NULL),
          ('Carol White', 'carol@corp.com', '{"avatar": "carol.png", "role": "user"}');

        INSERT INTO products (name, description, price, category) VALUES
          ('Laptop Pro X', 'High-performance laptop', 1299.99, 'electronics'),
          ('Wireless Mouse', 'Ergonomic wireless mouse', 49.99, 'accessories'),
          ('USB Hub', '7-port USB 3.0 hub', 39.99, 'accessories');

        INSERT INTO inventory (product_id, quantity) VALUES (1, 5), (2, 1), (3, 10);
      `);
    }

    const { rows: tenantRows } = await client.query('SELECT COUNT(*) FROM tenant_configs');
    if (parseInt(tenantRows[0].count) === 0) {
      await client.query(`
        INSERT INTO tenant_configs (tenant_name, features) VALUES 
          ('default', '{"allow_checkout": false, "require_email_verification": true}');

        INSERT INTO promotions (code, discount_pct, min_cart_value, is_active, valid_until) VALUES
          ('SUMMER2026', 15.00, 100.00, true, NOW() - INTERVAL '1 day');
      `);
    }

    console.log('✅ Demo app DB initialized');
  } finally {
    client.release();
  }
};

module.exports = { pool, initSchema };
