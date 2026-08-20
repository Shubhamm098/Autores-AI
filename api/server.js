const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const http = require('http');
const cors = require('cors');
const morgan = require('morgan');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Make io accessible in routes
app.set('io', io);

// Routes
app.use('/api/tickets',   require('./routes/tickets'));
app.use('/api/approvals', require('./routes/approvals'));
app.use('/api/knowledge', require('./routes/knowledge'));
app.use('/api/metrics',   require('./routes/metrics'));

// Health
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'autores-api', timestamp: new Date().toISOString() }));

// WebSocket
require('./socket/events')(io);

const { createLogger } = require('../agents/logger');
const apiLog = createLogger('API');

const PORT = process.env.API_PORT || 3001;
const { execSync } = require('child_process');
const os = require('os');

function killPidOnPort(port, retryAttempt = 0) {
  try {
    if (os.platform() === 'win32') {
      const out = execSync(`netstat -ano 2>$null | findstr ":${port} " | findstr LISTENING`, { encoding: 'utf8' }).trim();
      if (out) {
        const lines = out.split('\n').filter(Boolean);
        const pids = [...new Set(lines.map(l => (l.match(/\s(\d+)\s*$/) || [])[1]).filter(Boolean))];
        for (const pid of pids) {
          if (pid && pid !== '0' && Number(pid) !== process.pid) {
            apiLog.warn(`⚠ Port ${port} held by PID ${pid} (zombie from previous run) — killing it...`);
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
          apiLog.warn(`⚠ Port ${port} held by PID ${pid} (zombie) — killing it...`);
          try { execSync(`kill -9 ${pid}`, { stdio: 'ignore' }); } catch {}
        }
        return pids.length > 0;
      }
    }
  } catch {}
  return false;
}

function startServer(port, attempt = 0) {
  const serverInstance = server.listen(port, () => {
    apiLog.info(`🚀 AutoRes API running on http://localhost:${port}`);
    apiLog.info(`   WebSocket ready on ws://localhost:${port}`);
    apiLog.info(`   GROQ_API_KEY: ${process.env.GROQ_API_KEY ? '✅ set' : '❌ MISSING'}`);
    apiLog.info(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✅ set' : '❌ MISSING'}`);
    apiLog.info(`   DEBUG_AGENTS: ${process.env.DEBUG_AGENTS || 'false'} (set to "true" for verbose debug logs)`);
  });

  serverInstance.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempt < 2) {
      const killed = killPidOnPort(port, attempt);
      apiLog.warn(`🔧 EADDRINUSE on :${port} — ${killed ? 'killed zombie' : 'no zombie found'}. Retrying (${attempt + 1}/2)...`);
      setTimeout(() => startServer(port, attempt + 1), 800);
    } else if (err.code === 'EADDRINUSE') {
      apiLog.error(`❌ Could not bind :${port} after ${attempt + 1} attempts. Please free the port manually or set API_PORT env var.`);
      process.exit(1);
    } else {
      apiLog.error(`Server error: ${err.code} ${err.message}`);
      process.exit(1);
    }
  });

  return serverInstance;
}

startServer(PORT);

module.exports = { app, io };
