import { getPrismaClient } from '../../config/database.js';
import { logger } from '../../config/logger.js';

/**
 * Script para encontrar e corrigir roles duplicadas em usuários
 */
async function fixDuplicateRoles() {
  const prisma = getPrismaClient();

  try {
    logger.info('🔍 Procurando roles duplicadas...');

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

    let totalDuplicates = 0;
    let fixedUsers = 0;

    for (const user of users) {
      // Agrupar roles por roleId para encontrar duplicatas
      const roleMap = new Map<string, typeof user.roles[0][]>();
      
      for (const userRole of user.roles) {
        const roleId = userRole.roleId;
        if (!roleMap.has(roleId)) {
          roleMap.set(roleId, []);
        }
        roleMap.get(roleId)!.push(userRole);
      }

      // Verificar se há duplicatas (mesma roleId aparecendo mais de uma vez)
      const duplicates: string[] = [];
      for (const [roleId, userRoles] of roleMap.entries()) {
        if (userRoles.length > 1) {
          duplicates.push(roleId);
          totalDuplicates += userRoles.length - 1; // Contar duplicatas (mantém 1, remove o resto)
        }
      }

      if (duplicates.length > 0) {
        logger.warn(`⚠️ Usuário ${user.email} (${user.id}) tem roles duplicadas:`);
        
        for (const roleId of duplicates) {
          const userRoles = roleMap.get(roleId)!;
          const roleName = userRoles[0].role.name;
          
          logger.warn(`   - Role "${roleName}" aparece ${userRoles.length} vezes`);
          
          // Manter apenas a primeira, remover as duplicatas
          const toKeep = userRoles[0];
          const toRemove = userRoles.slice(1);
          
          for (const duplicate of toRemove) {
            logger.info(`   🗑️ Removendo role duplicada ${duplicate.id}...`);
            await prisma.userRole.delete({
              where: { id: duplicate.id },
            });
          }
        }
        
        fixedUsers++;
      }
    }

    if (totalDuplicates === 0) {
      logger.info('✅ Nenhuma role duplicada encontrada!');
    } else {
      logger.info(`✅ Corrigido ${totalDuplicates} roles duplicadas em ${fixedUsers} usuário(s)`);
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

    let stillDuplicates = 0;
    for (const user of usersAfter) {
      const roleIds = user.roles.map((ur: { roleId: string }) => ur.roleId);
      const uniqueRoleIds = new Set(roleIds);
      if (roleIds.length !== uniqueRoleIds.size) {
        stillDuplicates++;
        logger.error(`❌ Usuário ${user.email} ainda tem roles duplicadas!`);
      }
    }

    if (stillDuplicates === 0) {
      logger.info('✅ Todas as duplicatas foram corrigidas!');
    } else {
      logger.error(`❌ Ainda há ${stillDuplicates} usuário(s) com roles duplicadas`);
    }

  } catch (error) {
    logger.error('❌ Erro ao corrigir roles duplicadas:', error);
    throw error;
  }
  // Não desconectar se for chamado via API (prisma é singleton compartilhado)
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  fixDuplicateRoles()
    .then(() => {
      logger.info('✅ Script concluído');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Erro no script:', error);
      process.exit(1);
    });
}

export { fixDuplicateRoles };

