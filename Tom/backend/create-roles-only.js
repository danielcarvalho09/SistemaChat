#!/usr/bin/env node

/**
 * Script SIMPLES para criar APENAS as roles admin e user
 * Execute no Railway: railway run node create-roles-only.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createRoles() {
  try {
    console.log('🔍 Verificando roles...\n');
    
    // Testar conexão com o banco
    console.log('📡 Testando conexão com o banco de dados...');
    await prisma.$connect();
    console.log('✅ Conexão com banco estabelecida\n');
    
    // Verificar roles existentes
    console.log('🔎 Buscando roles existentes...');
    const existingRoles = await prisma.role.findMany();
    console.log(`Roles encontradas: ${existingRoles.length}`);
    if (existingRoles.length > 0) {
      existingRoles.forEach(r => console.log(`  - ${r.name} (${r.id})`));
    } else {
      console.log('  (nenhuma role encontrada)');
    }
    console.log('');
    
    // Criar role admin
    console.log('📝 Criando/atualizando role "admin"...');
    const admin = await prisma.role.upsert({
      where: { name: 'admin' },
      update: {},
      create: {
        name: 'admin',
        description: 'Administrator with full access',
      },
    });
    console.log(`✅ Role "admin" OK (${admin.id})`);
    
    // Criar role user
    console.log('📝 Criando/atualizando role "user"...');
    const user = await prisma.role.upsert({
      where: { name: 'user' },
      update: {},
      create: {
        name: 'user',
        description: 'Regular user with limited access',
      },
    });
    console.log(`✅ Role "user" OK (${user.id})`);
    
    console.log('\n✅ Pronto! Agora você pode criar usuários.');
    console.log('📊 Total de roles: 2 (admin, user)\n');
    
  } catch (error) {
    console.error('\n❌ Erro ao criar roles:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    console.log('🔌 Desconectando do banco...');
    await prisma.$disconnect();
    console.log('✅ Desconectado\n');
  }
}

createRoles();
