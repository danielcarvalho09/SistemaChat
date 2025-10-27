#!/usr/bin/env node

/**
 * Script para diagnosticar problemas de conexão WebSocket no Railway
 * Execute este script para verificar a configuração
 */

console.log('🔍 DIAGNÓSTICO DE CONEXÃO WEBSOCKET');
console.log('=====================================\n');

// 1. Verificar variáveis de ambiente
console.log('📋 VARIÁVEIS DE AMBIENTE:');
console.log(`VITE_API_URL: ${process.env.VITE_API_URL || 'NÃO DEFINIDA'}`);
console.log(`VITE_WS_URL: ${process.env.VITE_WS_URL || 'NÃO DEFINIDA'}`);
console.log(`BACKEND_URL: ${process.env.BACKEND_URL || 'NÃO DEFINIDA'}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'NÃO DEFINIDA'}`);
console.log(`PORT: ${process.env.PORT || 'NÃO DEFINIDA'}\n`);

// 2. Verificar URLs padrão
const defaultApiUrl = 'http://localhost:3000';
const defaultWsUrl = 'ws://localhost:3000';

console.log('🌐 URLs PADRÃO:');
console.log(`API: ${defaultApiUrl}`);
console.log(`WebSocket: ${defaultWsUrl}\n`);

// 3. Verificar se está em produção
const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT === 'production';
console.log(`🏭 AMBIENTE: ${isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}\n`);

// 4. Verificar configuração do Railway
console.log('🚂 CONFIGURAÇÃO RAILWAY:');
console.log(`RAILWAY_ENVIRONMENT: ${process.env.RAILWAY_ENVIRONMENT || 'NÃO DEFINIDA'}`);
console.log(`RAILWAY_PROJECT_ID: ${process.env.RAILWAY_PROJECT_ID || 'NÃO DEFINIDA'}`);
console.log(`RAILWAY_SERVICE_ID: ${process.env.RAILWAY_SERVICE_ID || 'NÃO DEFINIDA'}\n`);

// 5. Recomendações
console.log('💡 RECOMENDAÇÕES:');
if (!process.env.VITE_API_URL) {
  console.log('❌ VITE_API_URL não definida - configure no Railway Dashboard');
}
if (!process.env.VITE_WS_URL) {
  console.log('❌ VITE_WS_URL não definida - configure no Railway Dashboard');
}
if (!isProduction) {
  console.log('⚠️  Executando em ambiente de desenvolvimento');
}

console.log('\n🔧 PRÓXIMOS PASSOS:');
console.log('1. Verifique as variáveis de ambiente no Railway Dashboard');
console.log('2. Configure VITE_API_URL com a URL do seu backend');
console.log('3. Configure VITE_WS_URL com a URL WebSocket do backend');
console.log('4. Reinicie o serviço frontend no Railway');
console.log('5. Verifique os logs do Railway para erros de conexão');
