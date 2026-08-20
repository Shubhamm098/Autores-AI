const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { initSchema } = require('./db/client');

const app = express();
const PORT = process.env.DEMO_APP_PORT || 3002;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/users', require('./routes/users'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/products', require('./routes/products'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/checkout', require('./routes/checkout'));

// Landing page — if you accidentally visit the demo-app port directly
app.get('/', (req, res) => {
  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || `http://localhost:${process.env.NODE_ENV === 'production' ? 3000 : 3000}`;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || `http://localhost:${process.env.API_PORT || 3001}`;
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>AutoRes AI · Demo App API Server</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    *{box-sizing:border-box;margin:0}body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto;background:linear-gradient(135deg,#0f172a,#1e1b4b);color:#e2e8f0;min-height:100vh;display:grid;place-items:center;padding:28px}
    .c{max-width:680px;width:100%;background:rgba(15,23,42,.6);border:1px solid rgba(99,102,241,.25);border-radius:18px;backdrop-filter:blur(14px);padding:32px 36px;box-shadow:0 20px 60px rgba(0,0,0,.35)}
    h1{font-size:28px;margin-bottom:8px}h1 span{background:linear-gradient(135deg,#818cf8,#f472b6);-webkit-background-clip:text;background-clip:text;color:transparent}
    .sub{color:#94a3b8;margin-bottom:24px;font-size:14px}
    .warn{background:rgba(251,146,60,.12);border:1px solid rgba(251,146,60,.35);color:#fdba74;border-radius:12px;padding:12px 16px;margin-bottom:22px;font-size:13px;line-height:1.55}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:22px}
    .card{padding:14px 16px;border-radius:12px;background:rgba(30,27,75,.45);border:1px solid rgba(99,102,241,.22);text-decoration:none;color:#e2e8f0;transition:all .18s}
    .card:hover{transform:translateY(-2px);border-color:rgba(99,102,241,.55);background:rgba(30,27,75,.7)}
    .card .t{font-weight:700;font-size:15px;margin-bottom:4px}.card .d{color:#94a3b8;font-size:12.5px}
    .routes{background:rgba(15,23,42,.5);border:1px solid rgba(148,163,184,.15);border-radius:12px;padding:14px 18px;font-size:12.5px}
    .routes h3{margin-bottom:10px;color:#c7d2fe;font-size:13px}ul{list-style:none;padding:0;display:grid;gap:6px}
    .method{display:inline-block;width:58px;font-weight:800;font-size:11px;padding:2px 6px;border-radius:6px;margin-right:8px;text-align:center}
    .GET{background:rgba(34,197,94,.18);color:#4ade80}.POST{background:rgba(99,102,241,.22);color:#a5b4fc}
    .ver{margin-top:22px;color:#64748b;font-size:11.5px;text-align:center}
  </style>
</head>
<body><div class="c">
  <h1>🧪 AutoRes <span>Demo App</span> — API Server</h1>
  <p class="sub">This is the <b>buggy target backend</b> that the AI agents fix. You probably want the Dashboard instead.</p>

  <div class="warn">⚠ <b>Not a user-facing app.</b><br/>
    demo-app is the <u>Express backend with intentional bugs</u> that the Tester &amp; Fixer agents validate.
    To raise bug tickets and watch agents fix them live, use the <b>Dashboard</b> links below.</div>

  <div class="grid">
    <a class="card" href="${dashboardUrl}/demo"><div class="t">⚡ Raise a Bug</div><div class="d">Submit a preset bug &amp; trigger the agent pipeline</div></a>
    <a class="card" href="${dashboardUrl}/"><div class="t">🎫 Ticket Feed</div><div class="d">Monitor all tickets &amp; live agent progress</div></a>
    <a class="card" href="${dashboardUrl}/metrics"><div class="t">📊 Metrics</div><div class="d">Agent performance, success rates &amp; KB stats</div></a>
    <a class="card" href="${dashboardUrl}/knowledge-base"><div class="t">📚 Knowledge Base</div><div class="d">Browse past resolutions stored as embeddings</div></a>
  </div>

  <div class="routes">
    <h3>🔌 Exposed buggy API routes (for agents / curl / Postman):</h3>
    <ul>
      <li><span class="method POST">POST</span>/api/orders — Division by zero when quantity = 0</li>
      <li><span class="method GET">GET</span>/api/users/:id — Null pointer on user.profile (legacy users)</li>
      <li><span class="method POST">POST</span>/api/payments — Returns 200 instead of 201 Created</li>
      <li><span class="method GET">GET</span>/api/products/search?q= — SQL injection vulnerability</li>
      <li><span class="method POST">POST</span>/api/inventory/deduct — Off-by-one causes negative stock</li>
      <li><span class="method GET">GET</span>/health — Service status (JSON)</li>
    </ul>
  </div>

  <p class="ver">Demo App · v1.0.0 &nbsp;·&nbsp; Backend for <a href="${apiUrl}/health" style="color:#818cf8">AutoRes API</a> · Powered by Express + pg</p>
</div></body></html>`);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'autores-demo-app', version: '1.0.0', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

const { execSync } = require('child_process');
const os = require('os');

function killPidOnPort(port) {
  try {
    if (os.platform() === 'win32') {
      const out = execSync(`netstat -ano 2>$null | findstr ":${port} " | findstr LISTENING`, { encoding: 'utf8' }).trim();
      if (out) {
        const pids = [...new Set(out.split('\n').filter(Boolean).map(l => (l.match(/\s(\d+)\s*$/) || [])[1]).filter(Boolean))];
        for (const pid of pids) {
          if (pid && pid !== '0' && Number(pid) !== process.pid) {
            console.warn(`⚠ Port ${port} held by zombie PID ${pid} — killing...`);
            try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }); } catch {}
          }
        }
        return pids.length > 0;
      }
    } else {
      const out = execSync(`lsof -ti:${port} 2>/dev/null || true`, { encoding: 'utf8' }).trim();
      if (out) {
        const pids = out.split('\n').filter(p => p && Number(p) !== process.pid);
        for (const pid of pids) {
          console.warn(`⚠ Port ${port} held by zombie PID ${pid} — killing...`);
          try { execSync(`kill -9 ${pid}`, { stdio: 'ignore' }); } catch {}
        }
        return pids.length > 0;
      }
    }
  } catch {}
  return false;
}

function startServer(port, attempt = 0) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`🚀 Demo App running on http://localhost:${port}`);
      console.log(`  Buggy routes ready for AutoRes AI agents!`);
      console.log(`  Dashboard: http://localhost:3000/demo`);
      resolve(server);
    });

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE' && attempt < 2) {
        const killed = killPidOnPort(port);
        console.warn(`🔧 EADDRINUSE on :${port} — ${killed ? 'killed zombie' : 'no zombie found'}. Retrying (${attempt + 1}/2)...`);
        setTimeout(() => resolve(startServer(port, attempt + 1)), 800);
      } else if (err.code === 'EADDRINUSE') {
        reject(new Error(`Could not bind :${port} after ${attempt + 1} attempts`));
      } else {
        reject(err);
      }
    });
  });
}

const start = async () => {
  try {
    await initSchema();
    await startServer(PORT);
  } catch (err) {
    console.error('Failed to start demo app:', err);
    process.exit(1);
  }
};

if (require.main === module) {
  start();
}
module.exports = app;

// Trigger restart
