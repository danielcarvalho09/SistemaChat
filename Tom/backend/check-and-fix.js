#!/usr/bin/env node

/**
 * Script para verificar e corrigir problemas de criação de usuário
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAndFix() {
  try {
    console.log('🔍 Verificando roles no banco...\n');
    
    // Verificar roles
    const roles = await prisma.role.findMany();
    console.log(`📋 Roles encontradas: ${roles.length}`);
    
    if (roles.length === 0) {
      console.log('❌ Nenhuma role encontrada! Criando roles padrão...\n');
      
      // Criar role admin
      const adminRole = await prisma.role.create({
        data: {
          name: 'admin',
          description: 'Administrator with full access',
        },
      });
      console.log('✅ Role "admin" criada');
      
      // Criar role user
      const userRole = await prisma.role.create({
        data: {
          name: 'user',
          description: 'Regular user with limited access',
        },
      });
      console.log('✅ Role "user" criada\n');
      
      console.log('✅ Roles criadas com sucesso!');
    } else {
      console.log('✅ Roles já existem:');
      roles.forEach(role => {
        console.log(`   - ${role.name}: ${role.description}`);
      });
    }
    
    // Verificar usuários
    console.log('\n👥 Verificando usuários...');
    const users = await prisma.user.findMany({
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
    
    console.log(`Total de usuários: ${users.length}`);
    users.forEach(user => {
      const userRoles = user.roles.map(ur => ur.role.name).join(', ');
      console.log(`   - ${user.name} (${user.email}) - Roles: ${userRoles || 'Nenhuma'}`);
    });
    
    console.log('\n✅ Verificação concluída! Agora você pode criar usuários.');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkAndFix();
