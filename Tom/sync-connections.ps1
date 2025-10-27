# Script para sincronizar sessões do Baileys com o banco de dados

Write-Host "Sincronizando conexões..." -ForegroundColor Cyan
Write-Host ""

# 1. Verificar conexões no banco
Write-Host "1. Conexões no banco de dados:" -ForegroundColor Yellow
docker exec whatsapp_postgres psql -U postgres -d whatsapp_system -c "SELECT id, name, phone_number FROM whatsapp_connections;"

Write-Host ""
Write-Host "2. Sessões no disco:" -ForegroundColor Yellow
$sessionsPath = ".\backend\whatsapp-sessions"
if (Test-Path $sessionsPath) {
    Get-ChildItem -Path $sessionsPath -Directory | ForEach-Object {
        Write-Host "  - $($_.Name)" -ForegroundColor White
    }
} else {
    Write-Host "  Nenhuma sessão encontrada" -ForegroundColor Gray
}

Write-Host ""
Write-Host "3. Opções:" -ForegroundColor Yellow
Write-Host "  [1] Limpar TODAS as sessões do disco (recomendado)" -ForegroundColor White
Write-Host "  [2] Limpar apenas sessão específica" -ForegroundColor White
Write-Host "  [3] Cancelar" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Escolha uma opção"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "Limpando todas as sessões..." -ForegroundColor Cyan
        if (Test-Path $sessionsPath) {
            Remove-Item -Path $sessionsPath -Recurse -Force
            Write-Host "Sessões removidas!" -ForegroundColor Green
        }
        
        # Resetar status no banco
        Write-Host "Resetando status no banco..." -ForegroundColor Cyan
        docker exec whatsapp_postgres psql -U postgres -d whatsapp_system -c "UPDATE whatsapp_connections SET status = 'disconnected', qr_code = NULL;"
        Write-Host "Status resetado!" -ForegroundColor Green
        
        Write-Host ""
        Write-Host "Pronto! Reinicie o backend e reconecte as conexões." -ForegroundColor Green
    }
    "2" {
        Write-Host ""
        $sessionId = Read-Host "Digite o ID da sessão para remover"
        $sessionPath = Join-Path $sessionsPath $sessionId
        
        if (Test-Path $sessionPath) {
            Remove-Item -Path $sessionPath -Recurse -Force
            Write-Host "Sessão $sessionId removida!" -ForegroundColor Green
        } else {
            Write-Host "Sessão não encontrada!" -ForegroundColor Red
        }
    }
    "3" {
        Write-Host "Cancelado." -ForegroundColor Yellow
    }
    default {
        Write-Host "Opção inválida!" -ForegroundColor Red
    }
}
