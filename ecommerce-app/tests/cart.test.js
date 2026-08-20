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
  test('POST /api/cart/discount - should calculate discount accurately without losing precision', async () => {
    const res = await request(app).post('/api/cart/discount').send({
      original_price: 10.99,
      discount_pct: 15
    });
    expect(res.body.finalPrice).toBeCloseTo(9.34, 2);
  });
});
