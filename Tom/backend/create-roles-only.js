#!/usr/bin/env node

/**
 * Script para criar apenas as roles básicas no banco de dados
 * Usado no Railway para garantir que as roles existam antes de iniciar o servidor
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createRolesOnly() {
  try {
    console.log('👥 Criando roles básicas...');
    
    // Criar role admin
    await prisma.role.upsert({
      where: { name: 'admin' },
      update: {},
      create: {
        name: 'admin',
        description: 'Administrator with full access',
      },
    });
    console.log('✅ Role "admin" criada/atualizada');

    // Criar role user
    await prisma.role.upsert({
      where: { name: 'user' },
      update: {},
      create: {
        name: 'user',
        description: 'Regular user with limited access',
      },
    });
    console.log('✅ Role "user" criada/atualizada');

    // Criar role gerente
    await prisma.role.upsert({
      where: { name: 'gerente' },
      update: {},
      create: {
        name: 'gerente',
        description: 'Manager with broadcast and contact list access',
      },
    });
    console.log('✅ Role "gerente" criada/atualizada');

    console.log('\n✅ Roles básicas criadas com sucesso!');
  } catch (error) {
    console.error('\n❌ ERRO ao criar roles:');
    console.error('Mensagem:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
createRolesOnly();

