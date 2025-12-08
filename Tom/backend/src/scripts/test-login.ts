import { getPrismaClient } from '../config/database.js';
import { comparePassword } from '../utils/password.js';

const prisma = getPrismaClient();

async function testLogin() {
  try {
    const email = process.argv[2] || 'admin@admin.com';
    const password = process.argv[3] || 'admin123';

    console.log(`🔐 Testando login para: ${email}\n`);

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      console.log('❌ Usuário não encontrado');
      process.exit(1);
    }

    console.log(`✅ Usuário encontrado: ${user.name}`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Status: ${user.isActive ? '✅ Ativo' : '❌ Inativo'}`);
    const roles = user.roles.map(ur => ur.role.name);
    console.log(`   Roles: ${roles.join(', ')}`);
    console.log('');

    if (!user.isActive) {
      console.log('❌ Usuário está INATIVO - login será rejeitado');
      process.exit(1);
    }

    // Verificar senha
    console.log('🔑 Verificando senha...');
    const isPasswordValid = await comparePassword(password, user.password);
    
    if (isPasswordValid) {
      console.log('✅ Senha CORRETA');
    } else {
      console.log('❌ Senha INCORRETA');
      console.log('');
      console.log('💡 Dica: Verifique se a senha está correta');
      console.log('   Para resetar a senha, você pode:');
      console.log('   1. Usar o script de reset de senha');
      console.log('   2. Ou atualizar diretamente no banco');
    }

  } catch (error: any) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();

