const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { runPipeline } = require('../../agents/orchestrator');
const { createLogger } = require('../../agents/logger');
const log = createLogger('API');

const prisma = new PrismaClient();

// In-memory store for pipeline context (sandboxPath, fixResult, etc.) keyed by ticketId
const pipelineContext = new Map();

// GET /api/tickets - List all tickets with latest agent run
router.get('/', async (req, res) => {
  try {
    const tickets = await prisma.ticket.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        agentRuns: { orderBy: { createdAt: 'desc' }, take: 1 },
        resolutions: { orderBy: { createdAt: 'desc' }, take: 1 },
        hitlApprovals: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    res.json({ tickets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tickets/:id - Get full ticket details
router.get('/:id', async (req, res) => {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: {
        agentRuns: { orderBy: { createdAt: 'asc' } },
        resolutions: { orderBy: { createdAt: 'desc' } },
        hitlApprovals: { orderBy: { createdAt: 'desc' } },
        sandboxSessions: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ ticket });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tickets - Create and immediately run pipeline
router.post('/', async (req, res) => {
  const { title, description, stackTrace, severity, service, affectedUrl, reportedBy } = req.body;
  if (!title || !description || !service)
    return res.status(400).json({ error: 'title, description, service required' });

  try {
    const ticket = await prisma.ticket.create({
      data: { title, description, stackTrace, severity: severity || 'MEDIUM', service, affectedUrl, reportedBy: reportedBy || 'user' },
    });

    const io = req.app.get('io');
    const emit = (event, data) => io.emit(event, data);

    // Run pipeline asynchronously
    runPipeline(ticket, emit).then((ctx) => {
      pipelineContext.set(ticket.id, ctx);
    }).catch(console.error);

    res.status(201).json({ ticket, message: 'Pipeline started' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tickets/:id/run - Re-run pipeline for existing ticket
router.post('/:id/run', async (req, res) => {
  log.step('POST /:id/run', `ticketId=${req.params.id}`);
  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
    if (!ticket) {
      log.warn(`Ticket not found`, req.params.id);
      return res.status(404).json({ error: 'Ticket not found' });
    }

    log.info(`Current ticket status: ${ticket.status}`, { title: ticket.title });

    // Clean up previous runs so the timeline starts fresh
    // Order matters: hitlApproval references resolution, so delete it first
    log.info(`Cleaning up previous runs...`);
    const deletedApprovals = await prisma.hitlApproval.deleteMany({ where: { ticketId: ticket.id } });
    const deletedResolutions = await prisma.resolution.deleteMany({ where: { ticketId: ticket.id } });
    const deletedRuns = await prisma.agentRun.deleteMany({ where: { ticketId: ticket.id } });
    const deletedSandboxes = await prisma.sandboxSession.deleteMany({ where: { ticketId: ticket.id } });
    log.info(`Cleanup complete`, { deletedApprovals: deletedApprovals.count, deletedResolutions: deletedResolutions.count, deletedRuns: deletedRuns.count, deletedSandboxes: deletedSandboxes.count });

    // Reset status to OPEN
    const freshTicket = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: 'OPEN', resolvedAt: null },
    });
    log.info(`Ticket reset to OPEN`, { ticketId: freshTicket.id });

    const io = req.app.get('io');
    const emit = (event, data) => io.emit(event, data);

    log.info(`Launching pipeline asynchronously...`);
    runPipeline(freshTicket, emit).then((ctx) => {
      log.info(`Pipeline finished`, { ticketId: ticket.id, status: ctx?.status });
      pipelineContext.set(ticket.id, ctx);
    }).catch((err) => {
      log.error(`Pipeline crashed!`, { ticketId: ticket.id, error: err.message, stack: err.stack?.split('\n').slice(0, 3).join('\n') });
      // Make sure the ticket is marked FAILED if pipeline crashes
      prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'FAILED' } }).catch(() => {});
      io.emit('agent:update', { ticketId: ticket.id, step: 'pipeline:error', data: { message: err.message }, timestamp: new Date().toISOString() });
    });

    res.json({ message: 'Pipeline re-started', ticketId: ticket.id });
  } catch (err) {
    log.error(`Route handler error`, { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Export context for use by approval route
module.exports = router;
module.exports.pipelineContext = pipelineContext;
