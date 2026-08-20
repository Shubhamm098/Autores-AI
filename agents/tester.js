/**
 * Tester Agent
 * Runs the Jest test suite against the sandbox-patched demo app
 * and returns structured pass/fail results.
 * 
 * KEY BEHAVIOR: Only evaluates tests RELEVANT to the affected file.
 * Other pre-existing test failures from unrelated bugs are ignored.
 */
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('./logger');
const log = createLogger('Tester');

// Map route file names to their corresponding test describe blocks
const FILE_TO_TEST_MAP = {
  'orders':    'Order Service Tests',
  'users':     'User Service Tests',
  'payments':  'Payment Service Tests',
  'products':  'Product Service Tests',
  'inventory': 'Inventory Service Tests',
  'checkout':  'Checkout Service Tests',
  'cart':      'E-Commerce Cart Tests',
};

function getRelevantTestPrefix(affectedFile) {
  if (!affectedFile) return null;
  // Handle both Windows and POSIX paths explicitly to extract filename without extension
  const parts = affectedFile.split(/[\\/]/);
  const filename = parts[parts.length - 1];
  const basename = filename.replace(/\.js$/i, '').toLowerCase();
  
  log.debug(`Extracted basename "${basename}" from affectedFile "${affectedFile}"`);
  return FILE_TO_TEST_MAP[basename] || null;
}

async function runTests(sandboxPath, ticket, affectedFile = null) {
  const testDir = path.join(__dirname, '..', 'ecommerce-app', 'tests');
  const sandboxTestDir = path.join(sandboxPath, 'tests');

  const relevantPrefix = getRelevantTestPrefix(affectedFile);
  log.step('Running tests', `sandbox=${sandboxPath}`);
  log.info(`Affected file: ${affectedFile || 'unknown'}`);
  log.info(`Relevant test filter: "${relevantPrefix || 'ALL TESTS'}"` );

  // Copy all test files to sandbox
  if (!fs.existsSync(sandboxTestDir)) fs.mkdirSync(sandboxTestDir, { recursive: true });
  fs.readdirSync(testDir).forEach(file => {
    if (file.endsWith('.test.js')) {
      fs.copyFileSync(path.join(testDir, file), path.join(sandboxTestDir, file));
    }
  });
  log.info(`Test file copied to sandbox`);

  // Verify sandbox state before running
  const sandboxAppJs = path.join(sandboxPath, 'src', 'app.js');
  const hasApp = fs.existsSync(sandboxAppJs);
  const hasNodeMods = fs.existsSync(path.join(sandboxPath, 'node_modules'));
  log.info(`Pre-test verification`, { hasAppJs: hasApp, hasNodeModules: hasNodeMods });

  if (!hasApp) {
    log.error(`CRITICAL: Sandbox missing src/app.js! Tests will definitely fail.`);
  }

  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';

    const jestPath = path.join(__dirname, '..', 'node_modules', 'jest', 'bin', 'jest.js');
    const jestArgs = ['--forceExit', '--json', '--testPathPattern', 'tests/'];
    
    log.info(`Spawning Jest`, { cwd: sandboxPath });

    const jest = spawn('node', [jestPath, ...jestArgs], {
        cwd: sandboxPath,
        env: {
          ...process.env,
          DEMO_APP_URL: `http://localhost:${process.env.DEMO_APP_PORT || 3002}`,
          NODE_ENV: 'test',
        },
      }
    );

    log.info(`Jest process spawned`, { pid: jest.pid });

    const timeoutId = setTimeout(() => {
      log.error(`TIMEOUT: Jest hung for 30+ seconds — force killing PID ${jest.pid}`);
      try { process.kill(jest.pid, 'SIGKILL'); } catch (e) {
        log.warn(`Failed to kill process`, e.message);
      }
      resolve({
        passed: 0, failed: 1, total: 1, success: false, tests: [], duration: 30000,
        rawOutput: 'Tester timed out after 30 seconds and was forcefully killed.',
        failureSummary: 'Timeout: Tests hung for 30+ seconds.',
      });
    }, 30000);

    jest.stdout.on('data', (d) => (stdout += d.toString()));
    jest.stderr.on('data', (d) => (stderr += d.toString()));

    jest.on('error', (err) => {
      clearTimeout(timeoutId);
      log.error(`Jest process error (failed to spawn)`, err.message);
      resolve({
        passed: 0, failed: 1, total: 1, success: false, tests: [],
        duration: Date.now() - startTime,
        rawOutput: err.message,
        failureSummary: `Tester Agent failed to start Jest: ${err.message}`,
      });
    });

    jest.on('exit', (code) => {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      log.info(`Jest exited`, { code, duration: `${duration}ms` });
      
      let jestResults = null;

      try {
        const jsonMatch = stdout.match(/\{"numFailedTestSuites"[\s\S]*\}/);
        if (jsonMatch) jestResults = JSON.parse(jsonMatch[0]);
      } catch (parseErr) {
        log.warn(`Failed to parse Jest JSON output`, parseErr.message);
      }

      if (jestResults) {
        const allTests = [];
        let failureSummary = '';
        let relevantPassed = 0;
        let relevantFailed = 0;
        let relevantTotal = 0;

        log.info(`Jest results (ALL tests)`, { passed: jestResults.numPassedTests, failed: jestResults.numFailedTests, total: jestResults.numTotalTests });

        for (const suite of jestResults.testResults || []) {
          const assertionResults = suite.assertionResults || suite.testResults || [];
          // If a syntax error occurs outside of a test, suite might fail without test results
          if (suite.status === 'failed' && assertionResults.length === 0) {
            log.error(`Syntax error or suite-level failure in ${suite.testFilePath}`, suite.message?.substring(0, 200));
            // A suite crash (no tests ran at all) almost always means a syntax error / require error
            // from the patched file — the Fixer Agent produced invalid code. It must always count
            // as a relevant failure so the Fixer gets the error message and retries.
            const firstLines = (suite.message || 'No error message available').split('\n').slice(0, 15).join('\n');
            failureSummary += `SUITE CRASH (tests could not run — likely a syntax error from the patch):\n${firstLines}\n\n`;
            relevantFailed++;
            relevantTotal++;
          }

          for (const t of assertionResults) {
            const name = t.fullName || t.title || 'Unknown Test';
            const isRelevant = !relevantPrefix || name.startsWith(relevantPrefix);
            
            allTests.push({
              name,
              status: t.status,
              duration: t.duration,
              failureMessage: t.failureMessages?.[0] || null,
              relevant: isRelevant,
            });

            if (isRelevant) {
              relevantTotal++;
              if (t.status === 'passed') {
                relevantPassed++;
                log.info(`✅ RELEVANT PASSED: ${t.fullName}`, `${t.duration}ms`);
              } else if (t.status === 'failed') {
                relevantFailed++;
                // Use real \n split, not \\n
                const rawMsg = t.failureMessages?.[0] || 'No error message';
                const assertionLines = rawMsg.split('\n').slice(0, 8).join('\n');
                failureSummary += `FAILED: ${t.fullName}\n${assertionLines}\n\n`;
                log.error(`❌ RELEVANT FAILED: ${t.fullName}`, assertionLines.substring(0, 200));
              }
            } else {
              // Log skipped tests dimly
              const icon = t.status === 'passed' ? '✅' : '⚠️';
              log.debug(`${icon} SKIPPED (not relevant): ${t.fullName} → ${t.status}`);
            }
          }
        }

        // ── FALLBACK: If exact prefix match found 0 relevant tests, try fuzzy keyword match ──
        if (relevantTotal === 0 && relevantPrefix && allTests.length > 0) {
          log.warn(`Exact prefix "${relevantPrefix}" matched 0 tests — trying fuzzy keyword fallback...`);
          // Extract basename keyword from the FILE_TO_TEST_MAP key
          const fuzzyMatchBasename = Object.keys(FILE_TO_TEST_MAP).find(
            k => FILE_TO_TEST_MAP[k] === relevantPrefix
          );
          if (fuzzyMatchBasename) {
            const fuzzy = fuzzyMatchBasename.toLowerCase();
            let fuzzyPassed = 0, fuzzyFailed = 0, fuzzyTotal = 0;
            for (const t of allTests) {
              if (t.name.toLowerCase().includes(fuzzy)) {
                t.relevant = true;
                fuzzyTotal++;
                if (t.status === 'passed') fuzzyPassed++;
                else if (t.status === 'failed') {
                  fuzzyFailed++;
                  const rawMsg = t.failureMessage || 'No error message';
                  const assertionLines = rawMsg.split('\n').slice(0, 8).join('\n');
                  failureSummary += `[FUZZY] FAILED: ${t.name}\n${assertionLines}\n\n`;
                }
              }
            }
            if (fuzzyTotal > 0) {
              log.info(`Fuzzy match "${fuzzy}" found: ${fuzzyPassed}/${fuzzyTotal} tests`);
              relevantPassed = fuzzyPassed;
              relevantFailed = fuzzyFailed;
              relevantTotal = fuzzyTotal;
            }
          }
        }

        const success = relevantFailed === 0 && relevantTotal > 0;

        log.info(`═══ TEST VERDICT ═══`);
        log.info(`Relevant tests (${relevantPrefix || 'ALL'}): ${relevantPassed}/${relevantTotal} passed`);
        log.info(`Overall tests: ${jestResults.numPassedTests}/${jestResults.numTotalTests} passed`);
        log.info(`Pipeline verdict: ${success ? '✅ PASS' : '❌ FAIL'}`);

        if (!success && failureSummary) {
          log.warn(`Failure details being sent to Fixer for retry:\n${failureSummary.substring(0, 400)}`);
        }

        resolve({
          passed: relevantPassed,
          failed: relevantFailed,
          total: relevantTotal,
          success,
          tests: allTests,
          duration,
          rawOutput: stdout.substring(0, 2000),
          failureSummary: success
            ? 'All relevant tests passed.'
            : (failureSummary.trim() || 'Tests failed but no assertion message could be extracted.'),
          allPassed: jestResults.numPassedTests,
          allFailed: jestResults.numFailedTests,
          allTotal: jestResults.numTotalTests,
        });
      } else {
        log.warn(`Could not parse Jest JSON — falling back to text parsing`);
        log.debug(`Raw stdout`, stdout.substring(0, 500));
        log.debug(`Raw stderr`, stderr.substring(0, 500));

        const passed = (stdout.match(/✓|✅|PASS/g) || []).length;
        const failed = (stdout.match(/✕|❌|FAIL/g) || []).length;
        resolve({
          passed, failed,
          total: passed + failed,
          success: failed === 0 && code === 0,
          tests: [], duration,
          rawOutput: (stdout + stderr).substring(0, 2000),
          failureSummary: stderr.substring(0, 500) || stdout.substring(0, 500),
        });
      }
    });
  });
}

module.exports = { runTests };
