const express = require('express');
const router = express.Router();
const { listAll } = require('../../agents/knowledge');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// GET /api/knowledge - List all knowledge base entries
router.get('/', async (req, res) => {
  try {
    const entries = await listAll();
    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/knowledge/:id - Get specific entry
router.get('/:id', async (req, res) => {
  try {
    const entries = await prisma.$queryRaw`
      SELECT * FROM knowledge_base WHERE id = ${req.params.id}
    `;
    if (!entries.length) return res.status(404).json({ error: 'Not found' });
    res.json({ entry: entries[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
