import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'sua-redis-url-aqui';

const redis = new Redis(REDIS_URL);

async function clearRateLimits() {
  try {
    console.log('🔍 Buscando rate limits...');
    
    const keys = await redis.keys('rate-limit:*');
    
    if (keys.length === 0) {
      console.log('✅ Nenhum rate limit encontrado');
      await redis.quit();
      return;
    }
    
    console.log(`🗑️  Removendo ${keys.length} rate limits...`);
    
    for (const key of keys) {
      await redis.del(key);
      console.log(`   ✓ Removido: ${key}`);
    }
    
    console.log('✅ Rate limits limpos com sucesso!');
    await redis.quit();
  } catch (error) {
    console.error('❌ Erro:', error);
    await redis.quit();
    process.exit(1);
  }
}

clearRateLimits();
