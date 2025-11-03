#!/usr/bin/env tsx

/**
 * Migra dados existentes de authData para formato criptografado
 * 
 * ATENÇÃO: Execute este script APENAS UMA VEZ após configurar ENCRYPTION_KEY
 * 
 * Uso:
 * npx tsx scripts/migrate-encrypt-authdata.ts
 */

import { getPrismaClient } from '../src/config/database.js';
import { encrypt, isEncrypted, testEncryption } from '../src/utils/encryption.js';
import { logger } from '../src/config/logger.js';

async function migrateAuthData() {
  console.log('\n🔐 Iniciando migração de authData para formato criptografado...\n');

  try {
    // Testar sistema de criptografia
    console.log('🧪 Testando sistema de criptografia...');
    testEncryption();
    console.log('✅ Sistema de criptografia funcionando corretamente\n');

    const prisma = getPrismaClient();

    // Buscar todas as conexões com authData
    console.log('🔍 Buscando conexões com authData...');
    const connections = await prisma.whatsAppConnection.findMany({
      where: {
        authData: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        authData: true,
      },
    });

    if (connections.length === 0) {
      console.log('ℹ️  Nenhuma conexão com authData encontrada.');
      console.log('✅ Migração não necessária\n');
      return;
    }

    console.log(`📊 Encontradas ${connections.length} conexões com authData\n`);

    let migratedCount = 0;
    let alreadyEncryptedCount = 0;
    let errorCount = 0;

    // Processar cada conexão
    for (const connection of connections) {
      try {
        const authData = connection.authData as string;

        // Verificar se já está criptografado
        if (isEncrypted(authData)) {
          console.log(`⏭️  [${connection.phoneNumber || connection.name}] Já está criptografado, pulando...`);
          alreadyEncryptedCount++;
          continue;
        }

        // Criptografar
        console.log(`🔒 [${connection.phoneNumber || connection.name}] Criptografando...`);
        const encryptedAuthData = encrypt(authData);

        // Atualizar no banco
        await prisma.whatsAppConnection.update({
          where: { id: connection.id },
          data: { authData: encryptedAuthData },
        });

        console.log(`✅ [${connection.phoneNumber || connection.name}] Criptografado com sucesso`);
        migratedCount++;
      } catch (error) {
        console.error(`❌ [${connection.phoneNumber || connection.name}] Erro ao criptografar:`, error);
        errorCount++;
      }
    }

    // Resumo
    console.log('\n═════════════════════════════════════════════════════════════════════');
    console.log('📊 RESUMO DA MIGRAÇÃO');
    console.log('═════════════════════════════════════════════════════════════════════');
    console.log(`Total de conexões: ${connections.length}`);
    console.log(`✅ Migradas com sucesso: ${migratedCount}`);
    console.log(`⏭️  Já criptografadas: ${alreadyEncryptedCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log('═════════════════════════════════════════════════════════════════════\n');

    if (errorCount > 0) {
      console.log('⚠️  Algumas conexões falharam na migração.');
      console.log('   Revise os erros acima e execute novamente se necessário.\n');
      process.exit(1);
    } else if (migratedCount > 0) {
      console.log('✅ Migração concluída com sucesso!');
      console.log('   Todos os authData foram criptografados.\n');
    } else {
      console.log('ℹ️  Todas as conexões já estavam criptografadas.\n');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('\n❌ Erro fatal na migração:', error);
    console.error('\nVerifique:');
    console.error('  1. ENCRYPTION_KEY está configurada no .env');
    console.error('  2. DATABASE_URL está correta');
    console.error('  3. Você tem permissões de escrita no banco\n');
    process.exit(1);
  }
}

// Executar migração
migrateAuthData();

