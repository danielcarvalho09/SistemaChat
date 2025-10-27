/**
 * Script para criar usuário admin completo
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function criarAdmin() {
  try {
    console.log('🔐 Criando estrutura inicial e usuário admin...\n');

    // 1. Criar Roles
    console.log('📋 Criando roles...');
    const adminRole = await prisma.role.upsert({
      where: { name: 'admin' },
      update: {},
      create: {
        name: 'admin',
        description: 'Administrador do sistema com acesso total',
      },
    });

    const userRole = await prisma.role.upsert({
      where: { name: 'user' },
      update: {},
      create: {
        name: 'user',
        description: 'Usuário padrão do sistema',
      },
    });

    console.log('✅ Roles criadas: admin, user\n');

    // 2. Criar Departamento
    console.log('🏢 Criando departamento...');
    const department = await prisma.department.upsert({
      where: { name: 'Administração' },
      update: {},
      create: {
        name: 'Administração',
        description: 'Departamento administrativo',
        isActive: true,
      },
    });

    console.log('✅ Departamento criado: Administração\n');

    // 3. Criar Usuário Admin
    console.log('👤 Criando usuário admin...');
    
    const hashedPassword = await bcrypt.hash('Admin@123', 12);

    const admin = await prisma.user.upsert({
      where: { email: 'admin@sistema.com' },
      update: {
        password: hashedPassword,
        name: 'Administrador',
        status: 'online',
        isActive: true,
      },
      create: {
        email: 'admin@sistema.com',
        password: hashedPassword,
        name: 'Administrador',
        status: 'online',
        isActive: true,
      },
    });

    console.log('✅ Usuário admin criado!\n');

    // 4. Associar Role ao Usuário
    console.log('🔗 Associando role admin...');
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: admin.id,
          roleId: adminRole.id,
        },
      },
      update: {},
      create: {
        userId: admin.id,
        roleId: adminRole.id,
      },
    });

    console.log('✅ Role associada!\n');

    // 5. Associar Departamento ao Usuário
    console.log('🏢 Associando departamento...');
    await prisma.userDepartmentAccess.upsert({
      where: {
        userId_departmentId: {
          userId: admin.id,
          departmentId: department.id,
        },
      },
      update: {},
      create: {
        userId: admin.id,
        departmentId: department.id,
      },
    });

    console.log('✅ Departamento associado!\n');

    // 6. Criar Kanban Stages padrão
    console.log('📊 Criando stages do Kanban...');
    const stages = [
      { name: 'Aguardando', order: 1, color: '#FFA500' },
      { name: 'Em Atendimento', order: 2, color: '#4169E1' },
      { name: 'Resolvido', order: 3, color: '#32CD32' },
      { name: 'Cancelado', order: 4, color: '#DC143C' },
    ];

    for (const stage of stages) {
      const exists = await prisma.kanbanStage.findFirst({
        where: { name: stage.name },
      });
      
      if (!exists) {
        await prisma.kanbanStage.create({
          data: stage,
        });
      }
    }

    console.log('✅ Stages do Kanban criadas!\n');

    // Resumo
    console.log('═══════════════════════════════════════════');
    console.log('🎉 USUÁRIO ADMIN CRIADO COM SUCESSO!');
    console.log('═══════════════════════════════════════════');
    console.log('');
    console.log('📧 Email:    admin@sistema.com');
    console.log('🔑 Senha:    Admin@123');
    console.log('👤 Nome:     Administrador');
    console.log('🏢 Depto:    Administração');
    console.log('🔐 Role:     admin');
    console.log('');
    console.log('⚠️  IMPORTANTE: Altere a senha após o primeiro login!');
    console.log('');
    console.log('🚀 Acesse: http://localhost:5173');
    console.log('═══════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Erro ao criar admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

criarAdmin();
