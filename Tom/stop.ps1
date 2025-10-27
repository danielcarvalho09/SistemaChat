# ========================================
# Script para Parar a Aplicação
# Windows PowerShell
# ========================================

Write-Host "🛑 Parando WhatsApp System..." -ForegroundColor Yellow
Write-Host ""

# Parar containers Docker
Write-Host "🐳 Parando containers Docker..." -ForegroundColor Cyan
docker-compose down

Write-Host ""
Write-Host "✅ Aplicação parada com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Para iniciar novamente: .\start.ps1" -ForegroundColor Cyan
