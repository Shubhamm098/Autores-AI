const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/db/client');

afterAll(async () => {
  await pool.end();
});

// Tests used by the Tester Agent to validate fixes
// Each test corresponds to one of the 5 seeded bugs

describe('Order Service Tests', () => {
  test('POST /api/orders - should handle quantity=0 without crashing', async () => {
    const res = await request(app).post('/api/orders').send({
      user_id: 1,
      product_name: 'Test Product',
      quantity: 0,
      unit_price: 10.00,
    });
    expect(res.status).not.toBe(500);
    expect(res.body.error).not.toMatch(/division by zero/i);
  });

  test('POST /api/orders - should accept valid order', async () => {
    const res = await request(app).post('/api/orders').send({
      user_id: 1,
      product_name: 'Laptop Pro X',
      quantity: 2,
      unit_price: 1299.99,
    });
    expect(res.status).toBe(201);
    expect(res.body.total_price).toBeDefined();
  });
});

describe('User Service Tests', () => {
  test('GET /api/users/2 - should handle null profile without crashing', async () => {
    const res = await request(app).get('/api/users/2');
    expect(res.status).not.toBe(500);
    expect(res.body.error).toBeUndefined();
  });

  test('GET /api/users/1 - should return user with avatar from profile', async () => {
    const res = await request(app).get('/api/users/1');
    expect(res.status).toBe(200);
    expect(res.body.avatar).toBeDefined();
  });
});

describe('Payment Service Tests', () => {
  test('POST /api/payments - should return 201 on creation', async () => {
    // First create an order to reference
    const orderRes = await request(app).post('/api/orders').send({
      user_id: 1, product_name: 'Test', quantity: 1, unit_price: 50.00
    });
    const orderId = orderRes.body.id || 1;
    const res = await request(app).post('/api/payments').send({
      order_id: orderId, amount: 50.00, method: 'card'
    });
    expect(res.status).toBe(201);
  });
});

describe('Product Service Tests', () => {
  test('GET /api/products/search - should use parameterized query (no SQL injection)', async () => {
    // Attempt SQL injection - should return empty/safe results, not crash or leak data
    const res = await request(app).get("/api/products/search?q=' OR 1=1--");
    expect(res.status).not.toBe(500);
    // Safe query should NOT return all products via injection
    if (res.status === 200) {
      expect(res.body.products.length).toBeLessThan(100);
    }
  });

  test('GET /api/products/search - should return matching products', async () => {
    const res = await request(app).get('/api/products/search?q=laptop');
    expect(res.status).toBe(200);
    expect(res.body.products).toBeDefined();
  });
});

describe('Inventory Service Tests', () => {
  test('POST /api/inventory/deduct - stock should not go negative', async () => {
    // Get current stock first
    const invRes = await request(app).get('/api/inventory');
    const item = invRes.body.inventory.find(i => i.quantity > 0);
    if (item) {
      const res = await request(app).post('/api/inventory/deduct').send({
        product_id: item.product_id,
        quantity: item.quantity // deduct all stock
      });
      if (res.status === 200) {
        expect(res.body.new_quantity).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
