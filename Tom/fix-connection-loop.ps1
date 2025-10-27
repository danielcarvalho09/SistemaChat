# Script para limpar sessões corrompidas e resetar conexões

Write-Host "Limpando sessões do WhatsApp..." -ForegroundColor Cyan
Write-Host ""

# 1. Parar backend
Write-Host "1. Pare o backend (Ctrl+C no terminal)" -ForegroundColor Yellow
Read-Host "Pressione Enter quando o backend estiver parado"

# 2. Limpar sessões
Write-Host ""
Write-Host "2. Limpando diretório de sessões..." -ForegroundColor Cyan
$sessionsPath = ".\backend\whatsapp-sessions"

if (Test-Path $sessionsPath) {
    Remove-Item -Path $sessionsPath -Recurse -Force
    Write-Host "   Sessões removidas!" -ForegroundColor Green
} else {
    Write-Host "   Diretório de sessões não encontrado" -ForegroundColor Yellow
}

# 3. Limpar status no banco
Write-Host ""
Write-Host "3. Resetando status das conexões no banco..." -ForegroundColor Cyan
$sql = "UPDATE whatsapp_connections SET status = 'disconnected', qr_code = NULL, last_connected = NULL;"
docker exec -i whatsapp_postgres psql -U postgres -d whatsapp_system -c $sql
Write-Host "   Status resetado!" -ForegroundColor Green

# 4. Instruções finais
Write-Host ""
Write-Host "4. Agora:" -ForegroundColor Yellow
Write-Host "   - Inicie o backend novamente" -ForegroundColor White
Write-Host "   - Vá em Conexões no frontend" -ForegroundColor White
Write-Host "   - Clique em 'Conectar' na conexão" -ForegroundColor White
Write-Host "   - Escaneie o QR Code" -ForegroundColor White
Write-Host ""
Write-Host "Pronto!" -ForegroundColor Green
