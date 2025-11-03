import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { config } from './env.js';
import { logger } from './logger.js';

export function initializeSentry(): void {
  // Só inicializar em produção se tiver DSN configurado
  const sentryDsn = process.env.SENTRY_DSN;
  
  if (!sentryDsn) {
    logger.warn('⚠️ SENTRY_DSN not configured - error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: config.server.env,
    
    // Performance Monitoring
    tracesSampleRate: config.server.isProduction ? 0.1 : 1.0, // 10% em prod, 100% em dev
    
    // Profiling
    profilesSampleRate: config.server.isProduction ? 0.1 : 1.0,
    integrations: [
      nodeProfilingIntegration(),
    ],
    
    // Release tracking
    release: process.env.npm_package_version || 'unknown',
    
    // Filtrar dados sensíveis
    beforeSend(event, hint) {
      // Remover dados sensíveis
      if (event.request) {
        delete event.request.cookies;
        
        // Remover headers sensíveis
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
      }
      
      return event;
    },
    
    // Ignorar erros conhecidos/esperados
    ignoreErrors: [
      'Not allowed by CORS',
      'Connection timeout',
      'ECONNREFUSED',
      'ENOTFOUND',
    ],
  });

  logger.info('✅ Sentry initialized for error tracking');
  logger.info(`   Environment: ${config.server.env}`);
  logger.info(`   Traces Sample Rate: ${config.server.isProduction ? '10%' : '100%'}`);
}

// Helper para capturar exceções manualmente
export function captureException(error: Error, context?: Record<string, any>): void {
  Sentry.captureException(error, {
    extra: context,
  });
}

// Helper para capturar mensagens
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  Sentry.captureMessage(message, level);
}

// Helper para adicionar contexto ao erro
export function setContext(name: string, context: Record<string, any>): void {
  Sentry.setContext(name, context);
}

// Helper para adicionar tags
export function setTag(key: string, value: string): void {
  Sentry.setTag(key, value);
}

// Helper para adicionar usuário
export function setUser(user: { id: string; email?: string; username?: string }): void {
  Sentry.setUser(user);
}

// Middleware para Fastify
export function sentryErrorHandler(error: Error, request: any, reply: any): void {
  // Adicionar contexto da requisição
  Sentry.setContext('request', {
    method: request.method,
    url: request.url,
    headers: {
      'user-agent': request.headers['user-agent'],
      'content-type': request.headers['content-type'],
    },
    query: request.query,
    params: request.params,
  });
  
  // Adicionar usuário se autenticado
  if (request.user) {
    Sentry.setUser({
      id: request.user.userId,
      email: request.user.email,
    });
  }
  
  // Capturar exceção
  Sentry.captureException(error);
}

export default Sentry;
