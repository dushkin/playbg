import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Create logs directory securely if it doesn't exist
const logDir = path.resolve(process.cwd(), 'logs');
try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { mode: 0o755, recursive: false });
  }
} catch (error) {
  console.warn('Failed to create logs directory:', error);
}

// Configure logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }: winston.Logform.TransformableInfo) => {
      let msg = `${timestamp} [${level}]: ${message}`;
      if (Object.keys(meta).length > 0) {
        msg += ` ${JSON.stringify(meta)}`;
      }
      return msg;
    })
  ),
  defaultMeta: { service: 'playbg-backend' },
  transports: [
    // Write all logs to console in development
    new winston.transports.Console({
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
    })
  ]
});

// Add file transports in production with rotation
if (process.env.NODE_ENV === 'production') {
  // Error log with rotation (max 5MB per file, keep 5 files)
  logger.add(new winston.transports.File({
    filename: path.resolve(logDir, 'error.log'),
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }));

  // Combined log with rotation
  logger.add(new winston.transports.File({
    filename: path.resolve(logDir, 'combined.log'),
    maxsize: 5242880, // 5MB 
    maxFiles: 5,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }));
}

export default logger;