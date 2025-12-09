#!/usr/bin/env tsx

/**
 * Gera uma chave de criptografia AES-256 segura
 * 
 * Uso:
 * npx tsx scripts/generate-encryption-key.ts
 */

import crypto from 'crypto';

console.log('\n🔐 Gerando chave de criptografia AES-256...\n');

const encryptionKey = crypto.randomBytes(32).toString('hex');

console.log('✅ Chave gerada com sucesso!');
console.log('\n═════════════════════════════════════════════════════════════════════');
console.log('📋 Adicione esta linha ao seu arquivo .env:');
console.log('═════════════════════════════════════════════════════════════════════\n');
console.log(`ENCRYPTION_KEY=${encryptionKey}`);
console.log('\n═════════════════════════════════════════════════════════════════════');
console.log('⚠️  IMPORTANTE:');
console.log('   • Guarde esta chave em local SEGURO (password manager)');
console.log('   • NUNCA commite esta chave no Git');
console.log('   • Se perder esta chave, NÃO será possível descriptografar dados');
console.log('   • Use a mesma chave em TODAS as instâncias do backend');
console.log('═════════════════════════════════════════════════════════════════════\n');

