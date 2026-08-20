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

// Added a function to handle checkout with locking mechanism
const checkout = async (cartId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Lock the cart and product rows for update
    const cartRes = await client.query('SELECT * FROM ecom_carts WHERE id = $1 FOR UPDATE', [cartId]);
    const cart = cartRes.rows[0];
    if (!cart) {
      throw new Error('Cart not found');
    }
    const cartItemsRes = await client.query('SELECT * FROM ecom_cart_items WHERE cart_id = $1', [cartId]);
    const cartItems = cartItemsRes.rows;
    for (const item of cartItems) {
      const productRes = await client.query('SELECT * FROM ecom_products WHERE id = $1 FOR UPDATE', [item.product_id]);
      const product = productRes.rows[0];
      if (product.stock_quantity < item.quantity) {
        throw new Error('Insufficient stock');
      }
      // Update the stock quantity
      await client.query('UPDATE ecom_products SET stock_quantity = stock_quantity - $1 WHERE id = $2', [item.quantity, item.product_id]);
    }
    // Create an order
    const orderRes = await client.query('INSERT INTO ecom_orders (user_id, total_amount) VALUES ($1, $2) RETURNING id', [cart.user_id, cartItems.reduce((acc, item) => acc + item.quantity * item.price, 0)]);
    const orderId = orderRes.rows[0].id;
    // Update the cart status
    await client.query('UPDATE ecom_carts SET status = \'checked_out\' WHERE id = $1', [cartId]);
    await client.query('COMMIT');
    return { orderId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { pool, initSchema, checkout };