const { chat } = require('./groq-client');
const { z } = require('zod');
const { createLogger } = require('./logger');
const { searchKnowledgeBase } = require('./rag');
const log = createLogger('Analyser');

const BUG_TYPES = [
  'NullPointerException',
  'DivisionByZero',
  'SQLInjection',
  'WrongStatusCode',
  'OffByOneError',
  'RaceCondition',
  'MemoryLeak',
  'AuthenticationBypass',
  'ValidationError',
  'LogicError',
  'MetadataError', // Added MetadataError to BUG_TYPES
];

const AnalysisSchema = z.object({
  bugType: z.string(),
  affectedFile: z.string().nullable(),
  affectedLine: z.number().nullable(),
  keywords: z.array(z.string()),
  rootCause: z.string(),
  fixType: z.string(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  confidence: z.number().min(0).max(1),
  needsDbAccess: z.boolean().default(false)
});

async function analyse(ticket, attempt = 1, validationError = null) {
  log.step(`Attempt ${attempt}`, `Analysing ticket: "${ticket.title}" [${ticket.service}]`);
  if (validationError) {
    log.warn(`Self-correction retry due to validation error`, validationError);
  }

  // Fetch RAG Context
  const ragContextResults = await searchKnowledgeBase(ticket.title + ' ' + ticket.description, null, 3);
  let ragContextText = '';
  if (ragContextResults.length > 0) {
    ragContextText = `\n\n--- RELEVANT KNOWLEDGE BASE CONTEXT (RAG) ---\n` + 
      ragContextResults.map(r => `Type: ${r.type}\nTitle: ${r.title}\nSummary/Rule: ${r.bug_summary || r.bugSummary || ''}\nMetadata: ${JSON.stringify(r.metadata || {})}`).join('\n\n') +
      `\n---------------------------------------------\nUse this context to inform your classification and root cause analysis.`;
  }

  const prompt = [
    {
      role: 'system',
      content: `You are a senior software engineer specializing in bug analysis. 
Given a bug ticket, you must:
1. Classify the bug type from: ${BUG_TYPES.join(', ')}
2. Identify the affected file path (relative) and approximate line number if visible in stack trace
3. Extract 3-5 keywords for codebase search
4. Write a concise root cause hypothesis (2-3 sentences)
5. Suggest the type of fix needed
6. Set "needsDbAccess" to true if you suspect the issue is metadata-related or requires querying the live database schema/data to resolve.
${ragContextText}

Always respond with valid JSON only conforming exactly to this schema:
{
  "bugType": "string",
  "affectedFile": "string or null",
  "affectedLine": "number or null",
  "keywords": ["string"],
  "rootCause": "string",
  "fixType": "string",
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "confidence": "number between 0 and 1",
  "needsDbAccess": boolean
}`,
    },
    {
      role: 'user',
      content: `Analyse this bug ticket:

Title: ${ticket.title}
Service: ${ticket.service}
Description: ${ticket.description}
Stack Trace:
${ticket.stackTrace || 'No stack trace provided'}
${validationError ? `\n\nYOUR PREVIOUS OUTPUT FAILED VALIDATION:\n${validationError}\n\nRETURN VALID JSON ONLY THAT STRICTLY MATCHES THE SCHEMA.` : ''}`,
    },
  ];

  const timer = log.time('LLM analysis');
  const raw = await chat(prompt, { 
    temperature: 0.1, 
    model: 'openai/gpt-oss-120b'
  });
  timer.end();

  log.debug('Raw LLM response', raw);

  try {
    const result = JSON.parse(raw.trim());
    const validated = AnalysisSchema.parse(result);
    log.info(`Analysis complete`, { bugType: validated.bugType, severity: validated.severity, confidence: validated.confidence, keywords: validated.keywords });
    return validated;
  } catch (err) {
    log.error(`Validation failed`, { error: err.message, rawPreview: raw.substring(0, 200) });
    if (attempt < 2) {
      log.warn(`Retrying with self-correction...`);
      return analyse(ticket, attempt + 1, err.message);
    }
    log.error(`FATAL: Analyser failed after ${attempt} attempts`);
    throw new Error(`Analyser failed to return valid JSON after retry: ${raw}`);
  }
}

module.exports = { analyse };
