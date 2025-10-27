# ========================================
# Script para Iniciar a Aplicação
# Windows PowerShell
# ========================================

Write-Host "🚀 Iniciando WhatsApp System..." -ForegroundColor Green
Write-Host ""

# Verificar se está na pasta correta
if (-not (Test-Path ".\backend") -or -not (Test-Path ".\frontend")) {
    Write-Host "❌ Erro: Execute este script na pasta raiz do projeto (Tom)" -ForegroundColor Red
    exit 1
}

# Verificar se Docker está rodando
Write-Host "🐳 Verificando Docker..." -ForegroundColor Cyan
try {
    docker ps | Out-Null
    Write-Host "✅ Docker está rodando" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker não está rodando. Inicie o Docker Desktop." -ForegroundColor Red
    exit 1
}

# Verificar se containers estão rodando
Write-Host "📦 Verificando containers..." -ForegroundColor Cyan
$postgresRunning = docker ps --filter "name=whatsapp_postgres" --format "{{.Names}}"
$redisRunning = docker ps --filter "name=whatsapp_redis" --format "{{.Names}}"

if (-not $postgresRunning) {
    Write-Host "⚠️  PostgreSQL não está rodando. Iniciando..." -ForegroundColor Yellow
    docker-compose up -d postgres
    Start-Sleep -Seconds 5
}

if (-not $redisRunning) {
    Write-Host "⚠️  Redis não está rodando. Iniciando..." -ForegroundColor Yellow
    docker-compose up -d redis
    Start-Sleep -Seconds 5
}

Write-Host "✅ Containers prontos" -ForegroundColor Green
Write-Host ""

# Criar jobs para rodar backend e frontend em paralelo
Write-Host "🚀 Iniciando Backend e Frontend..." -ForegroundColor Cyan
Write-Host ""

# Iniciar Backend em background
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD\backend
    npm run dev
}

# Aguardar 3 segundos para backend iniciar
Start-Sleep -Seconds 3

# Iniciar Frontend em background
$frontendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD\frontend
    npm run dev
}

Write-Host "════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "✅ APLICAÇÃO INICIADA!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Acessos:" -ForegroundColor Cyan
Write-Host "  • Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "  • Backend API: http://localhost:3000" -ForegroundColor White
Write-Host "  • Health Check: http://localhost:3000/health" -ForegroundColor White
Write-Host ""
Write-Host "📊 Status dos serviços:" -ForegroundColor Cyan
Write-Host "  • Backend Job ID: $($backendJob.Id)" -ForegroundColor White
Write-Host "  • Frontend Job ID: $($frontendJob.Id)" -ForegroundColor White
Write-Host ""
Write-Host "📝 Comandos úteis:" -ForegroundColor Cyan
Write-Host "  • Ver logs do backend: Receive-Job $($backendJob.Id) -Keep" -ForegroundColor White
Write-Host "  • Ver logs do frontend: Receive-Job $($frontendJob.Id) -Keep" -ForegroundColor White
Write-Host "  • Parar tudo: .\stop.ps1" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  Pressione Ctrl+C para parar os serviços" -ForegroundColor Yellow
Write-Host ""

# Manter script rodando e mostrar logs
try {
    while ($true) {
        Start-Sleep -Seconds 2
        
        # Verificar se jobs ainda estão rodando
        if ($backendJob.State -ne "Running") {
            Write-Host "❌ Backend parou de funcionar" -ForegroundColor Red
            break
        }
        if ($frontendJob.State -ne "Running") {
            Write-Host "❌ Frontend parou de funcionar" -ForegroundColor Red
            break
        }
    }
} finally {
    Write-Host ""
    Write-Host "🛑 Parando serviços..." -ForegroundColor Yellow
    Stop-Job -Job $backendJob, $frontendJob
    Remove-Job -Job $backendJob, $frontendJob
    Write-Host "✅ Serviços parados" -ForegroundColor Green
}
