/**
 * Sandbox Agent
 * Creates an isolated copy of the demo-app codebase for safe testing.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { createLogger } = require('./logger');
const log = createLogger('Sandbox');

const DEMO_APP_ROOT = path.join(__dirname, '..', 'ecommerce-app');
const SANDBOX_BASE = process.env.SANDBOX_BASE_DIR
  ? path.resolve(process.env.SANDBOX_BASE_DIR)
  : path.join(__dirname, '..', 'sandbox', 'instances');

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const items = fs.readdirSync(src);
  for (const item of items) {
    if (item === 'node_modules' || item === '.git') continue;
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function createSandbox(ticketId) {
  const sandboxPath = path.join(SANDBOX_BASE, `ticket-${ticketId}-${Date.now()}`);
  const timer = log.time('Sandbox creation');

  log.step('Creating', `ticketId=${ticketId}`);
  log.info(`Sandbox path: ${sandboxPath}`);

  fs.mkdirSync(sandboxPath, { recursive: true });

  // Copy demo-app source (exclude node_modules)
  log.info(`Copying demo-app from ${DEMO_APP_ROOT}`);
  copyDir(DEMO_APP_ROOT, sandboxPath);
  log.info(`Source files copied successfully`);

  // Hardlink/Junction root node_modules to skip slow npm install
  try {
    const rootNodeModules = path.join(__dirname, '..', 'node_modules');
    const sandboxNodeModules = path.join(sandboxPath, 'node_modules');
    log.info(`Symlinking node_modules (junction): ${rootNodeModules} → ${sandboxNodeModules}`);
    fs.symlinkSync(rootNodeModules, sandboxNodeModules, 'junction');
    log.info(`node_modules symlink created successfully`);
  } catch (err) {
    log.warn(`Failed to symlink node_modules, falling back to npm install...`, err.message);
    try {
      log.info(`Running npm install in sandbox...`);
      execSync('npm install --silent', { cwd: sandboxPath, timeout: 60000 });
      log.info(`npm install completed`);
    } catch (installErr) {
      log.error(`npm install also failed!`, installErr.message);
    }
  }

  // Verify sandbox has key files
  const hasAppJs = fs.existsSync(path.join(sandboxPath, 'src', 'app.js'));
  const hasNodeMods = fs.existsSync(path.join(sandboxPath, 'node_modules'));
  log.info(`Sandbox verification`, { hasAppJs, hasNodeModules: hasNodeMods });

  if (!hasAppJs) {
    log.error(`CRITICAL: sandbox is missing src/app.js — tests will fail!`);
  }

  timer.end();
  return { sandboxPath, ticketId };
}

async function destroySandbox(sandboxPath) {
  log.info(`Destroying sandbox: ${sandboxPath}`);
  try {
    fs.rmSync(sandboxPath, { recursive: true, force: true });
    log.info(`Sandbox destroyed successfully`);
  } catch (err) {
    log.warn('Could not destroy sandbox', err.message);
  }
}

function getSandboxFilePath(sandboxPath, originalFilePath) {
  // Map original file path to sandbox equivalent
  const demoRoot = path.resolve(DEMO_APP_ROOT);
  const relative = path.relative(demoRoot, path.resolve(originalFilePath));
  const result = path.join(sandboxPath, relative);
  log.debug(`Mapped file path`, { original: originalFilePath, sandbox: result });
  return result;
}

module.exports = { createSandbox, destroySandbox, getSandboxFilePath };
