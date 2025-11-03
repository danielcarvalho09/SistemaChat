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

async function start() {
  try {
    logger.info('🚀 Starting WhatsApp System Backend...');

    // Conectar ao banco de dados
    await connectDatabase();

    // Conectar ao Redis
    await connectRedis();

    // Seed inicial do banco de dados (roles e permissões)
    // DESABILITADO - Já foi executado na primeira vez
    // if (config.server.isDevelopment) {
    //   await seedDatabase();
    // }

    // Construir aplicação Fastify
    const app = await buildApp();

    // Iniciar servidor HTTP
    await app.listen({
      port: config.server.port,
      host: '0.0.0.0',
    });

    // Inicializar WebSocket server
    initializeSocketServer(app.server);

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

    // Reconectar conexões WhatsApp que estavam ativas
    logger.info('⏳ Aguardando 3 segundos antes de reconectar WhatsApp...');
    setTimeout(async () => {
      logger.info('🔄 Iniciando reconexão automática do WhatsApp...');
      await baileysManager.reconnectActiveConnections();
    }, 3000); // Aguarda 3s para garantir que tudo está inicializado


    // Graceful shutdown
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        logger.info(`\n${signal} received, shutting down gracefully...`);

        try {
          keepAliveService.stop(); // Parar keep-alive
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
    process.exit(1);
  }
}

// Iniciar servidor
start();
