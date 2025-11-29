import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import compress from '@fastify/compress';
import cookie from '@fastify/cookie';
import path from 'path';
import fs from 'fs';
import { config } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import { sanitizeInputs } from './middlewares/sanitize.middleware.js';
import { registerRoutes } from './routes/index.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // Usando Winston ao invés do logger do Fastify
    trustProxy: true,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    connectionTimeout: 60000, // 60 segundos
    keepAliveTimeout: 65000, // 65 segundos (deve ser maior que connectionTimeout)
    requestTimeout: 30000, // 30 segundos para timeout de requisição
    bodyLimit: 10 * 1024 * 1024, // 10MB máximo para body
  });

  // Compressão GZIP para respostas (70-90% menos dados)
  await app.register(compress, {
    global: true,
    threshold: 1024, // Comprimir respostas > 1KB
    encodings: ['gzip', 'deflate'],
  });

  // Registrar plugins de segurança
  await app.register(helmet, {
    contentSecurityPolicy: config.server.isProduction ? {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    } : false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginEmbedderPolicy: false, // Necessário para uploads
    hsts: config.server.isProduction ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    } : false,
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  });

  // CORS configurado de forma robusta
  await app.register(cors, {
    origin: (origin, callback) => {
      const allowedOrigins = config.security.corsOrigin;
      
      // Permitir requisições sem origin (mobile apps, Postman, etc)
      if (!origin) {
        return callback(null, true);
      }
      
      // Verificar se a origin está na lista permitida
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        logger.warn(`HTTP request rejected from origin: ${origin}`);
        logger.warn(`Allowed origins: ${allowedOrigins.join(', ')}`);
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-User-Email',
      'X-User-Name',
    ],
    exposedHeaders: ['Content-Type', 'Content-Length'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Cookies
  await app.register(cookie, {
    parseOptions: {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.server.isProduction,
    },
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
      files: 1, // Apenas 1 arquivo por vez
    },
    attachFieldsToBody: false, // Não anexar campos ao body
    throwFileSizeLimit: false, // Não lançar erro automaticamente, vamos tratar manualmente
  });
  
  // Hook para logar requests de upload antes do multipart processar
  app.addHook('onRequest', async (request, reply) => {
    if (request.url.includes('/upload') && request.method === 'POST') {
      logger.info('[App] 📤 Upload request detected:', {
        url: request.url,
        contentType: request.headers['content-type'],
        contentLength: request.headers['content-length'],
        method: request.method,
        headers: Object.keys(request.headers),
      });
    }
  });
  
  logger.info('✅ Multipart plugin registered for file uploads');

  // Função auxiliar para configurar headers de arquivos estáticos
  const setStaticHeaders = (res: any, filePath: string) => {
      // Configurar CORS para arquivos estáticos
      const allowedOrigin = Array.isArray(config.security.corsOrigin) 
        ? config.security.corsOrigin[0] 
        : config.security.corsOrigin;
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      // Configurar MIME types corretos
    if (filePath.endsWith('.pdf')) {
        res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', 'inline; filename="' + filePath.split('/').pop() + '"')
    } else if (filePath.endsWith('.txt')) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    } else if (filePath.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      const ext = filePath.split('.').pop()?.toLowerCase();
      const mimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
      };
      if (ext && mimeTypes[ext]) {
        res.setHeader('Content-Type', mimeTypes[ext]);
      } else {
        res.setHeader('Content-Type', 'image/png'); // fallback
      }
    } else if (filePath.endsWith('.mp4')) {
        res.setHeader('Content-Type', 'video/mp4')
    } else if (filePath.match(/\.(ogg|oga)$/i)) {
      res.setHeader('Content-Type', 'audio/ogg; codecs=opus')
    } else if (filePath.match(/\.(mp3|mpeg)$/i)) {
      res.setHeader('Content-Type', 'audio/mpeg')
    } else if (filePath.match(/\.(wav)$/i)) {
      res.setHeader('Content-Type', 'audio/wav')
    } else if (filePath.match(/\.(m4a)$/i)) {
      res.setHeader('Content-Type', 'audio/mp4')
    } else if (filePath.match(/\.(docx?|xlsx?|pptx?)$/i)) {
      const ext = filePath.split('.').pop()?.toLowerCase()
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
  };

  // Servir arquivos estáticos (secure-uploads)
  await app.register(fastifyStatic, {
    root: path.join(process.cwd(), 'secure-uploads'),
    prefix: '/secure-uploads/',
    setHeaders: (res: any, filePath: string) => {
      logger.debug(`[Static] Serving file: ${filePath}`);
      setStaticHeaders(res, filePath);
    },
    list: config.server.isDevelopment,
    dotfiles: 'allow',
    index: false, // Não servir index.html como padrão
    serve: true,
  });
  
  logger.info('✅ Static file server registered for /secure-uploads/');

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

  // Servir também de /uploads/ para compatibilidade com URLs antigas
  // IMPORTANTE: Registrar ANTES das outras rotas para ter prioridade
  // Usar rota manual ao invés de segundo fastifyStatic para evitar conflito de decorators
  app.get('/uploads/*', async (request: any, reply) => {
    try {
      // Extrair filename da URL (remover /uploads/ do início)
      const urlPath = request.url.replace(/^\/uploads\//, '');
      const fullPath = path.join(process.cwd(), 'secure-uploads', urlPath);
      
      logger.debug(`[Static] Serving file from /uploads/: ${urlPath}`);
      logger.debug(`[Static] Full path: ${fullPath}`);
      
      // Verificar se arquivo existe
      if (!fs.existsSync(fullPath)) {
        logger.warn(`[Static] File not found: ${fullPath}`);
        return reply.status(404).send({ error: 'File not found', path: fullPath });
      }
      
      const stats = fs.statSync(fullPath);
      if (!stats.isFile()) {
        logger.warn(`[Static] Path is not a file: ${fullPath}`);
        return reply.status(404).send({ error: 'Not a file' });
      }
      
      // ✅ VALIDAÇÃO: Verificar se arquivo não está vazio
      if (stats.size === 0) {
        logger.error(`[Static] ❌ File is empty: ${fullPath}`);
        return reply.status(500).send({ error: 'File is empty' });
      }
      
      logger.info(`[Static] ✅ Serving file: ${urlPath} (${stats.size} bytes)`);
      
      // Configurar headers
      setStaticHeaders(reply.raw, fullPath);
      
      // Enviar arquivo usando stream
      const fileStream = fs.createReadStream(fullPath);
      return reply.send(fileStream);
    } catch (error) {
      logger.error('Error serving file from /uploads/:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ✅ Hook global de sanitização de inputs (ANTES das rotas)
  app.addHook('preHandler', sanitizeInputs);

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
