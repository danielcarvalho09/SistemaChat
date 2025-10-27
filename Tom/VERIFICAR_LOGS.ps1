# Script para verificar logs do backend em tempo real

Write-Host "🔍 Monitorando logs do backend..." -ForegroundColor Cyan
Write-Host "Envie uma mensagem agora e observe os logs abaixo:" -ForegroundColor Yellow
Write-Host ""

# Ir para pasta do backend
cd backend

# Mostrar logs em tempo real
npm run dev
