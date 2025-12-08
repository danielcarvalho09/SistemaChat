import { getPrismaClient } from '../config/database.js';

const prisma = getPrismaClient();

async function forceTokenRefresh() {
  try {
    const email = process.argv[2];
    
    if (!email) {
      console.log('❌ Por favor, forneça um email como argumento:');
      console.log('   npx tsx src/scripts/force-token-refresh.ts <email>');
      process.exit(1);
    }

    console.log(`🔄 Forçando refresh de tokens para: ${email}\n`);

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
      console.log(`❌ Usuário não encontrado: ${email}`);
      process.exit(1);
    }

    console.log(`✅ Usuário encontrado: ${user.name}`);
    const roles = user.roles.map(ur => ur.role.name);
    console.log(`   Roles: ${roles.join(', ')}`);
    console.log('');

    // Deletar todos os refresh tokens do usuário
    const deleted = await prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    });

    console.log(`🗑️  Deletados ${deleted.count} refresh tokens antigos`);
    console.log('');
    console.log('✅ Próximos passos:');
    console.log('   1. Faça logout no frontend');
    console.log('   2. Faça login novamente');
    console.log('   3. Um novo token será gerado com as roles corretas');

  } catch (error: any) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

forceTokenRefresh();

