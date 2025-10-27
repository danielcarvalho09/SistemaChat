#!/usr/bin/env node

/**
 * Script para testar criação de usuário
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function testUserCreation() {
  try {
    console.log('🧪 Testando criação de usuário...\n');
    
    const testData = {
      email: 'teste@exemplo.com',
      password: '123456',
      name: 'Usuário Teste',
      role: 'user',
    };
    
    // Verificar se usuário já existe
    const existing = await prisma.user.findUnique({
      where: { email: testData.email },
    });
    
    if (existing) {
      console.log('⚠️  Usuário de teste já existe, removendo...');
      await prisma.user.delete({
        where: { id: existing.id },
      });
      console.log('✅ Usuário removido\n');
    }
    
    // Buscar role
    console.log(`🔍 Buscando role "${testData.role}"...`);
    const role = await prisma.role.findUnique({
      where: { name: testData.role },
    });
    
    if (!role) {
      console.error(`❌ Role "${testData.role}" não encontrada!`);
      process.exit(1);
    }
    
    console.log(`✅ Role encontrada: ${role.name} (${role.id})\n`);
    
    // Hash da senha
    console.log('🔐 Gerando hash da senha...');
    const hashedPassword = await bcrypt.hash(testData.password, 10);
    console.log('✅ Hash gerado\n');
    
    // Criar usuário em transação
    console.log('👤 Criando usuário...');
    const result = await prisma.$transaction(async (tx) => {
      // Criar usuário
      const user = await tx.user.create({
        data: {
          email: testData.email,
          password: hashedPassword,
          name: testData.name,
          isActive: true,
        },
      });
      
      console.log(`✅ Usuário criado: ${user.id}`);
      
      // Atribuir role
      console.log('🔗 Atribuindo role...');
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
        },
      });
      
      console.log('✅ Role atribuída');
      
      // Buscar usuário completo
      return await tx.user.findUnique({
        where: { id: user.id },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });
    });
    
    console.log('\n✅ SUCESSO! Usuário criado com sucesso:');
    console.log(`   - ID: ${result.id}`);
    console.log(`   - Nome: ${result.name}`);
    console.log(`   - Email: ${result.email}`);
    console.log(`   - Role: ${result.roles[0].role.name}`);
    
    // Limpar
    console.log('\n🧹 Removendo usuário de teste...');
    await prisma.user.delete({
      where: { id: result.id },
    });
    console.log('✅ Usuário de teste removido');
    
    console.log('\n✅ TESTE CONCLUÍDO - Sistema funcionando corretamente!');
    
  } catch (error) {
    console.error('\n❌ ERRO ao criar usuário:');
    console.error('Mensagem:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testUserCreation();
