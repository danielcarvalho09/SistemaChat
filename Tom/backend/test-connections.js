/**
 * Script de Teste de Conexões
 * Testa conexão com Supabase (PostgreSQL) e Redis Cloud
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const Redis = require('ioredis');

const prisma = new PrismaClient();

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  title: (msg) => console.log(`\n${colors.cyan}${'='.repeat(50)}\n${msg}\n${'='.repeat(50)}${colors.reset}\n`),
};

// Teste de conexão PostgreSQL (Supabase)
async function testPostgreSQL() {
  log.title('TESTE DE CONEXÃO: SUPABASE (PostgreSQL)');
  
  try {
    log.info('Conectando ao Supabase...');
    
    // Testar conexão básica
    await prisma.$connect();
    log.success('Conexão estabelecida com sucesso!');
    
    // Testar query simples
    const result = await prisma.$queryRaw`SELECT version()`;
    log.success(`Versão do PostgreSQL: ${result[0].version}`);
    
    // Contar tabelas
    const tables = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    log.success(`Total de tabelas no banco: ${tables[0].count}`);
    
    // Verificar algumas tabelas importantes
    const users = await prisma.user.count();
    const conversations = await prisma.conversation.count();
    const messages = await prisma.message.count();
    
    log.info(`Estatísticas do banco:`);
    console.log(`  - Usuários: ${users}`);
    console.log(`  - Conversas: ${conversations}`);
    console.log(`  - Mensagens: ${messages}`);
    
    return true;
  } catch (error) {
    log.error('Falha na conexão com Supabase');
    console.error('Detalhes do erro:', error.message);
    
    if (error.message.includes('authentication failed')) {
      log.warning('Verifique a senha na DATABASE_URL');
    } else if (error.message.includes('connection refused')) {
      log.warning('Verifique o endpoint e porta na DATABASE_URL');
    } else if (error.message.includes('SSL')) {
      log.warning('Adicione ?sslmode=require na DATABASE_URL');
    }
    
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Teste de conexão Redis Cloud
async function testRedis() {
  log.title('TESTE DE CONEXÃO: REDIS CLOUD');
  
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    log.error('REDIS_URL não configurada no .env');
    return false;
  }
  
  let redis;
  
  try {
    log.info('Conectando ao Redis Cloud...');
    log.info(`URL: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`); // Ocultar senha
    
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy(times) {
        if (times > 3) {
          log.error('Máximo de tentativas de reconexão atingido');
          return null;
        }
        const delay = Math.min(times * 50, 2000);
        log.warning(`Tentativa ${times} de reconexão em ${delay}ms...`);
        return delay;
      },
    });
    
    // Aguardar conexão
    await new Promise((resolve, reject) => {
      redis.on('connect', resolve);
      redis.on('error', reject);
      setTimeout(() => reject(new Error('Timeout na conexão')), 10000);
    });
    
    log.success('Conexão estabelecida com sucesso!');
    
    // Testar PING
    const pong = await redis.ping();
    log.success(`PING: ${pong}`);
    
    // Testar SET/GET
    const testKey = 'test:connection';
    const testValue = JSON.stringify({ timestamp: new Date().toISOString() });
    
    await redis.set(testKey, testValue, 'EX', 60); // Expira em 60s
    log.success('SET: Chave de teste criada');
    
    const retrieved = await redis.get(testKey);
    log.success(`GET: ${retrieved}`);
    
    // Obter informações do servidor
    const info = await redis.info('server');
    const version = info.match(/redis_version:([^\r\n]+)/)?.[1];
    log.success(`Versão do Redis: ${version}`);
    
    // Obter estatísticas de memória
    const memoryInfo = await redis.info('memory');
    const usedMemory = memoryInfo.match(/used_memory_human:([^\r\n]+)/)?.[1];
    log.info(`Memória utilizada: ${usedMemory}`);
    
    // Limpar chave de teste
    await redis.del(testKey);
    log.success('Chave de teste removida');
    
    return true;
  } catch (error) {
    log.error('Falha na conexão com Redis Cloud');
    console.error('Detalhes do erro:', error.message);
    
    if (error.message.includes('WRONGPASS')) {
      log.warning('Senha incorreta. Verifique REDIS_URL e REDIS_PASSWORD');
    } else if (error.message.includes('ECONNREFUSED')) {
      log.warning('Conexão recusada. Verifique o endpoint e porta');
    } else if (error.message.includes('ETIMEDOUT')) {
      log.warning('Timeout. Verifique firewall e IPs permitidos no Redis Cloud');
    }
    
    return false;
  } finally {
    if (redis) {
      redis.disconnect();
    }
  }
}

// Executar todos os testes
async function runAllTests() {
  console.log('\n');
  log.title('🚀 TESTE DE CONEXÕES - SUPABASE + REDIS CLOUD');
  
  const results = {
    postgresql: false,
    redis: false,
  };
  
  // Testar PostgreSQL
  results.postgresql = await testPostgreSQL();
  
  // Testar Redis
  results.redis = await testRedis();
  
  // Resumo
  log.title('📊 RESUMO DOS TESTES');
  
  console.log(`Supabase (PostgreSQL): ${results.postgresql ? colors.green + '✅ OK' : colors.red + '❌ FALHOU'}${colors.reset}`);
  console.log(`Redis Cloud:           ${results.redis ? colors.green + '✅ OK' : colors.red + '❌ FALHOU'}${colors.reset}`);
  
  if (results.postgresql && results.redis) {
    log.success('\n🎉 Todas as conexões estão funcionando!');
    log.info('Você pode iniciar a aplicação com: npm run dev');
  } else {
    log.error('\n⚠️  Algumas conexões falharam');
    log.info('Verifique as credenciais no arquivo .env');
    log.info('Consulte o guia: GUIA_MIGRACAO_SUPABASE_REDIS.md');
  }
  
  console.log('\n');
  process.exit(results.postgresql && results.redis ? 0 : 1);
}

// Executar
runAllTests().catch((error) => {
  log.error('Erro inesperado durante os testes');
  console.error(error);
  process.exit(1);
});
