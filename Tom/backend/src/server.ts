import { buildApp } from './app.js';
import { config } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import { seedDatabase } from './utils/seed.js';
import { initializeSocketServer } from './websocket/socket.server.js';
import { baileysManager } from './whatsapp/baileys.manager.js';
import { CleanupService } from './services/cleanup.service.js';
import { keepAliveService } from './services/keep-alive.service.js';
import { syncQueueService } from './services/sync-queue.service.js';

async function start() {
  try {
    logger.info('🚀 Starting WhatsApp System Backend...');
    logger.info(`📦 Node version: ${process.version}`);
    logger.info(`🌍 Environment: ${config.server.env}`);
    logger.info(`📁 Working directory: ${process.cwd()}`);

    // Verificar se Prisma Client foi gerado
    try {
      const { PrismaClient } = await import('@prisma/client');
      logger.info('✅ Prisma Client imported successfully');
    } catch (error) {
      logger.error('❌ Failed to import Prisma Client - run "npx prisma generate"');
      logger.error('Error:', error);
      process.exit(1);
    }

    // Conectar ao banco de dados
    try {
      await connectDatabase();
    } catch (error) {
      logger.error('❌ Failed to connect to database:', error);
      process.exit(1);
    }

    // Conectar ao Redis
    try {
      await connectRedis();
    } catch (error) {
      logger.error('❌ Failed to connect to Redis:', error);
      // Redis não é crítico, continuar sem ele
      logger.warn('⚠️ Continuing without Redis (some features may be limited)');
    }

    // Seed inicial do banco de dados (roles e permissões)
    // DESABILITADO - Já foi executado na primeira vez
    // if (config.server.isDevelopment) {
    //   await seedDatabase();
    // }

    // Construir aplicação Fastify
    const app = await buildApp();

    // Iniciar servidor HTTP com keep-alive otimizado para Railway
    await app.listen({
      port: config.server.port,
      host: '0.0.0.0',
    });
    
    // Configurar keep-alive agressivo para evitar desconexões
    // Especialmente importante para Railway e outros PaaS
    app.server.keepAliveTimeout = 620000; // 620 segundos (maior que pingTimeout do socket)
    app.server.headersTimeout = 630000; // 630 segundos (deve ser maior que keepAliveTimeout)
    
    // Configurar timeout de requisição longo
    app.server.timeout = 900000; // 15 minutos
    
    logger.info('⚙️  HTTP Keep-Alive configurado: 620s timeout');

    // Inicializar WebSocket server
    const socketServer = initializeSocketServer(app.server);
    
    // Configurar heartbeat no servidor para manter conexões vivas
    // Enviar ping do servidor para todos os clientes a cada 15 segundos
    setInterval(() => {
      const io = socketServer.getIO();
      const connectedSockets = io.sockets.sockets;
      
      connectedSockets.forEach((socket) => {
        if (socket.connected) {
          socket.emit('server_ping');
        }
      });
      
      logger.debug(`🏓 Server ping enviado para ${connectedSockets.size} clientes`);
    }, 15000); // 15 segundos

    logger.info(`✅ Server running on http://localhost:${config.server.port}`);
    logger.info(`🔌 WebSocket server running on ws://localhost:${config.server.port}`);
    logger.info(`📚 API Docs: http://localhost:${config.server.port}/docs`);
    logger.info(`🏥 Health Check: http://localhost:${config.server.port}/health`);
    logger.info(`🌍 Environment: ${config.server.env}`);

    // Iniciar serviço de limpeza automática de arquivos antigos
    const cleanupService = new CleanupService();
    cleanupService.startAutomaticCleanup();

    // ✅ Iniciar serviço de keep-alive (previne sleep no Railway)
    keepAliveService.start();
    logger.info('💓 Keep-alive service started (prevents Railway sleep)');

    // ✅ Iniciar serviço de queue de sincronização
    syncQueueService.start();
    logger.info('🔄 Sync queue service started (processes pending syncs)');

    // ✅ Reconectar conexões WhatsApp que estavam ativas ANTES do restart
    // Isso mantém os clientes "vivos" mesmo após reiniciar o servidor
    logger.info('⏳ Aguardando 5 segundos antes de reconectar WhatsApp...');
    setTimeout(async () => {
      logger.info('🔄 Iniciando reconexão automática do WhatsApp (restaurando conexões após restart)...');
      try {
        await baileysManager.reconnectActiveConnections();
        logger.info('✅ Reconexão automática do WhatsApp concluída');
      } catch (error) {
        logger.error('❌ Erro na reconexão automática do WhatsApp:', error);
      }
    }, 5000); // Aguarda 5s para garantir que tudo está inicializado


    // Graceful shutdown
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        logger.info(`\n${signal} received, shutting down gracefully...`);

        try {
          keepAliveService.stop(); // Parar keep-alive
          syncQueueService.stop(); // Parar sync queue
          await app.close();
          await disconnectDatabase();
          await disconnectRedis();
          logger.info('✅ Server closed successfully');
          process.exit(0);
        } catch (error) {
          logger.error('❌ Error during shutdown:', error);
          process.exit(1);
        }
      });
    });

    // Tratamento de erros não capturados
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    logger.error('Error details:', error instanceof Error ? error.message : String(error));
    logger.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Fatal startup error:', error);
    process.exit(1);
  }
}

// Iniciar servidor
start().catch((error) => {
  logger.error('❌ Fatal error starting server:', error);
  logger.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
  console.error('Fatal error:', error);
  process.exit(1);
});

// Capturar erros não tratados (backup)
process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('❌ Uncaught Exception:', error);
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
