import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearAllConversations() {
  console.log('🧹 Iniciando limpeza de conversas...\n');

  try {
    // 1. Deletar todas as tags de conversas
    console.log('🏷️  Deletando tags de conversas...');
    const deletedTags = await prisma.conversationTag.deleteMany();
    console.log(`   ✅ ${deletedTags.count} tags de conversas deletadas\n`);

    // 2. Deletar todas as transferências
    console.log('🔄 Deletando transferências...');
    const deletedTransfers = await prisma.conversationTransfer.deleteMany();
    console.log(`   ✅ ${deletedTransfers.count} transferências deletadas\n`);

    // 3. Deletar todos os anexos
    console.log('📎 Deletando anexos...');
    const deletedAttachments = await prisma.attachment.deleteMany();
    console.log(`   ✅ ${deletedAttachments.count} anexos deletados\n`);

    // 4. Deletar todas as métricas de conversas
    console.log('📊 Deletando métricas...');
    const deletedMetrics = await prisma.conversationMetric.deleteMany();
    console.log(`   ✅ ${deletedMetrics.count} métricas deletadas\n`);

    // 5. Deletar todas as mensagens
    console.log('💬 Deletando mensagens...');
    const deletedMessages = await prisma.message.deleteMany();
    console.log(`   ✅ ${deletedMessages.count} mensagens deletadas\n`);

    // 6. Deletar todas as conversas
    console.log('🗨️  Deletando conversas...');
    const deletedConversations = await prisma.conversation.deleteMany();
    console.log(`   ✅ ${deletedConversations.count} conversas deletadas\n`);

    // 7. Deletar todos os contatos (opcional - descomente se quiser deletar contatos também)
    console.log('👥 Deletando contatos...');
    const deletedContacts = await prisma.contact.deleteMany();
    console.log(`   ✅ ${deletedContacts.count} contatos deletados\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ LIMPEZA CONCLUÍDA COM SUCESSO!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📊 Resumo:');
    console.log(`   - Tags: ${deletedTags.count}`);
    console.log(`   - Transferências: ${deletedTransfers.count}`);
    console.log(`   - Anexos: ${deletedAttachments.count}`);
    console.log(`   - Métricas: ${deletedMetrics.count}`);
    console.log(`   - Mensagens: ${deletedMessages.count}`);
    console.log(`   - Conversas: ${deletedConversations.count}`);
    console.log(`   - Contatos: ${deletedContacts.count}`);
    console.log('');

  } catch (error) {
    console.error('❌ Erro ao limpar conversas:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
clearAllConversations()
  .then(() => {
    console.log('✅ Script finalizado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Falha ao executar script:', error);
    process.exit(1);
  });
