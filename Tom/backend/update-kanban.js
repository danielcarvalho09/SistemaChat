// Script para atualizar conversas existentes com etapa padrão do Kanban
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateConversations() {
  try {
    console.log('🔍 Buscando etapa padrão do Kanban...');
    
    // Buscar etapa padrão
    const defaultStage = await prisma.kanbanStage.findFirst({
      where: { isDefault: true },
    });

    if (!defaultStage) {
      console.error('❌ Nenhuma etapa padrão encontrada!');
      console.log('💡 Execute primeiro: POST http://localhost:3000/api/v1/kanban/initialize');
      process.exit(1);
    }

    console.log(`✅ Etapa padrão encontrada: ${defaultStage.name} (${defaultStage.id})`);
    console.log('');
    console.log('🔄 Atualizando conversas em atendimento...');

    // Atualizar todas as conversas que:
    // 1. Não têm kanbanStageId
    // 2. Têm assignedUserId (estão em atendimento)
    const result = await prisma.conversation.updateMany({
      where: {
        kanbanStageId: null,
        assignedUserId: { not: null },
      },
      data: {
        kanbanStageId: defaultStage.id,
      },
    });

    console.log(`✅ ${result.count} conversas atualizadas com sucesso!`);
    console.log('');
    console.log('🎯 Agora acesse /dashboard/kanban para ver suas conversas!');

  } catch (error) {
    console.error('❌ Erro ao atualizar conversas:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateConversations();
