import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { getPrismaClient } from './src/config/database.js';

const prisma = getPrismaClient();

async function resetPassword() {
  const email = process.argv[2] || 'daniel@carvalhostudio.com.br';
  const newPassword = process.argv[3] || 'admin123';

  try {
    console.log(`🔐 Resetando senha para: ${email}`);
    console.log(`🔑 Nova senha: ${newPassword}\n`);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log(`❌ Usuário não encontrado: ${email}`);
      process.exit(1);
    }

    console.log(`✅ Usuário encontrado: ${user.name}`);
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    console.log('✅ Senha resetada com sucesso!');
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Nova senha: ${newPassword}`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword();

