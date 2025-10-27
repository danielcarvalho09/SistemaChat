# Script para limpar todas as mensagens e conversas

Write-Host ""
Write-Host "========================================" -ForegroundColor Red
Write-Host "ATENCAO: DELETAR TODAS AS MENSAGENS" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""
Write-Host "Isso vai deletar:" -ForegroundColor Yellow
Write-Host "  - Todas as mensagens" -ForegroundColor Yellow
Write-Host "  - Todas as conversas" -ForegroundColor Yellow
Write-Host "  - Todos os historicos de transferencia" -ForegroundColor Yellow
Write-Host ""

$confirmation = Read-Host "Digite 'SIM' para confirmar"

if ($confirmation -ne "SIM") {
    Write-Host ""
    Write-Host "Operacao cancelada." -ForegroundColor Green
    Write-Host ""
    exit
}

Write-Host ""
Write-Host "Deletando dados..." -ForegroundColor Yellow

# Executar comandos SQL
$sqlCommands = @"
SET session_replication_role = 'replica';
DELETE FROM conversation_transfers;
DELETE FROM messages;
DELETE FROM conversations;
SET session_replication_role = 'origin';
SELECT 
  (SELECT COUNT(*) FROM messages) as total_messages,
  (SELECT COUNT(*) FROM conversations) as total_conversations,
  (SELECT COUNT(*) FROM conversation_transfers) as total_transfers;
"@

# Executar via Docker
$sqlCommands | docker exec -i whatsapp_postgres psql -U postgres -d whatsapp_system

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "CONCLUIDO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
