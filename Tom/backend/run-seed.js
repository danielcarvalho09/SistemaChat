#!/usr/bin/env node

/**
 * Script para executar seed do banco no Railway
 * Execute: node run-seed.js
 */

import { getPrismaClient } from './src/config/database.js';
import { seedDatabase } from './src/utils/seed.js';

console.log('🌱 EXECUTANDO SEED DO BANCO DE DADOS');
console.log('=====================================\n');

async function runSeed() {
  const prisma = getPrismaClient();
  
  try {
    console.log('🔌 Conectando ao banco de dados...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Conexão estabelecida\n');

    console.log('🌱 Executando seed...');
    await seedDatabase();
    
    console.log('\n✅ SEED EXECUTADO COM SUCESSO!');
    console.log('📋 O que foi criado:');
    console.log('   - Roles: admin, user');
    console.log('   - Permissões básicas');
    console.log('   - Departamentos padrão');
    console.log('   - Associações role-permissão');
    
    console.log('\n🎯 Agora você pode:');
    console.log('   1. Criar usuários normalmente');
    console.log('   2. Fazer login com admin');
    console.log('   3. Usar todas as funcionalidades');
    
  } catch (error) {
    console.error('❌ ERRO durante seed:', error);
    console.error('📊 Detalhes:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar seed
runSeed();
