/**
 * Script para verificar se o usuário admin existe
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verificarUsuario() {
  try {
    console.log('🔍 Verificando usuário admin...\n');

    const user = await prisma.user.findUnique({
      where: { email: 'admin@sistema.com' },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        departmentAccess: {
          include: {
            department: true,
          },
        },
      },
    });

    if (!user) {
      console.log('❌ Usuário admin@sistema.com NÃO ENCONTRADO!\n');
      console.log('Execute: node criar-usuario-admin.js\n');
      return;
    }

    console.log('✅ Usuário encontrado!\n');
    console.log('═══════════════════════════════════════════');
    console.log('📧 Email:', user.email);
    console.log('👤 Nome:', user.name);
    console.log('🆔 ID:', user.id);
    console.log('📊 Status:', user.status);
    console.log('✅ Ativo:', user.isActive);
    console.log('🔐 Senha Hash:', user.password.substring(0, 20) + '...');
    console.log('\n🏷️  Roles:');
    user.roles.forEach(ur => {
      console.log(`   - ${ur.role.name}`);
    });
    console.log('\n🏢 Departamentos:');
    user.departmentAccess.forEach(da => {
      console.log(`   - ${da.department.name}`);
    });
    console.log('═══════════════════════════════════════════\n');

    // Testar senha
    const bcrypt = require('bcrypt');
    const senhaCorreta = await bcrypt.compare('Admin@123', user.password);
    
    if (senhaCorreta) {
      console.log('✅ Senha "Admin@123" está CORRETA!\n');
    } else {
      console.log('❌ Senha "Admin@123" está INCORRETA!\n');
      console.log('⚠️  Execute novamente: node criar-usuario-admin.js\n');
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verificarUsuario();
