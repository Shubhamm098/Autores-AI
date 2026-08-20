const request = require('supertest');
const app = require('../src/app');
const { pool, initSchema } = require('../src/db/client');

beforeAll(async () => {
  await initSchema();
});

afterAll(async () => {
  await pool.end();
});

describe('E-Commerce Cart Tests', () => {
  // Concurrency bug test
  test('POST /api/cart/checkout - should prevent negative stock on concurrent checkouts', async () => {
    // 1. Create a product with 1 stock
    const prodRes = await pool.query("INSERT INTO ecom_products (name, price, stock_quantity) VALUES ('Limited Edition Shoe', 200, 1) RETURNING id");
    const productId = prodRes.rows[0].id;
    
    // 2. Create a cart with 1 of this product
    const cartRes = await pool.query("INSERT INTO ecom_carts (user_id) VALUES (1) RETURNING id");
    const cartId = cartRes.rows[0].id;
    await pool.query("INSERT INTO ecom_cart_items (cart_id, product_id, quantity) VALUES ($1, $2, 1)", [cartId, productId]);

    // 3. Fire TWO checkout requests simultaneously
    const req1 = request(app).post('/api/cart/checkout').send({ cart_id: cartId });
    const req2 = request(app).post('/api/cart/checkout').send({ cart_id: cartId });
    
    const [res1, res2] = await Promise.all([req1, req2]);
    
    // 4. Verify that stock didn't go below 0
    const finalStockRes = await pool.query("SELECT stock_quantity FROM ecom_products WHERE id = $1", [productId]);
    expect(finalStockRes.rows[0].stock_quantity).toBeGreaterThanOrEqual(0);
    
    // At least one request should have failed or been blocked
    const statuses = [res1.status, res2.status];
    expect(statuses).toContain(400); 
  });

  // Discount math bug test
  test('POST /api/cart/discount - should calculate discount accurately without losing precision', async () => {
    const res = await request(app).post('/api/cart/discount').send({
      original_price: 10.99,
      discount_pct: 15
    });
    
    // 10.99 * 0.15 = 1.6485. 10.99 - 1.6485 = 9.3415
    // Should be rounded properly to 9.34 instead of floor which loses decimals incorrectly
    expect(res.body.finalPrice).toBeCloseTo(9.34, 2);
  });
});
