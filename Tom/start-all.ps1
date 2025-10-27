# Script para iniciar Backend e Frontend simultaneamente
# Uso: .\start-all.ps1

Write-Host "🚀 Iniciando Sistema WhatsApp Multi-Tenant..." -ForegroundColor Cyan
Write-Host ""

# Verificar se as pastas existem
if (-not (Test-Path "backend")) {
    Write-Host "❌ Pasta 'backend' não encontrada!" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "frontend")) {
    Write-Host "❌ Pasta 'frontend' não encontrada!" -ForegroundColor Red
    exit 1
}

# Verificar se node_modules existem
$backendModules = Test-Path "backend\node_modules"
$frontendModules = Test-Path "frontend\node_modules"

if (-not $backendModules) {
    Write-Host "⚠️  node_modules não encontrado no backend. Instalando..." -ForegroundColor Yellow
    Set-Location backend
    npm install
    Set-Location ..
}

if (-not $frontendModules) {
    Write-Host "⚠️  node_modules não encontrado no frontend. Instalando..." -ForegroundColor Yellow
    Set-Location frontend
    npm install
    Set-Location ..
}

Write-Host "✅ Dependências verificadas!" -ForegroundColor Green
Write-Host ""

# Função para matar processos nas portas
function Kill-Port {
    param($Port)
    $process = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    if ($process) {
        Write-Host "🔪 Matando processo na porta $Port..." -ForegroundColor Yellow
        Stop-Process -Id $process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }
}

# Limpar portas
Write-Host "🧹 Limpando portas..." -ForegroundColor Yellow
Kill-Port 3000  # Backend
Kill-Port 5173  # Frontend

Write-Host ""
Write-Host "📦 Iniciando serviços..." -ForegroundColor Cyan
Write-Host ""

# Iniciar Backend em nova janela
Write-Host "🔧 Backend: http://localhost:3000" -ForegroundColor Green
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; Write-Host '🔧 Backend iniciando...' -ForegroundColor Green; npm run dev"

# Aguardar 3 segundos para o backend subir
Start-Sleep -Seconds 3

# Iniciar Frontend em nova janela
Write-Host "🎨 Frontend: http://localhost:5173" -ForegroundColor Green
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$PWD\frontend'; Write-Host '🎨 Frontend iniciando...' -ForegroundColor Green; npm run dev"

Write-Host ""
Write-Host "✅ Serviços iniciados com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "📌 URLs:" -ForegroundColor Cyan
Write-Host "   Frontend:  http://localhost:5173" -ForegroundColor White
Write-Host "   Backend:   http://localhost:3000" -ForegroundColor White
Write-Host "   API Docs:  http://localhost:3000/docs" -ForegroundColor White
Write-Host ""
Write-Host "💡 Para parar os serviços, feche as janelas do terminal ou execute:" -ForegroundColor Yellow
Write-Host "   .\stop-all.ps1" -ForegroundColor White
Write-Host ""
