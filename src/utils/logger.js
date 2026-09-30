// Beautiful ANSI Colored Logger for Package Whisperer Backend

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',

  // Foreground
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Bright
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',

  // Background
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgDark: '\x1b[100m'
};

function timestamp() {
  const d = new Date();
  return `${colors.gray}${d.toTimeString().split(' ')[0]}.${String(d.getMilliseconds()).padStart(3, '0')}${colors.reset}`;
}

function tag(label, color = colors.cyan) {
  return `${color}${colors.bold}[${label}]${colors.reset}`;
}

const logger = {
  banner(info = {}) {
    const { port = 3000, nodeVersion = process.version, region = 'us-east-1', hasHmac = true } = info;
    const line = `${colors.gray}─────────────────────────────────────────────────────────────────${colors.reset}`;
    console.log('\n' + line);
    console.log(`  ${colors.brightGreen}${colors.bold}📦 PACKAGE WHISPERER${colors.reset}  ${colors.gray}v1.2.0${colors.reset}`);
    console.log(`  ${colors.italic}Thoughtful Ring Caretaking & Bedrock AI Escalation Engine${colors.reset}`);
    console.log(line);
    console.log(`  ${colors.bold}• Server:${colors.reset}       http://localhost:${port}`);
    console.log(`  ${colors.bold}• Runtime:${colors.reset}      Node.js ${nodeVersion}`);
    console.log(`  ${colors.bold}• AWS Region:${colors.reset}   ${region} (Bedrock Claude Haiku 4.5)`);
    console.log(`  ${colors.bold}• Ring HMAC:${colors.reset}    ${hasHmac ? colors.green + 'Verified (Active)' : colors.yellow + 'Bypassed (Dev mode)'}${colors.reset}`);
    console.log(`  ${colors.bold}• Quiet Hours:${colors.reset}  10:00 PM – 7:00 AM (Auto-interceptor engaged)`);
    console.log(line + '\n');
  },

  system(msg) {
    console.log(`${timestamp()} ${tag('SYSTEM', colors.blue)} ${msg}`);
  },

  webhook(method, path, status, extra = '') {
    const statusColor = status >= 400 ? colors.red : colors.green;
    console.log(
      `${timestamp()} ${tag('RING-WEBHOOK', colors.magenta)} ${method} ${path} ➔ ${statusColor}${colors.bold}${status}${colors.reset} ${extra}`
    );
  },

  classifier(result, label = 'Front door') {
    const icon = result.isDelivery ? '📦' : '🛡️';
    const confColor = result.confidence === 'high' ? colors.green : (result.confidence === 'medium' ? colors.yellow : colors.gray);
    console.log(
      `${timestamp()} ${tag('CLASSIFIER', colors.cyan)} ${icon} ${label} ➔ ` +
      `Delivery: ${result.isDelivery ? colors.green + 'YES' : colors.gray + 'NO'}${colors.reset} ` +
      `(${confColor}${result.confidence} conf${colors.reset}, reason: ${colors.dim}${result.reason}${colors.reset})`
    );
  },

  window(msg, highlight = '') {
    console.log(`${timestamp()} ${tag('WINDOW-TIMER', colors.brightYellow)} ⏳ ${msg} ${colors.bold}${highlight}${colors.reset}`);
  },

  retrieval(label, durationSec = null) {
    const durStr = durationSec ? ` (${durationSec}s visit duration)` : '';
    console.log(`${timestamp()} ${tag('RETRIEVAL', colors.brightGreen)} 🌱 Resident retrieved package at ${colors.bold}${label}${colors.reset}${durStr}. Resolved peacefully.`);
  },

  ai(source, msg, latencyMs = null) {
    const badge = source === 'bedrock'
      ? `${colors.bgBlue}${colors.white}${colors.bold} BEDROCK AI ${colors.reset}`
      : `${colors.bgDark}${colors.white}${colors.bold} TONE-AI (FALLBACK) ${colors.reset}`;
    const latStr = latencyMs ? ` ${colors.gray}(${latencyMs}ms)${colors.reset}` : '';
    console.log(`${timestamp()} ${badge}${latStr} ${msg}`);
  },

  quiet(msg) {
    console.log(`${timestamp()} ${tag('QUIET-HOURS', colors.gray)} 🌙 ${msg}`);
  },

  success(msg) {
    console.log(`${timestamp()} ${colors.green}✔ ${msg}${colors.reset}`);
  },

  info(msg) {
    console.log(`${timestamp()} ${colors.cyan}ℹ ${msg}${colors.reset}`);
  },

  warn(msg) {
    console.log(`${timestamp()} ${colors.yellow}⚠ ${msg}${colors.reset}`);
  },

  error(msg, err = null) {
    console.error(`${timestamp()} ${colors.red}${colors.bold}✖ ${msg}${colors.reset}`);
    if (err && err.stack) {
      console.error(`${colors.gray}${err.stack}${colors.reset}`);
    }
  }
};

module.exports = logger;
