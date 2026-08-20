const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DEMO_APP_DB_URL || process.env.DATABASE_URL || 'postgresql://autores:autores_secret@localhost:5432/autores_db',
});

const initSchema = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ecom_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ecom_products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS ecom_carts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES ecom_users(id),
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ecom_cart_items (
        id SERIAL PRIMARY KEY,
        cart_id INTEGER REFERENCES ecom_carts(id),
        product_id INTEGER REFERENCES ecom_products(id),
        quantity INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS ecom_orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES ecom_users(id),
        total_amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Seed data
    const { rows } = await client.query('SELECT COUNT(*) FROM ecom_users');
    if (parseInt(rows[0].count) === 0) {
      await client.query(`
        INSERT INTO ecom_users (email, password_hash) VALUES ('test@ecom.com', 'hashedpassword');
        INSERT INTO ecom_products (name, price, stock_quantity) VALUES 
          ('MacBook Air', 999.00, 10),
          ('iPhone 15', 799.00, 50),
          ('AirPods', 199.00, 100);
      `);
    }
    console.log('✅ E-Commerce DB initialized');
  } catch (err) {
    console.error('❌ E-Commerce DB init failed:', err);
  } finally {
    client.release();
  }
};

module.exports = { pool, initSchema };
