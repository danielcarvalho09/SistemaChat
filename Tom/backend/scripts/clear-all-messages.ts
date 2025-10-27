import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearAllMessages() {
  console.log('🧹 Limpando todas as mensagens e conversas...\n');
  
  try {
    // 1. Deletar transferências de conversas
    const transfers = await prisma.conversationTransfer.deleteMany({});
    console.log(`✅ ${transfers.count} transferências deletadas`);

    // 2. Deletar mensagens
    const messages = await prisma.message.deleteMany({});
    console.log(`✅ ${messages.count} mensagens deletadas`);

    // 3. Deletar conversas
    const conversations = await prisma.conversation.deleteMany({});
    console.log(`✅ ${conversations.count} conversas deletadas`);

    // 4. Opcional: Deletar contatos (descomente se quiser)
    // const contacts = await prisma.contact.deleteMany({});
    // console.log(`✅ ${contacts.count} contatos deletados`);

    console.log('\n✅ Limpeza concluída com sucesso!');
    console.log('🚀 Você pode começar a testar do zero agora!\n');

    // Verificar resultado
    const remaining = {
      messages: await prisma.message.count(),
      conversations: await prisma.conversation.count(),
      transfers: await prisma.conversationTransfer.count(),
    };

    console.log('📊 Estatísticas finais:');
    console.log(`  - Mensagens: ${remaining.messages}`);
    console.log(`  - Conversas: ${remaining.conversations}`);
    console.log(`  - Transferências: ${remaining.transfers}\n`);

  } catch (error) {
    console.error('❌ Erro ao limpar dados:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
clearAllMessages();
