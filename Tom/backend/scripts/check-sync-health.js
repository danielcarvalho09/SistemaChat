#!/usr/bin/env node

/**
 * Script de Verificação de Saúde da Sincronização
 * 
 * Verifica:
 * - Conexões ativas
 * - Mensagens duplicadas
 * - Conversas perdidas
 * - Estatísticas de sincronização
 * 
 * Uso: node scripts/check-sync-health.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSyncHealth() {
  console.log('🔍 Verificando Saúde da Sincronização...\n');

  try {
    // 1. Verificar Conexões Ativas
    console.log('📡 CONEXÕES WHATSAPP:');
    console.log('─'.repeat(50));
    
    const connections = await prisma.whatsAppConnection.findMany({
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        status: true,
        lastConnected: true,
        authData: true,
      },
    });

    connections.forEach((conn) => {
      const hasAuth = conn.authData ? '✅' : '❌';
      const statusIcon = conn.status === 'connected' ? '🟢' : conn.status === 'disconnected' ? '🔴' : '🟡';
      const lastConn = conn.lastConnected 
        ? new Date(conn.lastConnected).toLocaleString('pt-BR')
        : 'Nunca';
      
      console.log(`${statusIcon} ${conn.name} (${conn.phoneNumber})`);
      console.log(`   Status: ${conn.status} | Auth: ${hasAuth} | Última: ${lastConn}`);
    });

    console.log('');

    // 2. Verificar Mensagens Duplicadas
    console.log('🔍 VERIFICAÇÃO DE DUPLICATAS:');
    console.log('─'.repeat(50));

    const duplicates = await prisma.$queryRaw`
      SELECT "externalId", "connectionId", COUNT(*) as count
      FROM messages
      WHERE "externalId" IS NOT NULL
      GROUP BY "externalId", "connectionId"
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 10
    `;

    if (duplicates.length === 0) {
      console.log('✅ Nenhuma mensagem duplicada encontrada!');
    } else {
      console.log(`⚠️  Encontradas ${duplicates.length} mensagens duplicadas:`);
      duplicates.forEach((dup) => {
        console.log(`   ExternalId: ${dup.externalId} | Count: ${dup.count}`);
      });
    }

    console.log('');

    // 3. Estatísticas de Mensagens
    console.log('📊 ESTATÍSTICAS DE MENSAGENS:');
    console.log('─'.repeat(50));

    const messageStats = await prisma.message.groupBy({
      by: ['connectionId'],
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
    });

    for (const stat of messageStats) {
      const conn = connections.find((c) => c.id === stat.connectionId);
      const connName = conn ? conn.name : 'Desconhecida';
      console.log(`📱 ${connName}: ${stat._count.id} mensagens`);
    }

    console.log('');

    // 4. Conversas por Status
    console.log('💬 CONVERSAS POR STATUS:');
    console.log('─'.repeat(50));

    const conversationStats = await prisma.conversation.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
    });

    conversationStats.forEach((stat) => {
      const statusIcon = {
        waiting: '⏳',
        in_progress: '🔄',
        closed: '✅',
        transferred: '↪️',
      }[stat.status] || '❓';
      
      console.log(`${statusIcon} ${stat.status}: ${stat._count.id} conversas`);
    });

    console.log('');

    // 5. Mensagens sem ExternalId
    console.log('⚠️  MENSAGENS SEM EXTERNAL ID:');
    console.log('─'.repeat(50));

    const messagesWithoutExternalId = await prisma.message.count({
      where: {
        externalId: null,
      },
    });

    if (messagesWithoutExternalId === 0) {
      console.log('✅ Todas as mensagens têm ExternalId!');
    } else {
      console.log(`⚠️  ${messagesWithoutExternalId} mensagens sem ExternalId`);
      console.log('   Recomendação: Atualizar para usar fallback de ExternalId');
    }

    console.log('');

    // 6. Conversas Fechadas Recentemente (últimas 24h)
    console.log('🔒 CONVERSAS FECHADAS (ÚLTIMAS 24H):');
    console.log('─'.repeat(50));

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const recentlyClosed = await prisma.conversation.count({
      where: {
        status: 'closed',
        lastMessageAt: {
          gte: yesterday,
        },
      },
    });

    console.log(`📊 ${recentlyClosed} conversas fechadas nas últimas 24h`);
    console.log('   (Podem ser reabertas automaticamente se cliente enviar mensagem)');

    console.log('');

    // 7. Resumo Final
    console.log('📋 RESUMO:');
    console.log('─'.repeat(50));
    
    const totalMessages = await prisma.message.count();
    const totalConversations = await prisma.conversation.count();
    const totalContacts = await prisma.contact.count();
    const activeConnections = connections.filter((c) => c.status === 'connected').length;

    console.log(`✅ Conexões Ativas: ${activeConnections}/${connections.length}`);
    console.log(`📨 Total de Mensagens: ${totalMessages}`);
    console.log(`💬 Total de Conversas: ${totalConversations}`);
    console.log(`👥 Total de Contatos: ${totalContacts}`);
    console.log(`🔒 Duplicatas: ${duplicates.length}`);
    console.log(`⚠️  Sem ExternalId: ${messagesWithoutExternalId}`);

    console.log('');
    console.log('✅ Verificação concluída!');
    console.log('');

  } catch (error) {
    console.error('❌ Erro ao verificar saúde:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar verificação
checkSyncHealth();
