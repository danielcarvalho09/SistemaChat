import winston from 'winston';
import path from 'path';

const logLevel = process.env.LOG_LEVEL || 'info';
const logFilePath = process.env.LOG_FILE_PATH || './logs';

// Formato customizado para logs
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Formato para console (desenvolvimento)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Transports
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
  }),
];

// File transports apenas em produção
if (process.env.NODE_ENV === 'production') {
  transports.push(
    // Arquivo de erro
    new winston.transports.File({
      filename: path.join(logFilePath, 'error.log'),
      level: 'error',
      format: customFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    // Arquivo combinado
    new winston.transports.File({
      filename: path.join(logFilePath, 'combined.log'),
      format: customFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    })
  );
}

// Criar logger
export const logger = winston.createLogger({
  level: logLevel,
  format: customFormat,
  transports,
  exitOnError: false,
});

// Stream para integração com Morgan (HTTP logging)
export const loggerStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export default logger;
