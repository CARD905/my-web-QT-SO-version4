/* Simple logger - สำหรับ production แนะนำใช้ winston/pino */

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function ts() {
  return new Date().toISOString();
}

export const logger = {
  info: (msg: string, meta?: unknown) =>
    console.log(`${colors.blue}[INFO]${colors.reset} ${colors.gray}${ts()}${colors.reset} ${msg}`, meta || ''),
  success: (msg: string, meta?: unknown) =>
    console.log(`${colors.green}[OK]${colors.reset} ${colors.gray}${ts()}${colors.reset} ${msg}`, meta || ''),
  warn: (msg: string, meta?: unknown) =>
    console.warn(`${colors.yellow}[WARN]${colors.reset} ${colors.gray}${ts()}${colors.reset} ${msg}`, meta || ''),
  error: (msg: string, meta?: unknown) =>
    console.error(`${colors.red}[ERROR]${colors.reset} ${colors.gray}${ts()}${colors.reset} ${msg}`, meta || ''),
};
