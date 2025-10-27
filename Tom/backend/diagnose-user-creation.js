#!/usr/bin/env node

/**
 * Script para diagnosticar e corrigir problemas de criação de usuário
 * Execute: node diagnose-user-creation.js
 */

import { getPrismaClient } from './src/config/database.js';
import bcrypt from 'bcrypt';

console.log('🔍 DIAGNÓSTICO DE CRIAÇÃO DE USUÁRIO');
console.log('=====================================\n');

async function diagnoseUserCreation() {
  const prisma = getPrismaClient();
  
  try {
    // 1. Verificar conexão com banco
    console.log('1️⃣ Verificando conexão com banco de dados...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Conexão com banco OK\n');

    // 2. Verificar se roles existem
    console.log('2️⃣ Verificando roles no banco...');
    const roles = await prisma.role.findMany();
    console.log(`📋 Roles encontradas: ${roles.length}`);
    roles.forEach(role => {
      console.log(`   - ${role.name}: ${role.description}`);
    });

    if (roles.length === 0) {
      console.log('❌ PROBLEMA: Nenhuma role encontrada!');
      console.log('🔧 Executando seed do banco...');
      
      // Executar seed
      const { seedDatabase } = await import('./src/utils/seed.js');
      await seedDatabase();
      
      console.log('✅ Seed executado com sucesso!');
    }
    console.log('');

    // 3. Verificar usuários existentes
    console.log('3️⃣ Verificando usuários existentes...');
    const users = await prisma.user.findMany({
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
    
    console.log(`👥 Usuários encontrados: ${users.length}`);
    users.forEach(user => {
      const userRoles = user.roles.map(ur => ur.role.name).join(', ');
      console.log(`   - ${user.name} (${user.email}) - Roles: ${userRoles}`);
    });
    console.log('');

    // 4. Testar criação de usuário
    console.log('4️⃣ Testando criação de usuário...');
    const testUserData = {
      email: 'teste@teste.com',
      password: '123456',
      name: 'Usuário Teste',
      role: 'user',
    };

    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: testUserData.email },
    });

    if (existingUser) {
      console.log('⚠️ Usuário de teste já existe, removendo...');
      await prisma.user.delete({
        where: { id: existingUser.id },
      });
    }

    // Criar usuário de teste
    const hashedPassword = await bcrypt.hash(testUserData.password, 10);
    
    const userRole = await prisma.role.findUnique({
      where: { name: testUserData.role },
    });

    if (!userRole) {
      throw new Error(`Role '${testUserData.role}' não encontrada!`);
    }

    const newUser = await prisma.user.create({
      data: {
        email: testUserData.email,
        password: hashedPassword,
        name: testUserData.name,
        isActive: true,
      },
    });

    // Atribuir role
    await prisma.userRole.create({
      data: {
        userId: newUser.id,
        roleId: userRole.id,
      },
    });

    console.log('✅ Usuário de teste criado com sucesso!');
    console.log(`   - ID: ${newUser.id}`);
    console.log(`   - Email: ${newUser.email}`);
    console.log(`   - Role: ${testUserData.role}`);

    // Limpar usuário de teste
    await prisma.user.delete({
      where: { id: newUser.id },
    });
    console.log('🧹 Usuário de teste removido\n');

    // 5. Verificar permissões
    console.log('5️⃣ Verificando permissões...');
    const permissions = await prisma.permission.findMany();
    console.log(`🔐 Permissões encontradas: ${permissions.length}`);
    
    const rolePermissions = await prisma.rolePermission.findMany({
      include: {
        role: true,
        permission: true,
      },
    });
    
    console.log(`🔗 Associações role-permissão: ${rolePermissions.length}`);
    console.log('');

    console.log('✅ DIAGNÓSTICO CONCLUÍDO - Sistema funcionando corretamente!');
    
  } catch (error) {
    console.error('❌ ERRO durante diagnóstico:', error);
    console.error('📊 Detalhes:', error.message);
    console.error('🔍 Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar diagnóstico
diagnoseUserCreation();
