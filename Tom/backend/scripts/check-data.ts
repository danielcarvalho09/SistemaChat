import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
  console.log('📊 Verificando dados do sistema...\n');
  
  try {
    const users = await prisma.user.count();
    const departments = await prisma.department.count();
    const connections = await prisma.whatsAppConnection.count();
    const messages = await prisma.message.count();
    const conversations = await prisma.conversation.count();
    const contacts = await prisma.contact.count();

    console.log('✅ DADOS MANTIDOS (não foram deletados):');
    console.log(`  👥 Usuários: ${users}`);
    console.log(`  🏢 Departamentos: ${departments}`);
    console.log(`  📱 Conexões WhatsApp: ${connections}`);
    console.log(`  📞 Contatos: ${contacts}`);
    
    console.log('\n🧹 DADOS LIMPOS (foram deletados):');
    console.log(`  💬 Mensagens: ${messages}`);
    console.log(`  📋 Conversas: ${conversations}`);

    console.log('\n✅ Seus usuários, departamentos e conexões estão intactos!\n');

  } catch (error) {
    console.error('❌ Erro ao verificar dados:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
