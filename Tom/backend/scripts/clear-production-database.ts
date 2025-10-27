import { PrismaClient } from '@prisma/client';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function clearProductionDatabase() {
  console.log('\n🚨 ⚠️  ATENÇÃO: VOCÊ ESTÁ PRESTES A APAGAR TODOS OS DADOS! ⚠️  🚨\n');
  console.log('Esta ação irá deletar:');
  console.log('  ❌ Todas as conversas');
  console.log('  ❌ Todas as mensagens');
  console.log('  ❌ Todos os usuários');
  console.log('  ❌ Todas as conexões WhatsApp');
  console.log('  ❌ Todos os departamentos');
  console.log('  ❌ TUDO!\n');
  
  rl.question('Digite "SIM APAGAR TUDO" para confirmar: ', async (answer) => {
    if (answer !== 'SIM APAGAR TUDO') {
      console.log('\n❌ Operação cancelada.\n');
      rl.close();
      process.exit(0);
    }

    const DATABASE_URL = process.env.DATABASE_URL;
    
    if (!DATABASE_URL) {
      console.error('\n❌ DATABASE_URL não configurada!\n');
      rl.close();
      process.exit(1);
    }

    console.log('\n🗑️  Iniciando limpeza TOTAL do banco de dados...\n');

    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: DATABASE_URL
        }
      }
    });

    try {
      // Ordem correta respeitando dependências (child -> parent)
      console.log('🗑️  Deletando tags de conversas...');
      await prisma.conversationTag.deleteMany({});
      
      console.log('🗑️  Deletando histórico de conversas...');
      await prisma.conversationHistory.deleteMany({});
      
      console.log('🗑️  Deletando métricas de conversas...');
      await prisma.conversationMetric.deleteMany({});
      
      console.log('🗑️  Deletando anexos...');
      await prisma.attachment.deleteMany({});
      
      console.log('🗑️  Deletando mensagens...');
      await prisma.message.deleteMany({});
      
      console.log('🗑️  Deletando transferências...');
      await prisma.conversationTransfer.deleteMany({});
      
      console.log('🗑️  Deletando conversas...');
      await prisma.conversation.deleteMany({});
      
      console.log('🗑️  Deletando conexões WhatsApp...');
      await prisma.whatsAppConnection.deleteMany({});
      
      console.log('🗑️  Deletando templates de mensagem...');
      await prisma.messageTemplate.deleteMany({});
      
      console.log('🗑️  Deletando acessos de usuários a departamentos...');
      await prisma.userDepartmentAccess.deleteMany({});
      
      console.log('🗑️  Deletando departamentos...');
      await prisma.department.deleteMany({});
      
      console.log('🗑️  Deletando permissões de roles...');
      await prisma.rolePermission.deleteMany({});
      
      console.log('🗑️  Deletando roles de usuários...');
      await prisma.userRole.deleteMany({});
      
      console.log('🗑️  Deletando permissões...');
      await prisma.permission.deleteMany({});
      
      console.log('🗑️  Deletando roles...');
      await prisma.role.deleteMany({});
      
      console.log('🗑️  Deletando usuários...');
      await prisma.user.deleteMany({});

      console.log('\n✅ TODOS OS DADOS FORAM APAGADOS COM SUCESSO!\n');
      console.log('🔄 O banco está COMPLETAMENTE VAZIO agora.\n');
      console.log('💡 Próximos passos:');
      console.log('   1. Rode: npm run prisma:migrate:prod (aplicar schema)');
      console.log('   2. Crie um novo usuário admin\n');

    } catch (error) {
      console.error('\n❌ Erro ao limpar banco:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
      rl.close();
    }
  });
}

clearProductionDatabase();
