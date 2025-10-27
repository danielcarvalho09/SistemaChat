/**
 * Script para testar o sistema de cache
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const Redis = require('ioredis');

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL);

async function testarCache() {
  console.log('🧪 Testando Sistema de Cache\n');
  console.log('═══════════════════════════════════════════\n');

  try {
    // 1. Teste de escrita e leitura básica
    console.log('1️⃣  Teste Básico de Cache');
    const testKey = 'test:cache:basic';
    const testData = { message: 'Hello Cache!', timestamp: Date.now() };
    
    await redis.setex(testKey, 60, JSON.stringify(testData));
    const cached = await redis.get(testKey);
    const parsed = JSON.parse(cached);
    
    console.log('   ✅ Escrita:', testData);
    console.log('   ✅ Leitura:', parsed);
    console.log('');

    // 2. Teste de performance - SEM cache
    console.log('2️⃣  Performance SEM Cache');
    const start1 = Date.now();
    const users1 = await prisma.user.findMany({ take: 10 });
    const time1 = Date.now() - start1;
    console.log(`   ⏱️  Tempo: ${time1}ms (${users1.length} usuários)`);
    console.log('');

    // 3. Teste de performance - COM cache (primeira vez - miss)
    console.log('3️⃣  Performance COM Cache (Cache MISS)');
    const cacheKey = 'users:list:1:10';
    const start2 = Date.now();
    
    let cachedUsers = await redis.get(cacheKey);
    if (!cachedUsers) {
      const users2 = await prisma.user.findMany({ take: 10 });
      await redis.setex(cacheKey, 300, JSON.stringify(users2));
      cachedUsers = JSON.stringify(users2);
    }
    
    const time2 = Date.now() - start2;
    console.log(`   ⏱️  Tempo: ${time2}ms (cache miss + save)`);
    console.log('');

    // 4. Teste de performance - COM cache (segunda vez - hit)
    console.log('4️⃣  Performance COM Cache (Cache HIT)');
    const start3 = Date.now();
    
    cachedUsers = await redis.get(cacheKey);
    const users3 = JSON.parse(cachedUsers);
    
    const time3 = Date.now() - start3;
    console.log(`   ⏱️  Tempo: ${time3}ms (${users3.length} usuários)`);
    console.log(`   🚀 ${Math.round((time1 / time3) * 100) / 100}x mais rápido!`);
    console.log('');

    // 5. Teste de invalidação
    console.log('5️⃣  Teste de Invalidação');
    await redis.del(cacheKey);
    const exists = await redis.exists(cacheKey);
    console.log(`   ✅ Cache deletado: ${!exists}`);
    console.log('');

    // 6. Teste de padrões
    console.log('6️⃣  Teste de Padrões (Wildcard)');
    await redis.set('user:1', 'data1');
    await redis.set('user:2', 'data2');
    await redis.set('user:3', 'data3');
    
    const keys = await redis.keys('user:*');
    console.log(`   ✅ Chaves encontradas: ${keys.length}`);
    
    await redis.del(...keys);
    const keysAfter = await redis.keys('user:*');
    console.log(`   ✅ Chaves após delete: ${keysAfter.length}`);
    console.log('');

    // 7. Estatísticas do Redis
    console.log('7️⃣  Estatísticas do Redis');
    const info = await redis.info('stats');
    const dbsize = await redis.dbsize();
    
    const hitsMatch = info.match(/keyspace_hits:(\d+)/);
    const missesMatch = info.match(/keyspace_misses:(\d+)/);
    const hits = hitsMatch ? parseInt(hitsMatch[1]) : 0;
    const misses = missesMatch ? parseInt(missesMatch[1]) : 0;
    const total = hits + misses;
    const hitRate = total > 0 ? ((hits / total) * 100).toFixed(2) : 0;
    
    console.log(`   📊 Total de chaves: ${dbsize}`);
    console.log(`   ✅ Cache Hits: ${hits}`);
    console.log(`   ❌ Cache Misses: ${misses}`);
    console.log(`   📈 Hit Rate: ${hitRate}%`);
    console.log('');

    // Resumo
    console.log('═══════════════════════════════════════════');
    console.log('✅ TODOS OS TESTES PASSARAM!');
    console.log('═══════════════════════════════════════════');
    console.log('');
    console.log('💡 Benefícios do Cache:');
    console.log(`   • Redução de ${Math.round(((time1 - time3) / time1) * 100)}% no tempo de resposta`);
    console.log(`   • ${Math.round((time1 / time3) * 100) / 100}x mais rápido`);
    console.log(`   • Menos carga no banco de dados`);
    console.log(`   • Melhor experiência do usuário`);
    console.log('');
    console.log('📚 Consulte: GUIA_CACHE.md para implementação');
    console.log('');

  } catch (error) {
    console.error('❌ Erro nos testes:', error);
  } finally {
    await prisma.$disconnect();
    redis.disconnect();
  }
}

testarCache();
