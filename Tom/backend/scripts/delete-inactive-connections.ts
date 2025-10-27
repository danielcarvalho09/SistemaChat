import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteInactiveConnections() {
  console.log('🔍 Listando todas as conexões...\n');
  
  try {
    // Listar todas as conexões
    const connections = await prisma.whatsAppConnection.findMany({
      include: {
        conversations: {
          select: { id: true },
        },
        departments: {
          include: {
            department: {
              select: { name: true },
            },
          },
        },
      },
    });

    console.log(`📊 Total de conexões: ${connections.length}\n`);

    // Mostrar detalhes de cada conexão
    for (const conn of connections) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📱 Nome: ${conn.name}`);
      console.log(`📞 Telefone: ${conn.phoneNumber}`);
      console.log(`🆔 ID: ${conn.id}`);
      console.log(`📊 Status: ${conn.status}`);
      console.log(`✅ Ativa: ${conn.isActive}`);
      console.log(`💬 Conversas: ${conn.conversations.length}`);
      console.log(`🏢 Departamentos: ${conn.departments.map(d => d.department.name).join(', ') || 'Nenhum'}`);
      console.log(`📅 Criada em: ${conn.createdAt.toLocaleString('pt-BR')}`);
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Identificar conexões que podem ser deletadas
    const inactiveConnections = connections.filter(
      conn => conn.conversations.length === 0 && conn.departments.length === 0
    );

    if (inactiveConnections.length === 0) {
      console.log('✅ Não há conexões inativas sem uso para deletar.\n');
      console.log('⚠️  Para deletar conexões com conversas/departamentos, você precisa:');
      console.log('   1. Transferir as conversas para outra conexão');
      console.log('   2. Remover os departamentos vinculados');
      console.log('   3. Depois executar este script novamente\n');
      return;
    }

    console.log(`⚠️  Encontradas ${inactiveConnections.length} conexões sem uso:\n`);
    
    for (const conn of inactiveConnections) {
      console.log(`   - ${conn.name} (${conn.phoneNumber})`);
    }

    console.log('\n❓ Deseja deletar estas conexões? (y/n)');
    
    // Aguardar confirmação do usuário
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    readline.question('Digite "y" para confirmar: ', async (answer: string) => {
      if (answer.toLowerCase() === 'y') {
        console.log('\n🗑️  Deletando conexões inativas...\n');
        
        for (const conn of inactiveConnections) {
          try {
            await prisma.whatsAppConnection.delete({
              where: { id: conn.id },
            });
            console.log(`✅ Deletada: ${conn.name}`);
          } catch (error) {
            console.error(`❌ Erro ao deletar ${conn.name}:`, error);
          }
        }

        console.log('\n✅ Processo concluído!\n');
      } else {
        console.log('\n❌ Operação cancelada.\n');
      }

      readline.close();
      await prisma.$disconnect();
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

deleteInactiveConnections();
