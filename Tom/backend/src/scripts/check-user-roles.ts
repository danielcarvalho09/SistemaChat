import { getPrismaClient } from '../config/database.js';

const prisma = getPrismaClient();

async function checkUserRoles() {
  try {
    console.log('🔍 Verificando roles dos usuários...\n');

    const users = await prisma.user.findMany({
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    console.log(`Total de usuários: ${users.length}\n`);

    users.forEach((user) => {
      const roles = user.roles.map((ur) => ur.role.name);
      const isAdmin = roles.includes('admin');
      
      console.log(`👤 ${user.name} (${user.email})`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Status: ${user.isActive ? '✅ Ativo' : '❌ Inativo'}`);
      console.log(`   Roles: ${roles.length > 0 ? roles.join(', ') : '❌ Nenhuma role'}`);
      console.log(`   É Admin: ${isAdmin ? '✅ SIM' : '❌ NÃO'}`);
      console.log('');
    });

    // Verificar se existe role 'admin' no banco
    const adminRole = await prisma.role.findUnique({
      where: { name: 'admin' },
    });

    console.log('\n📋 Verificando role "admin" no banco:');
    if (adminRole) {
      console.log(`   ✅ Role "admin" existe (ID: ${adminRole.id})`);
    } else {
      console.log('   ❌ Role "admin" NÃO existe no banco!');
      console.log('   💡 Execute a migração para criar as roles.');
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserRoles();

