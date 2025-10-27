import { getPrismaClient } from '../config/database.js';
import { logger } from '../config/logger.js';

/**
 * Seed inicial do banco de dados
 * Cria roles e permissões padrão
 */
export async function seedDatabase() {
  const prisma = getPrismaClient();

  try {
    logger.info('🌱 Seeding database...');

    // Criar roles padrão
    const adminRole = await prisma.role.upsert({
      where: { name: 'admin' },
      update: {},
      create: {
        name: 'admin',
        description: 'Administrator with full access',
      },
    });

    const userRole = await prisma.role.upsert({
      where: { name: 'user' },
      update: {},
      create: {
        name: 'user',
        description: 'Regular user with limited access',
      },
    });

    // Definir permissões
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
    const createdPermissions = await Promise.all(
      permissions.map((perm) =>
        prisma.permission.upsert({
          where: { name: perm.name },
          update: {},
          create: perm,
        })
      )
    );

    // Atribuir todas as permissões ao admin
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

    // Atribuir permissões limitadas ao user
    const userPermissions = createdPermissions.filter((p) =>
      [
        'view_connections',
        'view_own_conversations',
        'accept_conversations',
        'transfer_conversations',
        'send_messages',
        'view_messages',
        'view_departments',
        'use_templates',
      ].includes(p.name)
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

    // Criar departamentos padrão
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

    logger.info('✅ Database seeded successfully');
  } catch (error) {
    logger.error('❌ Error seeding database:', error);
    throw error;
  }
}
