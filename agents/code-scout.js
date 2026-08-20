/**
 * Code Scout Agent
 * Searches the demo-app codebase to find the exact file and line
 * causing the bug, based on Analyser output.
 */
const fs = require('fs');
const path = require('path');
const { createLogger } = require('./logger');
const { chat } = require('./groq-client');
const { pool } = require('../ecommerce-app/src/db/client');
const log = createLogger('CodeScout');

const CODEBASE_ROOT = path.join(__dirname, '..', 'ecommerce-app', 'src');

function getAllFiles(dir, exts = ['.js']) {
  const results = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results.push(...getAllFiles(full, exts));
    } else if (exts.some((e) => item.endsWith(e))) {
      results.push(full);
    }
  }
  return results;
}

function scoreFile(content, keywords, bugType) {
  let score = 0;
  const lower = content.toLowerCase();

  for (const kw of keywords) {
    const count = (lower.match(new RegExp(kw.toLowerCase(), 'g')) || []).length;
    score += count * 2;
  }

  // Bug-type specific patterns
  const patterns = {
    NullPointerException: /\.profile\.|\\bprofile\b.*\./,
    DivisionByZero: /\/\s*quantity|division/i,
    SQLInjection: /\$\{.*\}.*FROM|ILIKE.*\$\{/,
    WrongStatusCode: /res\.status\(200\)/,
    OffByOneError: /<=\s*0|quantity.*-.*quantity/,
  };

  if (patterns[bugType] && patterns[bugType].test(content)) {
    score += 10;
  }

  return score;
}

function findBugLine(content, bugType, keywords) {
  const lines = content.split('\n');
  const bugPatterns = {
    NullPointerException: /\.profile\.avatar|\.profile\[/,
    DivisionByZero: /\/\s*quantity/,
    SQLInjection: /\`.*\$\{.*\}\`.*|\$\{q\}/,
    WrongStatusCode: /res\.status\(200\)\.json.*payment|res\.json.*payment/,
    OffByOneError: /if\s*\(current\s*<=\s*0\)/,
  };

  const pattern = bugPatterns[bugType];
  if (!pattern) {
    // Keyword-based fallback
    for (let i = 0; i < lines.length; i++) {
      if (keywords.some((kw) => lines[i].toLowerCase().includes(kw.toLowerCase()))) {
        return i + 1;
      }
    }
    return null;
  }

  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) return i + 1;
  }
  return null;
}

async function exploreDatabase(analysisResult, ticket) {
  log.info(`Exploring database for metadata context...`);
  try {
    const prompt = [
      {
        role: 'system',
        content: `You are a database exploration agent. The analyser has requested database access to solve this bug.
Respond with a JSON array of read-only SQL queries (SELECT only) to run to gather context.
Format: { "queries": ["SELECT * FROM users LIMIT 1;"] }
DO NOT include queries that modify data.`
      },
      {
        role: 'user',
        content: `Ticket: ${ticket.title}\nBug Type: ${analysisResult.bugType}\nRoot Cause: ${analysisResult.rootCause}`
      }
    ];

    const raw = await chat(prompt, { model: 'llama-3.1-8b-instant', response_format: { type: 'json_object' } });
    const { queries } = JSON.parse(raw);
    const dbResults = [];

    for (const q of (queries || []).slice(0, 3)) {
      if (!q.toLowerCase().startsWith('select')) continue;
      log.debug(`Running scout query: ${q}`);
      try {
        const { rows } = await pool.query(q);
        dbResults.push({ query: q, rows: rows.slice(0, 5) });
      } catch (err) {
        dbResults.push({ query: q, error: err.message });
      }
    }
    return dbResults;
  } catch (err) {
    log.error(`DB Exploration failed`, { error: err.message });
    return null;
  }
}

async function scout(analysisResult, ticket) {
  const { keywords, bugType, affectedFile, needsDbAccess } = analysisResult;
  const timer = log.time('Code scanning');

  log.step('Scanning', `bugType=${bugType}, keywords=[${keywords.join(', ')}], hint=${affectedFile || 'none'}`);

  let dbContext = null;
  if (needsDbAccess) {
    dbContext = await exploreDatabase(analysisResult, ticket);
  }

  const files = getAllFiles(CODEBASE_ROOT);
  log.info(`Found ${files.length} source files in ${CODEBASE_ROOT}`);

  let bestFile = null;
  let bestScore = -1;

  // If analyser already identified the file, try to match it directly
  if (affectedFile) {
    const direct = files.find((f) => f.includes(affectedFile.replace(/\//g, path.sep)));
    if (direct) {
      const content = fs.readFileSync(direct, 'utf8');
      const line = findBugLine(content, bugType, keywords);
      log.info(`Direct file match found`, { file: path.relative(path.join(__dirname, '..'), direct), line, contentLength: content.length });
      timer.end();
      return {
        filePath: direct,
        relativePath: path.relative(path.join(__dirname, '..'), direct),
        content,
        bugLine: line,
        confidence: 0.95,
        dbContext,
      };
    }
    log.warn(`Analyser hint "${affectedFile}" did not match any file, falling back to scoring...`);
  }

  const scores = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const score = scoreFile(content, keywords, bugType);
    const rel = path.relative(path.join(__dirname, '..'), file);
    scores.push({ file: rel, score });
    if (score > bestScore) {
      bestScore = score;
      bestFile = file;
    }
  }

  // Log all file scores for debugging
  scores.sort((a, b) => b.score - a.score);
  log.debug('File scores (top 5)', scores.slice(0, 5));

  if (!bestFile) {
    log.error('FATAL: Could not locate any matching file');
    throw new Error('Code Scout could not locate the affected file');
  }

  const content = fs.readFileSync(bestFile, 'utf8');
  const line = findBugLine(content, bugType, keywords);
  const relativePath = path.relative(path.join(__dirname, '..'), bestFile);

  log.info(`Best match`, { file: relativePath, score: bestScore, line, contentLength: content.length });
  timer.end();

  return {
    filePath: bestFile,
    relativePath,
    content,
    bugLine: line,
    score: bestScore,
    confidence: Math.min(bestScore / 20, 0.95),
    dbContext,
  };
}

module.exports = { scout };
