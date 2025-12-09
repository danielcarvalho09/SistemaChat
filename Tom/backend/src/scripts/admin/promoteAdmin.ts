import { getPrismaClient } from '../../config/database.js';
import { logger } from '../../config/logger.js';

/**
 * Script para promover um usuário a admin
 * Uso: npm run promote-admin <email>
 */
async function promoteToAdmin(email: string) {
  const prisma = getPrismaClient();

  try {
    logger.info(`🔍 Buscando usuário: ${email}`);

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
      logger.error(`❌ Usuário não encontrado: ${email}`);
      process.exit(1);
    }

    logger.info(`✅ Usuário encontrado: ${user.name} (${user.email})`);

    // Buscar role admin
    const adminRole = await prisma.role.findUnique({
      where: { name: 'admin' },
    });

    if (!adminRole) {
      logger.error('❌ Role admin não encontrada. Execute o seed primeiro.');
      process.exit(1);
    }

    // Verificar se já é admin
    const isAlreadyAdmin = user.roles.some((ur: { role: { name: string } }) => ur.role.name === 'admin');

    if (isAlreadyAdmin) {
      logger.info('ℹ️  Usuário já é admin');
      process.exit(0);
    }

    // Garantir que usuário tenha apenas uma role - remover outras antes de adicionar admin
    await prisma.userRole.deleteMany({
      where: { userId: user.id },
    });
    
    // Adicionar role admin
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: adminRole.id,
      },
    });

    logger.info(`✅ Usuário ${email} promovido a admin com sucesso!`);
    
    // Mostrar roles atuais
    const updatedUser = await prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    const roleNames = updatedUser?.roles.map((ur: { role: { name: string } }) => ur.role.name).join(', ');
    logger.info(`📋 Roles atuais: ${roleNames}`);

  } catch (error) {
    logger.error('❌ Erro ao promover usuário:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar script
const email = process.argv[2];

if (!email) {
  console.error('❌ Por favor, forneça um email');
  console.log('Uso: npm run promote-admin <email>');
  process.exit(1);
}

promoteToAdmin(email);
