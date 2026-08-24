const { chat } = require('./groq-client');
const fs = require('fs');
const path = require('path');
const { createLogger } = require('./logger');
const log = createLogger('SDET');

async function generateTest(ticket, analysisResult, scoutResult) {
  log.step('Generating unit test', `ticket="${ticket.title}"`);

  const testFilePath = path.join(__dirname, '..', 'ecommerce-app', 'tests', 'ecommerce.test.js');
  const testFileContent = fs.existsSync(testFilePath) ? fs.readFileSync(testFilePath, 'utf8') : '';

  const prompt = [
    {
      role: 'system',
      content: `You are an expert Software Development Engineer in Test (SDET).
Your job is to write a Jest unit test that intentionally reproduces a bug described in a ticket, and asserts the CORRECT behavior that the system should exhibit once the bug is fixed.

Rules:
- Write a completely standalone Jest test file.
- Use supertest to mock API requests if necessary.
- Include all necessary imports, mocks (e.g. jest.mock('../src/db/client')), and express app setup.
- The test must FAIL against the current buggy code, and PASS once the fix is applied.
- CRITICAL: You MUST output the ENTIRE, complete contents of the test file.
- CRITICAL: Maintain CommonJS ('require' and 'module.exports'). Do NOT use ES6 imports.

Respond strictly in the following format:
<description>1-2 sentence description of the test scenario</description>
<fixedContent>
\`\`\`javascript
// PUT THE ENTIRE COMPLETE TEST FILE CONTENT HERE FROM START TO FINISH.
\`\`\`
</fixedContent>`,
    },
    {
      role: 'user',
      content: `Write a TDD test for this bug:

Ticket: ${ticket.title}
Bug Type: ${analysisResult.bugType}
Root Cause: ${analysisResult.rootCause}
Expected Fix: ${analysisResult.fixType}

Affected File (${scoutResult.relativePath}):
\`\`\`javascript
${scoutResult.content}
\`\`\`

Here is an example of an existing test suite in this project to show you how we set up the express app and mock the database:
\`\`\`javascript
${testFileContent}
\`\`\`

Write a new, standalone test file that targets this specific bug. Do not just copy the example, but use it to understand the architecture.`
    }
  ];

  log.info(`Firing 2 parallel LLM requests for SDET (Best-of-N)...`);
  const llmTimer = log.time('LLM test generation');
  const results = await Promise.allSettled([
    chat(prompt, { temperature: 0.15, maxTokens: 2500 }),
    chat(prompt, { temperature: 0.4, maxTokens: 2500 })
  ]);
  llmTimer.end();

  const responses = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);

  if (responses.length === 0) {
    throw new Error('Both parallel LLM requests failed for SDET.');
  }

  const { execSync } = require('child_process');
  const os = require('os');

  function checkSyntax(code) {
    if (code.length < 100) return { valid: false, error: 'Snippet too short to be a valid test file.' };
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

  let bestResult = null;
  let lastSyntaxError = null;

  for (let i = 0; i < responses.length; i++) {
    const raw = responses[i];
    let testContent = '';
    
    // Find ALL code blocks in the response
    const allCodeBlocks = [];
    const regex = /```(?:javascript|js)?\s*\n([\s\S]*?)```/gi;
    let match;
    while ((match = regex.exec(raw)) !== null) {
      allCodeBlocks.push(match[1]);
    }

    if (allCodeBlocks.length > 0) {
      allCodeBlocks.sort((a, b) => b.length - a.length);
      testContent = allCodeBlocks[0].trim();
    } else {
      const fixedContentMatch = raw.match(/<fixedContent>([\s\S]*?)<\/fixedContent>/i);
      if (fixedContentMatch) testContent = fixedContentMatch[1].trim();
    }

    if (!testContent) continue;

    const syntax = checkSyntax(testContent);
    if (syntax.valid) {
      bestResult = { testContent };
      break;
    } else {
      lastSyntaxError = syntax.error;
    }
  }

  if (!bestResult) {
    log.error(`FATAL: All SDET candidates failed syntax check`);
    throw new Error(`Syntax check failed on SDET generated test. Last error:\n${lastSyntaxError}`);
  }

  log.info(`Test generated successfully`);
  return bestResult;
}

module.exports = { generateTest };
