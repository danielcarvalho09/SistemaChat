// BACKUP: Código de detecção de perda de conexão que deve ser mantido após revert
// Este código está em baileys.manager.ts nas funções:
// - startConnectionMonitoring (linhas 3029-3160)
// - startActiveHeartbeat (linhas 3169-3261)
// - isConnectionActive (linhas 3391-3432)

// Função: startConnectionMonitoring
// Verifica conexão a cada 20 segundos
// Detecta desconexões verificando wsReadyState
// Força atualização de status quando detecta desconexão
// Tenta reconectar automaticamente após 5 segundos

// Função: startActiveHeartbeat  
// Heartbeat a cada 30 segundos (reduzido de 45s)
// Marca presença online periodicamente
// Sincroniza mensagens recentes
// Verifica se socket ainda está aberto

// Função: isConnectionActive
// Verifica status do cliente
// Verifica estado real do WebSocket (wsReadyState)
// Retorna true apenas se status é 'connected' E socket está aberto

