#!/usr/bin/env node

/**
 * Script para executar seed do banco no Railway
 * Execute no Railway CLI: railway run node railway-seed.js
 * Ou adicione como comando one-time no Railway dashboard
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

console.log('🌱 EXECUTANDO SEED DO BANCO DE DADOS NO RAILWAY');
console.log('================================================\n');

async function seedRailway() {
  try {
    console.log('🔌 Conectando ao banco de dados...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Conexão estabelecida\n');

    // Criar roles padrão
    console.log('👥 Criando roles...');
    const adminRole = await prisma.role.upsert({
      where: { name: 'admin' },
      update: {},
      create: {
        name: 'admin',
        description: 'Administrator with full access',
      },
    });
    console.log('✅ Role "admin" criada/atualizada');

    const userRole = await prisma.role.upsert({
      where: { name: 'user' },
      update: {},
      create: {
        name: 'user',
        description: 'Regular user with limited access',
      },
    });
    console.log('✅ Role "user" criada/atualizada\n');

    // Definir permissões
    console.log('🔐 Criando permissões...');
    const permissions = [
      // Conexões
      { name: 'manage_connections', resource: 'connections', action: 'manage', description: 'Manage WhatsApp connections' },
      { name: 'view_connections', resource: 'connections', action: 'read', description: 'View WhatsApp connections' },
      
      // Conversas
      { name: 'view_all_conversations', resource: 'conversations', action: 'read', description: 'View all conversations' },
      { name: 'view_own_conversations', resource: 'conversations', action: 'read', description: 'View own conversations' },
      { name: 'manage_conversations', resource: 'conversations', action: 'manage', description: 'Manage conversations' },
      { name: 'accept_conversations', resource: 'conversations', action: 'create', description: 'Accept conversations from queue' },
      { name: 'transfer_conversations', resource: 'conversations', action: 'update', description: 'Transfer conversations' },
      
      // Mensagens
      { name: 'send_messages', resource: 'messages', action: 'create', description: 'Send messages' },
      { name: 'view_messages', resource: 'messages', action: 'read', description: 'View messages' },
      
      // Usuários
      { name: 'manage_users', resource: 'users', action: 'manage', description: 'Manage users' },
      { name: 'view_users', resource: 'users', action: 'read', description: 'View users' },
      
      // Departamentos
      { name: 'manage_departments', resource: 'departments', action: 'manage', description: 'Manage departments' },
      { name: 'view_departments', resource: 'departments', action: 'read', description: 'View departments' },
      
      // Templates
      { name: 'manage_templates', resource: 'templates', action: 'manage', description: 'Manage message templates' },
      { name: 'use_templates', resource: 'templates', action: 'read', description: 'Use message templates' },
      
      // Métricas
      { name: 'view_analytics', resource: 'analytics', action: 'read', description: 'View analytics and metrics' },
      { name: 'export_reports', resource: 'analytics', action: 'create', description: 'Export reports' },
    ];

    // Criar permissões
    const createdPermissions = [];
    for (const perm of permissions) {
      const permission = await prisma.permission.upsert({
        where: { name: perm.name },
        update: {},
        create: perm,
      });
      createdPermissions.push(permission);
    }
    console.log(`✅ ${createdPermissions.length} permissões criadas/atualizadas\n`);

    // Atribuir todas as permissões ao admin
    console.log('🔗 Atribuindo permissões ao admin...');
    for (const permission of createdPermissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      });
    }
    console.log('✅ Permissões atribuídas ao admin\n');

    // Atribuir permissões limitadas ao user
    console.log('🔗 Atribuindo permissões ao user...');
    const userPermissionNames = [
      'view_connections',
      'view_own_conversations',
      'accept_conversations',
      'transfer_conversations',
      'send_messages',
      'view_messages',
      'view_departments',
      'use_templates',
    ];

    const userPermissions = createdPermissions.filter((p) =>
      userPermissionNames.includes(p.name)
    );

    for (const permission of userPermissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: userRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: userRole.id,
          permissionId: permission.id,
        },
      });
    }
    console.log('✅ Permissões atribuídas ao user\n');

    // Criar departamentos padrão
    console.log('🏢 Criando departamentos padrão...');
    const defaultDepartments = [
      { name: 'Recepção', description: 'Atendimento inicial', color: '#3B82F6', icon: 'inbox' },
      { name: 'Comercial', description: 'Vendas e orçamentos', color: '#10B981', icon: 'shopping-cart' },
      { name: 'Suporte Técnico', description: 'Suporte técnico', color: '#F59E0B', icon: 'tool' },
      { name: 'RH', description: 'Recursos Humanos', color: '#8B5CF6', icon: 'users' },
      { name: 'Financeiro', description: 'Financeiro e cobranças', color: '#EF4444', icon: 'dollar-sign' },
    ];

    for (const dept of defaultDepartments) {
      await prisma.department.upsert({
        where: { name: dept.name },
        update: {},
        create: dept,
      });
    }
    console.log(`✅ ${defaultDepartments.length} departamentos criados/atualizados\n`);

    console.log('═══════════════════════════════════════════════');
    console.log('✅ SEED EXECUTADO COM SUCESSO!');
    console.log('═══════════════════════════════════════════════\n');
    console.log('📋 O que foi criado:');
    console.log('   ✓ 2 Roles (admin, user)');
    console.log(`   ✓ ${createdPermissions.length} Permissões`);
    console.log(`   ✓ ${defaultDepartments.length} Departamentos`);
    console.log('   ✓ Associações role-permissão\n');
    
    console.log('🎯 Agora você pode:');
    console.log('   1. Criar usuários normalmente');
    console.log('   2. Fazer login com usuários existentes');
    console.log('   3. Usar todas as funcionalidades do sistema\n');
    
  } catch (error) {
    console.error('\n❌ ERRO durante seed:');
    console.error('Mensagem:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar seed
seedRailway();
