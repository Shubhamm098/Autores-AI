/**
 * Fixer Agent
 * Uses Groq to generate a minimal, safe patch for the identified bug.
 * Applies the patch to the sandbox copy of the codebase.
 */
const { chat } = require('./groq-client');
const fs = require('fs');
const path = require('path');
const { createLogger } = require('./logger');
const log = createLogger('Fixer');

async function generateFix(scoutResult, analysisResult, ticket, reviewerComment = null) {
  log.step('Generating fix', `ticket="${ticket.title}", bugType=${analysisResult.bugType}, file=${scoutResult.relativePath}`);

  if (reviewerComment) {
    log.warn(`Retry with feedback`, reviewerComment.substring(0, 200));
  }

  const retryContext = reviewerComment
    ? `\n\nPrevious fix was REJECTED by human reviewer with comment: "${reviewerComment}". Please address this concern in your fix.`
    : '';

  const testFilePath = path.join(__dirname, '..', 'ecommerce-app', 'tests', 'ecommerce.test.js');
  const testFileContent = fs.existsSync(testFilePath) ? fs.readFileSync(testFilePath, 'utf8') : '';
  log.info(`Test file loaded`, { path: testFilePath, exists: fs.existsSync(testFilePath), length: testFileContent.length });

  const prompt = [
    {
      role: 'system',
      content: `You are an expert software engineer. Given a buggy source file and analysis,
you must produce a minimal, production-safe fix.

Rules:
- CRITICAL: You are replacing the existing file. You MUST output the ENTIRE, complete contents of the fixed file from the very first line (including all imports) to the very last line (including module.exports). 
- NEVER truncate, summarize, or omit unchanged code. Do NOT use placeholders like "// ... rest of code".
- Add a brief inline comment explaining the fix.
- Ensure the fix passes the expected behavior defined in the tests.
- CRITICAL: Do NOT switch to ES6 module syntax (no 'export default'). Maintain CommonJS ('require' and 'module.exports').

Respond strictly in the following format:
<description>1-2 sentence description of what was fixed</description>
<summary>brief summary of lines changed</summary>
<linesChanged>[array of line numbers modified, e.g., 23, 24]</linesChanged>
<fixedContent>
\`\`\`javascript
// PUT THE ENTIRE COMPLETE FILE CONTENT HERE FROM START TO FINISH.
// DO NOT USE PLACEHOLDERS LIKE "// ... rest of code".
\`\`\`
</fixedContent>`,
    },
    {
      role: 'user',
      content: `Fix this bug:

Ticket: ${ticket.title}
Bug Type: ${analysisResult.bugType}
Root Cause: ${analysisResult.rootCause}
Fix Type Needed: ${analysisResult.fixType}
Bug Line: ${scoutResult.bugLine}
${scoutResult.dbContext ? `\n--- DATABASE EXPLORATION CONTEXT ---\n${JSON.stringify(scoutResult.dbContext, null, 2)}\n------------------------------------\n` : ''}

Affected File (${scoutResult.relativePath}):
\`\`\`javascript
${scoutResult.content}
\`\`\`

Test Suite context (ensure your fix passes these):
\`\`\`javascript
${testFileContent}
\`\`\`
${retryContext}`,
    },
  ];

  // Best-of-N: Run 2 parallel requests to maximize chance of success
  log.info(`Firing 2 parallel LLM requests (Best-of-N)...`);
  const llmTimer = log.time('LLM fix generation (parallel)');
  const results = await Promise.allSettled([
    // Requesting 6000 maxTokens causes 413 errors on Groq free tier since 
    // prompt + maxTokens > 6000 TPM limit. 2000 is plenty for our small files.
    chat(prompt, { temperature: 0.15, maxTokens: 2000 }),
    chat(prompt, { temperature: 0.4, maxTokens: 2000 })
  ]);
  llmTimer.end();
  
  const responses = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);
    
  if (responses.length === 0) {
    throw new Error('Both parallel LLM requests failed. Pipeline cannot continue.');
  }
  
  log.info(`Got ${responses.length} candidate responses`, { lengths: responses.map(r => r.length) });

  const { execSync } = require('child_process');
  const os = require('os');
  
  function checkSyntax(code) {
    const tmpFile = path.join(os.tmpdir(), `syntax-check-${Date.now()}-${Math.floor(Math.random() * 1000)}.js`);
    fs.writeFileSync(tmpFile, code, 'utf8');
    try {
      execSync(`node -c "${tmpFile}"`, { stdio: 'pipe' });
      return { valid: true };
    } catch (err) {
      return { valid: false, error: err.stderr ? err.stderr.toString() : err.message };
    } finally {
      try { fs.unlinkSync(tmpFile); } catch {}
    }
  }

  const parseResponse = (raw) => {
    let result = { fixedContent: scoutResult.content, fixDescription: 'Auto-applied fix', changesSummary: 'Modified lines', linesChanged: [] };
    try {
      const descMatch = raw.match(/<description>([\s\S]*?)<\/description>/i);
      if (descMatch) result.fixDescription = descMatch[1].trim();

      const linesMatch = raw.match(/<linesChanged>([\s\S]*?)<\/linesChanged>/i);
      if (linesMatch) {
        const nums = linesMatch[1].match(/\d+/g);
        if (nums) result.linesChanged = nums.map(Number);
      }

      // 1. Try to extract from <fixedContent> with or without backticks
      let extractedCode = null;
      const fixedContentMatch = raw.match(/<fixedContent>([\s\S]*?)<\/fixedContent>/i);
      if (fixedContentMatch) {
        extractedCode = fixedContentMatch[1];
      } else {
        // 2. Try to extract just from backticks if tag is missing
        const backtickMatch = raw.match(/```(?:javascript|js)?\s*\n([\s\S]*?)```/i);
        if (backtickMatch) extractedCode = backtickMatch[1];
      }

      if (extractedCode) {
        // Remove trailing backticks if they were accidentally included inside the tag
        extractedCode = extractedCode.replace(/```(?:javascript|js)?\s*\n/gi, '').replace(/```/g, '').trim();
        result.fixedContent = extractedCode;
      }
    } catch (err) {
      log.error(`Failed to parse LLM response`, err.message);
    }
    return result;
  };

  let bestResult = null;
  let lastSyntaxError = null;

  for (let i = 0; i < responses.length; i++) {
    const raw = responses[i];
    log.info(`Evaluating candidate ${i + 1}/${responses.length}...`);
    const parsed = parseResponse(raw);
    log.debug(`Parsed fix`, { description: parsed.fixDescription, contentLength: parsed.fixedContent.length, linesChanged: parsed.linesChanged });

    const syntaxTimer = log.time(`Syntax check candidate ${i + 1}`);
    const syntax = checkSyntax(parsed.fixedContent);
    syntaxTimer.end(syntax.valid ? 'PASS ✅' : 'FAIL ❌');

    if (syntax.valid) {
      log.info(`Candidate ${i + 1} passed syntax check — using this fix`);
      bestResult = parsed;
      break;
    } else {
      lastSyntaxError = syntax.error;
      log.warn(`Candidate ${i + 1} failed syntax check`, syntax.error?.substring(0, 200));
    }
  }

  if (!bestResult) {
    log.error(`FATAL: All ${responses.length} candidates failed syntax check`);
    log.error(`Last syntax error`, lastSyntaxError);
    throw new Error(`Syntax check failed on all parallel generated fixes. Last error:\n${lastSyntaxError}`);
  }

  log.info(`Fix generated successfully`, { description: bestResult.fixDescription, linesChanged: bestResult.linesChanged });
  return bestResult;
}

function generateDiff(original, fixed, filePath) {
  const origLines = original.split('\n');
  const fixedLines = fixed.split('\n');
  const lines = [];

  lines.push(`--- a/${filePath}`);
  lines.push(`+++ b/${filePath}`);

  const maxLen = Math.max(origLines.length, fixedLines.length);
  let inChange = false;
  let chunkStart = -1;

  for (let i = 0; i < maxLen; i++) {
    const o = origLines[i] ? origLines[i].replace(/\r$/, '') : undefined;
    const f = fixedLines[i] ? fixedLines[i].replace(/\r$/, '') : undefined;
    if (o !== f) {
      if (!inChange) {
        chunkStart = Math.max(0, i - 2);
        lines.push(`@@ -${chunkStart + 1} +${chunkStart + 1} @@`);
        // Context lines before
        for (let c = chunkStart; c < i; c++) {
          if (origLines[c] !== undefined) lines.push(` ${origLines[c]}`);
        }
        inChange = true;
      }
      if (o !== undefined) lines.push(`-${o}`);
      if (f !== undefined) lines.push(`+${f}`);
    } else if (inChange) {
      lines.push(` ${o || ''}`);
      // Show 2 context lines after change then stop
      if (i > chunkStart + 5) inChange = false;
    }
  }

  const diff = lines.join('\n');
  log.info(`Diff generated`, { changedLines: lines.filter(l => l.startsWith('+') || l.startsWith('-')).length });
  return diff;
}

async function applyFix(sandboxFilePath, fixResult) {
  log.info(`Applying fix to sandbox`, { file: sandboxFilePath, contentLength: fixResult.fixedContent.length });
  fs.writeFileSync(sandboxFilePath, fixResult.fixedContent, 'utf8');
  log.info(`Fix written successfully`);
}

module.exports = { generateFix, generateDiff, applyFix };
