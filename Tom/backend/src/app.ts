import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import compress from '@fastify/compress';
import path from 'path';
import { config } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import { registerRoutes } from './routes/index.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // Usando Winston ao invés do logger do Fastify
    trustProxy: true,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
  });

  // Compressão GZIP para respostas (70-90% menos dados)
  await app.register(compress, {
    global: true,
    threshold: 1024, // Comprimir respostas > 1KB
    encodings: ['gzip', 'deflate'],
  });

  // Registrar plugins de segurança
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
    frameguard: false,
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  await app.register(cors, {
    origin: config.security.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Type', 'Content-Length'],
  });

  // Rate limiting global (mais permissivo que o específico de auth)
  await app.register(rateLimit, {
    max: 1000,
    timeWindow: '15 minutes',
    redis: undefined, // Usaremos nosso próprio middleware de rate limit com Redis
  });

  // Suporte para upload de arquivos (multipart/form-data)
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });

  // Servir arquivos estáticos (uploads)
  await app.register(fastifyStatic, {
    root: path.join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
    setHeaders: (res, path) => {
      // Configurar CORS para arquivos estáticos
      res.setHeader('Access-Control-Allow-Origin', config.security.corsOrigin || '*')
      res.setHeader('Access-Control-Allow-Credentials', 'true')
      
      // Configurar MIME types corretos
      if (path.endsWith('.pdf')) {
        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', 'inline; filename="' + path.split('/').pop() + '"')
      } else if (path.endsWith('.txt')) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      } else if (path.match(/\.(jpg|jpeg|png|gif)$/i)) {
        res.setHeader('Content-Type', `image/${path.split('.').pop()}`)
      } else if (path.endsWith('.mp4')) {
        res.setHeader('Content-Type', 'video/mp4')
      } else if (path.match(/\.(docx?|xlsx?|pptx?)$/i)) {
        const ext = path.split('.').pop()?.toLowerCase()
        const mimeTypes: Record<string, string> = {
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'xls': 'application/vnd.ms-excel',
          'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'ppt': 'application/vnd.ms-powerpoint',
          'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        }
        if (ext && mimeTypes[ext]) {
          res.setHeader('Content-Type', mimeTypes[ext])
        }
      }
    },
    // Permitir listagem de diretório para testes
    list: config.server.isDevelopment,
    // Permitir links simbólicos
    dotfiles: 'allow'
  });

  // Swagger/OpenAPI Documentation
  if (config.server.isDevelopment) {
    await app.register(swagger, {
      openapi: {
        info: {
          title: 'WhatsApp Multi-Tenant System API',
          description: 'API documentation for WhatsApp customer service system',
          version: '1.0.0',
        },
        servers: [
          {
            url: `http://localhost:${config.server.port}`,
            description: 'Development server',
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
      },
    });

    await app.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
      },
      staticCSP: true,
    });
  }

  // Registrar rotas
  await registerRoutes(app);

  // Handler de erros
  app.setErrorHandler(errorHandler);

  // Handler de rotas não encontradas
  app.setNotFoundHandler(notFoundHandler);

  // Log de requisições
  app.addHook('onResponse', async (request, reply) => {
    const responseTime = reply.getHeader('x-response-time') || '0';
    const responseTimeMs = typeof responseTime === 'string' ? responseTime : '0';
    
    logger.info(
      `${request.method} ${request.url} ${reply.statusCode} - ${responseTimeMs}ms`,
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: responseTimeMs,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      },
    );
  });

  return app;
}
