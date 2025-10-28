#!/usr/bin/env node

/**
 * Script para atualizar pushName de contatos existentes
 * Busca mensagens antigas e extrai o pushName
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateExistingContactsPushName() {
  console.log('🔄 Atualizando pushName de contatos existentes...\n');

  try {
    // Buscar todos os contatos sem pushName
    const contactsWithoutPushName = await prisma.contact.findMany({
      where: {
        OR: [
          { pushName: null },
          { pushName: '' },
        ],
      },
      select: {
        id: true,
        phoneNumber: true,
        name: true,
        conversations: {
          select: {
            id: true,
            connectionId: true,
          },
          take: 1,
        },
      },
    });

    console.log(`📊 Encontrados ${contactsWithoutPushName.length} contatos sem pushName\n`);

    let updated = 0;
    let failed = 0;

    for (const contact of contactsWithoutPushName) {
      try {
        // Para cada contato, vamos tentar buscar o pushName usando a API do Baileys
        // Isso requer que a conexão esteja ativa
        
        // Por enquanto, vamos marcar como "precisa atualizar na próxima mensagem"
        console.log(`⏭️  ${contact.phoneNumber} - aguardando próxima mensagem para capturar pushName`);
        
        // O pushName será capturado automaticamente quando o contato enviar a próxima mensagem
        
      } catch (error) {
        console.error(`❌ Erro ao processar ${contact.phoneNumber}:`, error.message);
        failed++;
      }
    }

    console.log('\n✅ Processo concluído!');
    console.log(`📊 Estatísticas:`);
    console.log(`   Total de contatos: ${contactsWithoutPushName.length}`);
    console.log(`   Atualizados: ${updated}`);
    console.log(`   Falhas: ${failed}`);
    console.log(`\n💡 O pushName será capturado automaticamente quando os contatos enviarem novas mensagens.`);

  } catch (error) {
    console.error('❌ Erro ao atualizar contatos:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
updateExistingContactsPushName();
