const io = require('socket.io-client');

console.log('🧪 TESTE DE WEBSOCKET - Sistema de Chat\n');
console.log('======================================\n');

// Conectar ao WebSocket
const socket = io('http://localhost:3000', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 30000,
});

let pingCount = 0;
let pongCount = 0;
let serverPingCount = 0;

// Conexão
socket.on('connect', () => {
  console.log('✅ [CONEXÃO] WebSocket conectado');
  console.log(`   Socket ID: ${socket.id}`);
  console.log(`   Transporte: ${socket.io.engine.transport.name}\n`);
});

// Desconexão
socket.on('disconnect', (reason) => {
  console.log(`❌ [DESCONEXÃO] ${reason}\n`);
});

// Reconexão
socket.on('reconnect', (attemptNumber) => {
  console.log(`🔄 [RECONEXÃO] Reconectado após ${attemptNumber} tentativas\n`);
});

// Tentativa de reconexão
socket.on('reconnect_attempt', (attemptNumber) => {
  console.log(`🔄 [TENTATIVA] Reconectando... (tentativa #${attemptNumber})`);
});

// Erro de conexão
socket.on('connect_error', (error) => {
  console.log(`❌ [ERRO] ${error.message}\n`);
});

// Pong (resposta do servidor ao nosso ping)
socket.on('pong', () => {
  pongCount++;
  console.log(`🏓 [PONG] Recebido do servidor (total: ${pongCount})`);
});

// Server ping (novo - servidor iniciando ping)
socket.on('server_ping', () => {
  serverPingCount++;
  console.log(`🏓 [SERVER_PING] Servidor enviou ping (total: ${serverPingCount})`);
  // Responder automaticamente
  socket.emit('client_pong');
  console.log(`   ↳ Respondido com client_pong`);
});

// Testar ping a cada 10 segundos
setInterval(() => {
  if (socket.connected) {
    pingCount++;
    console.log(`\n🏓 [PING] Enviando ping #${pingCount} ao servidor...`);
    socket.emit('ping');
  }
}, 10000);

// Status a cada 30 segundos
setInterval(() => {
  console.log('\n📊 [STATUS]');
  console.log(`   Conectado: ${socket.connected}`);
  console.log(`   Pings enviados: ${pingCount}`);
  console.log(`   Pongs recebidos: ${pongCount}`);
  console.log(`   Server pings recebidos: ${serverPingCount}`);
  console.log(`   Transporte: ${socket.io.engine.transport.name}`);
}, 30000);

// Enviar ping inicial após 2 segundos
setTimeout(() => {
  if (socket.connected) {
    console.log('🏓 [PING] Enviando ping inicial...');
    socket.emit('ping');
    pingCount++;
  }
}, 2000);

console.log('⏳ Aguardando eventos...\n');
console.log('💡 Deixe rodando para testar:');
console.log('   - Heartbeat bidirecional');
console.log('   - Reconexão automática');
console.log('   - Server-side ping\n');
console.log('⌨️  Pressione Ctrl+C para sair\n');
