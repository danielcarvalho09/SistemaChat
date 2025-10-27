# Script para limpar todas as mensagens e conversas
# Execute este script para começar do zero

Write-Host "🧹 Limpando mensagens e conversas..." -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  ATENÇÃO: Isso vai deletar TODAS as mensagens e conversas!" -ForegroundColor Red
Write-Host ""

$confirmation = Read-Host "Tem certeza? Digite 'SIM' para confirmar"

if ($confirmation -ne "SIM") {
    Write-Host "❌ Operação cancelada." -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "🔄 Executando limpeza..." -ForegroundColor Cyan

# Executar o script SQL
$env:PGPASSWORD = "postgres"
psql -U postgres -d whatsapp_system -f "backend/scripts/clear-messages.sql"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Limpeza concluída com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Estatísticas:" -ForegroundColor Cyan
    Write-Host "  - Mensagens: 0" -ForegroundColor White
    Write-Host "  - Conversas: 0" -ForegroundColor White
    Write-Host "  - Transferências: 0" -ForegroundColor White
    Write-Host ""
    Write-Host "🚀 Você pode começar a testar do zero agora!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ Erro ao executar limpeza." -ForegroundColor Red
    Write-Host "Verifique se o PostgreSQL está rodando e as credenciais estão corretas." -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Pressione ENTER para sair"
