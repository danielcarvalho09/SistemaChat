/**
 * Script para limpar todos os dados do Redis Cloud
 */

require('dotenv').config();
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);

async function limparRedis() {
  try {
    console.log('🗑️  Limpando Redis Cloud...');
    
    // Limpar TODOS os dados
    await redis.flushall();
    
    console.log('✅ Redis limpo com sucesso!');
    
    // Verificar
    const keys = await redis.keys('*');
    console.log(`📊 Total de chaves restantes: ${keys.length}`);
    
    redis.disconnect();
  } catch (error) {
    console.error('❌ Erro ao limpar Redis:', error);
    redis.disconnect();
    process.exit(1);
  }
}

limparRedis();
