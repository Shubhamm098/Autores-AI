/**
 * Orchestrator Agent
 * The master state machine that coordinates all agents for a single ticket.
 * Emits real-time events via the provided emit function.
 */
const { analyse }     = require('./analyser');
const { scout }       = require('./code-scout');
const { generateFix, generateDiff, applyFix } = require('./fixer');
const { runTests }    = require('./tester');
const { storeSolution, findSimilar } = require('./knowledge');
const { createSandbox, destroySandbox, getSandboxFilePath } = require('./sandbox');
const { sendApprovalRequest } = require('./notifier');
const { PrismaClient } = require('@prisma/client');
const { createLogger } = require('./logger');
const path = require('path');
const fs   = require('fs');

const prisma = new PrismaClient();
const MAX_FIX_ATTEMPTS = 3;
const olog = createLogger('Orchestrator');

async function logAgentRun(ticketId, agentName, status, input, output, startTime, attempt = 1) {
  const durationMs = Date.now() - startTime;
  olog.debug(`Logging agent run to DB`, { agentName, status, durationMs });
  return prisma.agentRun.create({
    data: { ticketId, agentName, status, input, output, durationMs, attempt },
  });
}

async function updateTicketStatus(ticketId, status) {
  olog.info(`Status transition → ${status}`, { ticketId });
  return prisma.ticket.update({
    where: { id: ticketId },
    data: { status, ...(status === 'RESOLVED' ? { resolvedAt: new Date() } : {}) },
  });
}

/**
 * Run the full agent pipeline for a ticket.
 * @param {Object} ticket   - Full ticket from DB
 * @param {Function} emit   - WebSocket emit function: emit(event, data)
 */
async function runPipeline(ticket, emit = () => {}) {
  const pipelineTimer = olog.time('Full pipeline');
  olog.step('Pipeline Start', `ticket="${ticket.title}" [${ticket.id}]`);

  const log = (step, data) => {
    olog.info(`[WS] ${step}`, data);
    emit('agent:update', { ticketId: ticket.id, step, data, timestamp: new Date().toISOString() });
  };

  let sandboxSession = null;

  try {
    // ── STEP 0: Check knowledge base for similar past solutions ──
    log('knowledge:search', 'Searching knowledge base for similar resolved issues...');
    await updateTicketStatus(ticket.id, 'ANALYSING');

    const t0 = Date.now();
    const similar = await findSimilar(ticket, 0.85);
    if (similar.length > 0) {
      const match = similar[0];
      log('knowledge:match', {
        message: `Found similar issue (${(match.similarity * 100).toFixed(1)}% match)`,
        matchTitle: match.title,
        similarity: match.similarity,
      });

      // Create a resolution from the knowledge base match
      const resolution = await prisma.resolution.create({
        data: {
          ticketId: ticket.id,
          affectedFile: match.affected_file,
          diffPatch: match.diff_patch,
          fixDescription: `[Auto-resolved via Knowledge Base] ${match.fix_description}`,
          testResults: { source: 'knowledge_base', similarity: match.similarity },
          isApplied: false,
        },
      });

      // Create HITL approval request for knowledge-base match too
      const hitlApproval = await prisma.hitlApproval.create({
        data: { ticketId: ticket.id, resolutionId: resolution.id },
      });

      await updateTicketStatus(ticket.id, 'AWAITING_APPROVAL');
      log('hitl:waiting', { message: 'Knowledge base match found. Awaiting human approval.', hitlApprovalId: hitlApproval.id });
      emit('hitl:required', { ticketId: ticket.id, hitlApprovalId: hitlApproval.id, resolution, fromKnowledgeBase: true });

      // Send email
      await sendApprovalRequest({
        ticket,
        resolution: { ...resolution, affectedFile: match.affected_file, fixDescription: resolution.fixDescription },
        testResults: { success: true, passed: 0, failed: 0, tests: [], fromKnowledgeBase: true },
        hitlApprovalId: hitlApproval.id,
        dashboardUrl: process.env.NEXT_PUBLIC_API_URL?.replace(':3001', ':3000'),
      }).catch(e => console.warn('Email send failed (non-fatal):', e.message));

      return { status: 'AWAITING_APPROVAL', fromKnowledgeBase: true, hitlApprovalId: hitlApproval.id };
    }
    await logAgentRun(ticket.id, 'KnowledgeAgent', 'SUCCESS', { query: ticket.title }, { similar: [] }, t0);

    // ── STEP 1: Analyse ──
    log('analyser:start', 'Classifying bug and extracting root cause...');
    await updateTicketStatus(ticket.id, 'ANALYSING');
    const t1 = Date.now();
    const analysisResult = await analyse(ticket);
    await logAgentRun(ticket.id, 'AnalyserAgent', 'SUCCESS', { ticket: ticket.title }, analysisResult, t1);
    log('analyser:done', analysisResult);

    // ── STEP 2: Code Scout ──
    log('scout:start', 'Scanning codebase for affected file...');
    await updateTicketStatus(ticket.id, 'SCOUTING');
    const t2 = Date.now();
    const scoutResult = await scout(analysisResult);
    await logAgentRun(ticket.id, 'CodeScoutAgent', 'SUCCESS', analysisResult, {
      file: scoutResult.relativePath,
      line: scoutResult.bugLine,
    }, t2);
    log('scout:done', { file: scoutResult.relativePath, line: scoutResult.bugLine });

    // ── STEP 3: Create Sandbox ──
    log('sandbox:create', 'Creating isolated sandbox environment...');
    const sandboxResult = await createSandbox(ticket.id);
    sandboxSession = sandboxResult.sandboxPath;

    await prisma.sandboxSession.create({
      data: { ticketId: ticket.id, sandboxPath: sandboxSession, status: 'ACTIVE' },
    });

    // ── STEP 4: Fix (with retry loop) ──
    let fixResult = null;
    let testResults = null;
    let reviewerComment = null;
    let attempt = 0;
    let resolutionRecord = null;

    while (attempt < MAX_FIX_ATTEMPTS) {
      attempt++;
      log('fixer:start', `Generating fix (attempt ${attempt}/${MAX_FIX_ATTEMPTS})...`);
      await updateTicketStatus(ticket.id, 'FIXING');

      const t3 = Date.now();
      fixResult = await generateFix(scoutResult, analysisResult, ticket, reviewerComment);

      // Apply fix to sandbox
      const sandboxFile = getSandboxFilePath(sandboxSession, scoutResult.filePath);
      await applyFix(sandboxFile, fixResult);

      // Generate diff
      const diff = generateDiff(scoutResult.content, fixResult.fixedContent, scoutResult.relativePath);

      await logAgentRun(ticket.id, 'FixerAgent', 'SUCCESS', { attempt }, {
        fixDescription: fixResult.fixDescription,
        linesChanged: fixResult.linesChanged,
      }, t3, attempt);
      log('fixer:done', { fixDescription: fixResult.fixDescription });

      // ── STEP 5: Test ──
      log('tester:start', `Running test suite in sandbox (checking tests for ${scoutResult.relativePath})...`);
      await updateTicketStatus(ticket.id, 'TESTING');
      const t4 = Date.now();
      testResults = await runTests(sandboxSession, ticket, scoutResult.relativePath);
      await logAgentRun(ticket.id, 'TesterAgent', testResults.success ? 'SUCCESS' : 'FAILED',
        { sandboxPath: sandboxSession }, testResults, t4, attempt);
      log('tester:done', { passed: testResults.passed, failed: testResults.failed, success: testResults.success });

      // Store/update resolution record
      if (resolutionRecord) {
        resolutionRecord = await prisma.resolution.update({
          where: { id: resolutionRecord.id },
          data: {
            diffPatch: diff,
            fixDescription: fixResult.fixDescription,
            testResults,
            attemptNumber: attempt,
          },
        });
      } else {
        resolutionRecord = await prisma.resolution.create({
          data: {
            ticketId: ticket.id,
            affectedFile: scoutResult.relativePath,
            affectedLine: scoutResult.bugLine,
            diffPatch: diff,
            fixDescription: fixResult.fixDescription,
            testResults,
            attemptNumber: attempt,
            isApplied: false,
          },
        });
      }

      if (testResults.success) break; // Tests passed — proceed to HITL
      if (attempt < MAX_FIX_ATTEMPTS) {
        reviewerComment = `TEST SUITE FAILED (${testResults.failed}/${testResults.total} relevant tests failed):\n\n${testResults.failureSummary}\n\nPlease fix the code so that ALL of the above tests pass.`;
        olog.warn(`Fixer retry feedback (${reviewerComment.length} chars)`, reviewerComment.substring(0, 300));
        log('fixer:retry', `Tests failed. Retrying fix (${attempt}/${MAX_FIX_ATTEMPTS})...`);
      }
    }

    if (!testResults.success && attempt >= MAX_FIX_ATTEMPTS) {
      await updateTicketStatus(ticket.id, 'FAILED');
      log('orchestrator:failed', 'Max fix attempts reached without passing tests. Escalating.');
      emit('pipeline:failed', { ticketId: ticket.id, reason: 'Max attempts exceeded' });
      return { status: 'FAILED' };
    }

    // ── STEP 6: HITL Gate ──
    log('hitl:waiting', 'Tests passed. Awaiting human approval to merge fix...');
    await updateTicketStatus(ticket.id, 'AWAITING_APPROVAL');

    const hitlApproval = await prisma.hitlApproval.create({
      data: { ticketId: ticket.id, resolutionId: resolutionRecord.id },
    });

    // Send approval email
    await sendApprovalRequest({
      ticket,
      resolution: resolutionRecord,
      testResults,
      hitlApprovalId: hitlApproval.id,
      dashboardUrl: process.env.NEXT_PUBLIC_API_URL?.replace(':3001', ':3000'),
    }).catch(e => console.warn('Email send failed (non-fatal):', e.message));

    emit('hitl:required', {
      ticketId: ticket.id,
      hitlApprovalId: hitlApproval.id,
      resolution: resolutionRecord,
      testResults,
    });

    olog.info(`Pipeline complete — AWAITING_APPROVAL`, { ticketId: ticket.id, attempts: attempt });
    pipelineTimer.end('✅ SUCCESS');

    return {
      status: 'AWAITING_APPROVAL',
      hitlApprovalId: hitlApproval.id,
      resolutionId: resolutionRecord.id,
      sandboxPath: sandboxSession,
      scoutResult,
      analysisResult,
      fixResult,
    };

  } catch (err) {
    olog.error(`PIPELINE CRASHED`, { ticketId: ticket.id, error: err.message, stack: err.stack?.split('\n').slice(0, 5).join('\n') });
    pipelineTimer.end('❌ FAILED');
    await updateTicketStatus(ticket.id, 'FAILED').catch(() => {});
    emit('pipeline:error', { ticketId: ticket.id, error: err.message });
    return { status: 'ERROR', error: err.message };
  }
}

/**
 * Apply an approved fix to the main codebase and store in knowledge base.
 */
async function applyApprovedFix(ticket, resolution, analysisResult, scoutResult, fixResult) {
  // Write fix to main demo-app file
  const mainFile = path.join(__dirname, '..', resolution.affectedFile);
  if (fixResult?.fixedContent && fs.existsSync(mainFile)) {
    fs.writeFileSync(mainFile, fixResult.fixedContent, 'utf8');
  }

  // Mark resolution as applied
  await prisma.resolution.update({
    where: { id: resolution.id },
    data: { isApplied: true, appliedAt: new Date() },
  });

  await updateTicketStatus(ticket.id, 'RESOLVED');

  // Store in knowledge base
  if (analysisResult) {
    await storeSolution(ticket, analysisResult, resolution).catch(e =>
      console.warn('Knowledge base storage failed (non-fatal):', e.message)
    );
  }

  return { status: 'RESOLVED' };
}

module.exports = { runPipeline, applyApprovedFix };
