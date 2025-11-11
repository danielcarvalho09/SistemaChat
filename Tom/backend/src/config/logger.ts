import winston from 'winston';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

const LOGS_DIR = process.env.LOG_FILE_PATH || path.join(process.cwd(), 'secure-logs');
const NODE_ENV = process.env.NODE_ENV || 'development';

const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string | ((match: string) => string) }> = [
  { pattern: /password["\s]*[:=]["\s]*["']?([^"',\s}]+)/gi, replacement: 'password: "***REDACTED***"' },
  { pattern: /token["\s]*[:=]["\s]*["']?([^"',\s}]+)/gi, replacement: 'token: "***REDACTED***"' },
  { pattern: /api[_-]?key["\s]*[:=]["\s]*["']?([^"',\s}]+)/gi, replacement: 'apiKey: "***REDACTED***"' },
  { pattern: /secret["\s]*[:=]["\s]*["']?([^"',\s}]+)/gi, replacement: 'secret: "***REDACTED***"' },
  { pattern: /authorization["\s]*[:=]["\s]*["']?Bearer\s+([^"',\s}]+)/gi, replacement: 'authorization: "Bearer ***REDACTED***"' },
  { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: '****-****-****-****' },
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '***-**-****' },
  {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: (email: string) => maskEmail(email),
  },
  {
    pattern: /\+?\d{1,4}[\s-]?\(?\d{1,4}\)?[\s-]?\d{1,4}[\s-]?\d{1,4}/g,
    replacement: (phone: string) => maskPhone(phone),
  },
];

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***@***';
  if (local.length <= 3) return `***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `${digits.slice(0, 2)}***-****`;
}

function sanitizeLogData(data: unknown): unknown {
  if (typeof data === 'string') {
    return SENSITIVE_PATTERNS.reduce((acc, { pattern, replacement }) => {
      if (typeof replacement === 'string') {
        return acc.replace(pattern, replacement);
      }
      return acc.replace(pattern, replacement as (match: string) => string);
    }, data);
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item));
  }

  if (typeof data === 'object' && data !== null) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowered = key.toLowerCase();
      if (['password', 'token', 'secret', 'apikey', 'authorization', 'cookie'].some((s) => lowered.includes(s))) {
        sanitized[key] = '***REDACTED***';
      } else {
        sanitized[key] = sanitizeLogData(value);
      }
    }
    return sanitized;
  }

  return data;
}

const structuredFormat = winston.format.printf(({ timestamp, level, message, ...meta }) => {
  const sanitizedMessage = sanitizeLogData(message);
  const sanitizedMeta = sanitizeLogData(meta);

  const log = {
    timestamp,
    level,
    message: sanitizedMessage,
    meta: sanitizedMeta,
    logId: crypto.randomBytes(8).toString('hex'),
  };

  return JSON.stringify(log);
});

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true, mode: 0o700 });
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    structuredFormat,
  ),
  defaultMeta: {
    service: 'whatsapp-system',
    environment: NODE_ENV,
  },
  transports: [
    new winston.transports.File({
      filename: path.join(LOGS_DIR, 'application.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 30,
      tailable: true,
      options: { mode: 0o600 },
    }),
    new winston.transports.File({
      filename: path.join(LOGS_DIR, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 30,
      options: { mode: 0o600 },
    }),
  ],
  exitOnError: false,
});

if (NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  );
}

export const loggerStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export class AuditLogger {
  private static sanitize(details: unknown): unknown {
    return sanitizeLogData(details);
  }

  static logUserAction(action: string, userId: string, details: Record<string, unknown>, ip?: string): void {
    const entry = {
      type: 'USER_ACTION',
      action,
      userId,
      ip,
      details: this.sanitize(details),
      timestamp: new Date().toISOString(),
      auditId: crypto.randomBytes(8).toString('hex'),
    };
    logger.info('AUDIT', entry);
  }

  static logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high' | 'critical', details: Record<string, unknown>): void {
    const entry = {
      type: 'SECURITY_EVENT',
      event,
      severity,
      details: this.sanitize(details),
      timestamp: new Date().toISOString(),
      alertId: crypto.randomBytes(8).toString('hex'),
    };
    const level = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
    logger.log({ level, message: 'SECURITY', ...entry });
  }
}

export default logger;
