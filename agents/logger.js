/**
 * Logger Utility
 * Provides color-coded, timestamped logging for all agents and API routes.
 * Each agent gets a unique color tag so you can instantly see which part
 * of the pipeline is running, passing, or crashing.
 */

const COLORS = {
  reset:   '\x1b[0m',
  bright:  '\x1b[1m',
  dim:     '\x1b[2m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',
  bgRed:   '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow:'\x1b[43m',
  bgBlue:  '\x1b[44m',
  bgMagenta:'\x1b[45m',
  bgCyan:  '\x1b[46m',
};

const AGENT_COLORS = {
  'Orchestrator': COLORS.bright + COLORS.magenta,
  'Analyser':     COLORS.bright + COLORS.cyan,
  'CodeScout':    COLORS.bright + COLORS.blue,
  'Sandbox':      COLORS.bright + COLORS.yellow,
  'Fixer':        COLORS.bright + COLORS.green,
  'Tester':       COLORS.bright + COLORS.red,
  'GroqClient':   COLORS.dim + COLORS.cyan,
  'API':          COLORS.bright + COLORS.white,
  'Knowledge':    COLORS.dim + COLORS.magenta,
};

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(11, 23); // HH:MM:SS.mmm
}

function formatData(data) {
  if (data === undefined || data === null) return '';
  if (typeof data === 'string') return data;
  try {
    const str = JSON.stringify(data, null, 0);
    return str.length > 300 ? str.substring(0, 300) + '...' : str;
  } catch {
    return String(data);
  }
}

function createLogger(agentName) {
  const color = AGENT_COLORS[agentName] || COLORS.white;
  const tag = `${color}[${agentName}]${COLORS.reset}`;
  const ts = () => `${COLORS.dim}${getTimestamp()}${COLORS.reset}`;

  return {
    info: (message, data) => {
      console.log(`${ts()} ${tag} ${COLORS.green}✔${COLORS.reset} ${message}`, data !== undefined ? formatData(data) : '');
    },
    warn: (message, data) => {
      console.warn(`${ts()} ${tag} ${COLORS.yellow}⚠${COLORS.reset} ${message}`, data !== undefined ? formatData(data) : '');
    },
    error: (message, data) => {
      console.error(`${ts()} ${tag} ${COLORS.red}✖${COLORS.reset} ${message}`, data !== undefined ? formatData(data) : '');
    },
    step: (stepName, message) => {
      console.log(`${ts()} ${tag} ${COLORS.bright}▶${COLORS.reset} ${COLORS.bright}${stepName}${COLORS.reset} — ${message}`);
    },
    debug: (message, data) => {
      if (process.env.DEBUG_AGENTS === 'true') {
        console.log(`${ts()} ${tag} ${COLORS.dim}🔍 ${message}${COLORS.reset}`, data !== undefined ? formatData(data) : '');
      }
    },
    time: (label) => {
      const start = Date.now();
      return {
        end: (extraMsg = '') => {
          const elapsed = Date.now() - start;
          const color = elapsed > 5000 ? COLORS.red : elapsed > 2000 ? COLORS.yellow : COLORS.green;
          console.log(`${ts()} ${tag} ${color}⏱ ${label}: ${elapsed}ms${COLORS.reset} ${extraMsg}`);
          return elapsed;
        }
      };
    }
  };
}

module.exports = { createLogger };
