const request = require('supertest');
const express = require('express');
const cartRouter = require('../src/routes/cart');

const app = express();
app.use(express.json());
app.use('/api/cart', cartRouter);

// Mock the Postgres Database to prevent real connections during tests
jest.mock('../src/db/client', () => ({
  pool: { query: jest.fn() }
}));
const { pool } = require('../src/db/client');

describe('E-Commerce Cart Tests', () => {
  beforeEach(() => { 
    jest.clearAllMocks(); 
  });

  test('Checkout rejects empty cart', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); 
    const res = await request(app).post('/api/cart/checkout').send({ cart_id: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Cart is empty');
  });

  test('Discount calculation does not improperly truncate using Math.floor', async () => {
    // If the buggy code runs: 10.99 * 15% discount = 1.64. Math.floor makes it 1.
    // 10.99 - 1 = 9.99 (This is the bug!)
    const res = await request(app).post('/api/cart/discount').send({ original_price: 10.99, discount_pct: 15 });
    
    expect(res.status).toBe(200);
    // The test requires that the AI fixes the code so it no longer mathematically equals 9.99!
    expect(res.body.finalPrice).not.toBe(9.99);
  });
});
