const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { applyApprovedFix } = require('../../agents/orchestrator');
const { sendResolutionNotice } = require('../../agents/notifier');
const { pipelineContext } = require('./tickets');

const prisma = new PrismaClient();

// GET /api/approvals/:id - Get approval details
router.get('/:id', async (req, res) => {
  try {
    const approval = await prisma.hitlApproval.findUnique({
      where: { id: req.params.id },
      include: { ticket: true, resolution: true },
    });
    if (!approval) return res.status(404).json({ error: 'Approval not found' });
    res.json({ approval });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/approvals/:id/decide - Submit HITL decision
router.post('/:id/decide', async (req, res) => {
  const { decision, reviewerComment, reviewerEmail } = req.body;
  const validDecisions = ['APPROVED', 'REJECTED', 'RETESTREQUEST', 'ESCALATED'];
  if (!decision || !validDecisions.includes(decision))
    return res.status(400).json({ error: `decision must be one of: ${validDecisions.join(', ')}` });

  try {
    const approval = await prisma.hitlApproval.findUnique({
      where: { id: req.params.id },
      include: { ticket: true, resolution: true },
    });
    if (!approval) return res.status(404).json({ error: 'Approval not found' });
    if (approval.decision) return res.status(409).json({ error: 'Decision already submitted' });

    // Record decision
    await prisma.hitlApproval.update({
      where: { id: req.params.id },
      data: { decision, reviewerComment, reviewerEmail, decidedAt: new Date() },
    });

    const io = req.app.get('io');
    const emit = (event, data) => io.emit(event, data);
    const ctx = pipelineContext.get(approval.ticket.id) || {};

    if (decision === 'APPROVED') {
      await applyApprovedFix(
        approval.ticket,
        approval.resolution,
        ctx.analysisResult,
        ctx.scoutResult,
        ctx.fixResult
      );
      emit('ticket:resolved', { ticketId: approval.ticket.id });
      await sendResolutionNotice({
        ticket: approval.ticket,
        decision: 'APPROVED',
        reviewerEmail: reviewerEmail || process.env.HITL_REVIEWER_EMAIL,
      }).catch(e => console.warn('Email error:', e.message));

    } else if (decision === 'REJECTED') {
      await prisma.ticket.update({ where: { id: approval.ticket.id }, data: { status: 'REJECTED' } });
      emit('ticket:rejected', { ticketId: approval.ticket.id, comment: reviewerComment });
      await sendResolutionNotice({
        ticket: approval.ticket,
        decision: 'REJECTED',
        reviewerEmail: reviewerEmail || process.env.HITL_REVIEWER_EMAIL,
      }).catch(e => console.warn('Email error:', e.message));

    } else if (decision === 'ESCALATED') {
      await prisma.ticket.update({ where: { id: approval.ticket.id }, data: { status: 'ESCALATED' } });
      emit('ticket:escalated', { ticketId: approval.ticket.id });

    } else if (decision === 'RETESTREQUEST') {
      // Re-run tester on existing sandbox
      await prisma.ticket.update({ where: { id: approval.ticket.id }, data: { status: 'TESTING' } });
      emit('ticket:retesting', { ticketId: approval.ticket.id });
    }

    res.json({ success: true, decision, ticketId: approval.ticket.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
