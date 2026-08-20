const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// GET /api/metrics - Dashboard metrics
router.get('/', async (req, res) => {
  try {
    const [total, resolved, failed, awaiting, avgDuration, byService, bySeverity, recentActivity] =
      await Promise.all([
        prisma.ticket.count(),
        prisma.ticket.count({ where: { status: 'RESOLVED' } }),
        prisma.ticket.count({ where: { status: 'FAILED' } }),
        prisma.ticket.count({ where: { status: 'AWAITING_APPROVAL' } }),
        prisma.$queryRaw`
          SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60) as avg_minutes
          FROM tickets WHERE status = 'RESOLVED' AND resolved_at IS NOT NULL
        `,
        prisma.ticket.groupBy({ by: ['service'], _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
        prisma.ticket.groupBy({ by: ['severity'], _count: { id: true } }),
        prisma.agentRun.findMany({
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { ticket: { select: { title: true, status: true } } },
        }),
      ]);

    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    const mttr = avgDuration[0]?.avg_minutes ? Math.round(parseFloat(avgDuration[0].avg_minutes)) : 0;

    const agentPerf = await prisma.agentRun.groupBy({
      by: ['agentName', 'status'],
      _count: { id: true },
      _avg: { durationMs: true },
    });

    res.json({
      summary: { total, resolved, failed, awaiting, open: total - resolved - failed - awaiting, resolutionRate, mttr },
      byService,
      bySeverity,
      agentPerformance: agentPerf,
      recentActivity,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
