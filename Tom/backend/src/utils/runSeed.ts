import { seedDatabase } from './seed.js';
import { logger } from '../config/logger.js';

/**
 * Script para executar o seed do banco de dados
 */
async function runSeed() {
  try {
    await seedDatabase();
    logger.info('✅ Seed executado com sucesso!');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Erro ao executar seed:', error);
    process.exit(1);
  }
}

runSeed();
