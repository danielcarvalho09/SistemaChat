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
    
    // Verificar roles existentes
    const existingRoles = await prisma.role.findMany();
    console.log(`Roles encontradas: ${existingRoles.length}`);
    existingRoles.forEach(r => console.log(`  - ${r.name}`));
    
    // Criar role admin
    const admin = await prisma.role.upsert({
      where: { name: 'admin' },
      update: {},
      create: {
        name: 'admin',
        description: 'Administrator with full access',
      },
    });
    console.log(`\n✅ Role "admin" OK (${admin.id})`);
    
    // Criar role user
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
    
  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createRoles();
