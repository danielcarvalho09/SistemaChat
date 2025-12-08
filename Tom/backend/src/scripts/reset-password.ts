import { getPrismaClient } from '../config/database.js';
import { hashPassword } from '../utils/password.js';

const prisma = getPrismaClient();

async function resetPassword() {
  try {
    const email = process.argv[2];
    const newPassword = process.argv[3] || 'admin123';

    if (!email) {
      console.log('❌ Por favor, forneça um email como argumento:');
      console.log('   npx tsx src/scripts/reset-password.ts <email> [nova-senha]');
      process.exit(1);
    }

    console.log(`🔐 Resetando senha para: ${email}\n`);

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log(`❌ Usuário não encontrado: ${email}`);
      process.exit(1);
    }

    console.log(`✅ Usuário encontrado: ${user.name}`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Status: ${user.isActive ? '✅ Ativo' : '❌ Inativo'}`);
    console.log('');

    // Gerar hash da nova senha
    console.log('🔑 Gerando hash da nova senha...');
    const hashedPassword = await hashPassword(newPassword);
    console.log('✅ Hash gerado');
    console.log('');

    // Atualizar senha
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    console.log('✅ Senha resetada com sucesso!');
    console.log('');
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Nova senha: ${newPassword}`);
    console.log('');
    console.log('💡 Agora você pode fazer login com esta senha');

  } catch (error: any) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword();
