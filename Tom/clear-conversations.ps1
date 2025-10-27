# Script para limpar todas as conversas do banco de dados
# Uso: .\clear-conversations.ps1

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🧹 LIMPEZA DE CONVERSAS - WHATSAPP SYSTEM" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Verificar se a pasta backend existe
if (-not (Test-Path "backend")) {
    Write-Host "❌ Pasta 'backend' não encontrada!" -ForegroundColor Red
    Write-Host "   Execute este script na raiz do projeto." -ForegroundColor Yellow
    exit 1
}

# Verificar se o script existe
if (-not (Test-Path "backend\scripts\clear-all-conversations.ts")) {
    Write-Host "❌ Script clear-all-conversations.ts não encontrado!" -ForegroundColor Red
    exit 1
}

Write-Host "⚠️  ATENÇÃO: Esta ação irá deletar:" -ForegroundColor Yellow
Write-Host "   - Todas as conversas" -ForegroundColor White
Write-Host "   - Todas as mensagens" -ForegroundColor White
Write-Host "   - Todos os contatos" -ForegroundColor White
Write-Host "   - Todas as transferências" -ForegroundColor White
Write-Host "   - Todos os anexos" -ForegroundColor White
Write-Host "   - Todas as tags de conversas" -ForegroundColor White
Write-Host "   - Todas as métricas" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  ESTA AÇÃO NÃO PODE SER DESFEITA!" -ForegroundColor Red
Write-Host ""

# Confirmar ação
$confirmation = Read-Host "Deseja continuar? Digite 'SIM' para confirmar"

if ($confirmation -ne "SIM") {
    Write-Host ""
    Write-Host "❌ Operação cancelada pelo usuário." -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

Write-Host ""
Write-Host "🚀 Executando limpeza..." -ForegroundColor Cyan
Write-Host ""

# Executar o script TypeScript
Set-Location backend
$result = npx tsx scripts/clear-all-conversations.ts

# Verificar se houve erro
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Limpeza concluída com sucesso!" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Erro ao executar limpeza!" -ForegroundColor Red
    Write-Host "   Verifique os logs acima para mais detalhes." -ForegroundColor Yellow
    Write-Host ""
    Set-Location ..
    exit 1
}

Set-Location ..

Write-Host "💡 Próximos passos:" -ForegroundColor Cyan
Write-Host "   1. Reinicie o backend: .\start-all.ps1" -ForegroundColor White
Write-Host "   2. As conversas serão criadas automaticamente ao receber mensagens" -ForegroundColor White
Write-Host ""
