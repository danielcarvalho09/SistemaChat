import dotenv from 'dotenv';
import { z } from 'zod';

// Carregar variáveis de ambiente
dotenv.config();

// Schema de validação para variáveis de ambiente
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  API_PREFIX: z.string().default('/api/v1'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // Security
  BCRYPT_ROUNDS: z.string().default('12'),
  RATE_LIMIT_MAX: z.string().default('100'),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // WhatsApp
  WHATSAPP_SESSION_PATH: z.string().default('./whatsapp-sessions'),
  MAX_CONNECTIONS: z.string().default('100'),
  WHATSAPP_TIMEOUT: z.string().default('60000'),

  // Logging
  LOG_LEVEL: z.string().default('info'),
  LOG_FILE_PATH: z.string().default('./logs'),

  // Queue
  QUEUE_REDIS_HOST: z.string().default('localhost'),
  QUEUE_REDIS_PORT: z.string().default('6379'),
  QUEUE_REDIS_PASSWORD: z.string().optional(),

  // Upload
  MAX_FILE_SIZE: z.string().default('10485760'), // 10MB
  UPLOAD_PATH: z.string().default('./uploads'),
  ALLOWED_FILE_TYPES: z.string().default('image/jpeg,image/png,image/gif,video/mp4,application/pdf'),
});

// Validar e parsear variáveis de ambiente
const parseEnv = () => {
  try {
    const parsed = envSchema.parse(process.env);
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
};

export const env = parseEnv();

// Configurações derivadas
export const config = {
  server: {
    port: parseInt(env.PORT, 10),
    apiPrefix: env.API_PREFIX,
    env: env.NODE_ENV,
    isDevelopment: env.NODE_ENV === 'development',
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
  },
  database: {
    url: env.DATABASE_URL,
  },
  redis: {
    url: env.REDIS_URL,
    password: env.REDIS_PASSWORD,
  },
  jwt: {
    secret: env.JWT_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },
  security: {
    bcryptRounds: parseInt(env.BCRYPT_ROUNDS, 10),
    rateLimitMax: parseInt(env.RATE_LIMIT_MAX, 10),
    rateLimitWindowMs: parseInt(env.RATE_LIMIT_WINDOW_MS, 10),
    corsOrigin: env.CORS_ORIGIN.split(',').map(origin => origin.trim()),
  },
  whatsapp: {
    sessionPath: env.WHATSAPP_SESSION_PATH,
    maxConnections: parseInt(env.MAX_CONNECTIONS, 10),
    timeout: parseInt(env.WHATSAPP_TIMEOUT, 10),
  },
  logging: {
    level: env.LOG_LEVEL,
    filePath: env.LOG_FILE_PATH,
  },
  queue: {
    redis: {
      host: env.QUEUE_REDIS_HOST,
      port: parseInt(env.QUEUE_REDIS_PORT, 10),
      password: env.QUEUE_REDIS_PASSWORD,
    },
  },
  upload: {
    maxFileSize: parseInt(env.MAX_FILE_SIZE, 10),
    path: env.UPLOAD_PATH,
    allowedTypes: env.ALLOWED_FILE_TYPES.split(',').map(type => type.trim()),
  },
};

export default config;
