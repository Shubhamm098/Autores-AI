const request = require('supertest');
const app = require('../src/app');
const { pool, initSchema } = require('../src/db/client');

beforeAll(async () => {
  await initSchema();
});

afterAll(async () => {
  await pool.end();
});

describe('Checkout Service Tests', () => {
  test('POST /api/cart/checkout - should prevent negative stock on concurrent checkouts', async () => {
    const prodRes = await pool.query("INSERT INTO ecom_products (name, price, stock_quantity) VALUES ('Limited Edition Shoe', 200, 1) RETURNING id");
    const productId = prodRes.rows[0].id;
    
    const cartRes = await pool.query("INSERT INTO ecom_carts (user_id) VALUES (1) RETURNING id");
    const cartId = cartRes.rows[0].id;
    await pool.query("INSERT INTO ecom_cart_items (cart_id, product_id, quantity) VALUES ($1, $2, 1)", [cartId, productId]);

    const req1 = request(app).post('/api/cart/checkout').send({ cart_id: cartId });
    const req2 = request(app).post('/api/cart/checkout').send({ cart_id: cartId });
    
    const [res1, res2] = await Promise.all([req1, req2]);
    
    const finalStockRes = await pool.query("SELECT stock_quantity FROM ecom_products WHERE id = $1", [productId]);
    expect(finalStockRes.rows[0].stock_quantity).toBeGreaterThanOrEqual(0);
    
    const statuses = [res1.status, res2.status];
    expect(statuses).toContain(400); 
  });
});
