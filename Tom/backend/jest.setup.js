/**
 * Setup global para testes Jest
 */

// Mock de variáveis de ambiente para testes
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-min-32-characters-long-for-testing';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-min-32-chars-long';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.BCRYPT_ROUNDS = '4'; // Menos rounds para testes serem mais rápidos
process.env.ENCRYPTION_KEY = 'a'.repeat(64); // Chave de teste (64 caracteres hex)
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';
process.env.LOG_LEVEL = 'error'; // Apenas erros nos testes
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.RATE_LIMIT_MAX = '1000';
process.env.RATE_LIMIT_WINDOW_MS = '900000';

// Timeout global aumentado para testes de integração
jest.setTimeout(15000);

// Mock console para testes mais limpos (opcional)
global.console = {
  ...console,
  log: jest.fn(), // Silenciar logs
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Manter error para debugging
};

