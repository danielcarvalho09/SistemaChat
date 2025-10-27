#!/usr/bin/env node

/**
 * Script para testar conectividade WebSocket no Railway
 * Execute: node test-websocket.js
 */

import { io } from 'socket.io-client';

const BACKEND_URL = process.env.BACKEND_URL || process.env.VITE_API_URL || 'http://localhost:3000';
const WS_URL = process.env.VITE_WS_URL || BACKEND_URL;

console.log('🧪 TESTE DE CONECTIVIDADE WEBSOCKET');
console.log('=====================================\n');

console.log('📋 CONFIGURAÇÃO:');
console.log(`Backend URL: ${BACKEND_URL}`);
console.log(`WebSocket URL: ${WS_URL}\n`);

// Simular token de teste
const testToken = 'test-token-123';

console.log('🔌 Tentando conectar ao WebSocket...');

const socket = io(WS_URL, {
  auth: {
    token: testToken,
  },
  transports: ['websocket', 'polling'],
  timeout: 10000,
  autoConnect: true,
});

let connected = false;
let errorOccurred = false;

socket.on('connect', () => {
  console.log('✅ WebSocket conectado com sucesso!');
  console.log(`🆔 Socket ID: ${socket.id}`);
  connected = true;
  
  // Testar ping
  socket.emit('ping', (response) => {
    console.log('🏓 Ping response:', response);
  });
  
  // Desconectar após teste
  setTimeout(() => {
    console.log('🔌 Desconectando...');
    socket.disconnect();
    process.exit(0);
  }, 2000);
});

socket.on('connect_error', (error) => {
  console.error('❌ Erro de conexão:', error.message);
  console.error('📊 Detalhes:', error);
  errorOccurred = true;
  
  setTimeout(() => {
    console.log('🔌 Tentando desconectar...');
    socket.disconnect();
    process.exit(1);
  }, 1000);
});

socket.on('disconnect', (reason) => {
  console.log(`⚠️ Desconectado: ${reason}`);
});

socket.on('error', (error) => {
  console.error('❌ Erro do socket:', error);
});

// Timeout de segurança
setTimeout(() => {
  if (!connected && !errorOccurred) {
    console.error('⏰ Timeout: Não foi possível conectar em 15 segundos');
    socket.disconnect();
    process.exit(1);
  }
}, 15000);

console.log('⏳ Aguardando conexão... (máximo 15s)');
