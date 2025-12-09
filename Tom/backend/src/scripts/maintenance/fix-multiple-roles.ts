import { getPrismaClient } from '../../config/database.js';
import { logger } from '../../config/logger.js';

/**
 * Script para corrigir usuários com múltiplas roles
 * Mantém apenas a role mais importante: admin > gerente > user
 */
async function fixMultipleRoles() {
  const prisma = getPrismaClient();

  try {
    logger.info('🔍 Procurando usuários com múltiplas roles...');

    // Buscar todos os usuários com suas roles
    const users = await prisma.user.findMany({
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    // Prioridade das roles (maior número = mais importante)
    const rolePriority: Record<string, number> = {
      admin: 3,
      gerente: 2,
      user: 1,
    };

    let fixedUsers = 0;
    let totalRolesRemoved = 0;

    for (const user of users) {
      if (user.roles.length <= 1) {
        continue; // Usuário já tem apenas uma role ou nenhuma
      }

      logger.warn(`⚠️ Usuário ${user.email} (${user.id}) tem ${user.roles.length} roles:`);
      user.roles.forEach((ur: { role: { name: string }; id: string }) => {
        logger.warn(`   - ${ur.role.name} (${ur.id})`);
      });

      // Encontrar a role mais importante
      let highestPriority = -1;
      let roleToKeep: typeof user.roles[0] | null = null;

      for (const userRole of user.roles) {
        const priority = rolePriority[userRole.role.name] || 0;
        if (priority > highestPriority) {
          highestPriority = priority;
          roleToKeep = userRole;
        }
      }

      if (!roleToKeep) {
        logger.error(`❌ Não foi possível determinar qual role manter para ${user.email}`);
        continue;
      }

      logger.info(`   ✅ Mantendo role: ${roleToKeep.role.name}`);

      // Remover todas as outras roles
      const rolesToRemove = user.roles.filter((ur: { id: string }) => ur.id !== roleToKeep!.id);
      
      for (const roleToRemove of rolesToRemove) {
        logger.info(`   🗑️ Removendo role ${roleToRemove.role.name} (${roleToRemove.id})...`);
        await prisma.userRole.delete({
          where: { id: roleToRemove.id },
        });
        totalRolesRemoved++;
      }

      fixedUsers++;
    }

    if (fixedUsers === 0) {
      logger.info('✅ Nenhum usuário com múltiplas roles encontrado!');
    } else {
      logger.info(`✅ Corrigido ${fixedUsers} usuário(s), removidas ${totalRolesRemoved} roles extras`);
    }

    // Verificar novamente para confirmar
    logger.info('\n🔍 Verificando novamente após correção...');
    const usersAfter = await prisma.user.findMany({
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    let stillMultiple = 0;
    for (const user of usersAfter) {
      if (user.roles.length > 1) {
        stillMultiple++;
        logger.error(`❌ Usuário ${user.email} ainda tem ${user.roles.length} roles!`);
      }
    }

    if (stillMultiple === 0) {
      logger.info('✅ Todos os usuários agora têm apenas 1 role!');
    } else {
      logger.error(`❌ Ainda há ${stillMultiple} usuário(s) com múltiplas roles`);
    }

  } catch (error) {
    logger.error('❌ Erro ao corrigir múltiplas roles:', error);
    throw error;
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  fixMultipleRoles()
    .then(() => {
      logger.info('✅ Script concluído');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Erro no script:', error);
      process.exit(1);
    });
}

export { fixMultipleRoles };

