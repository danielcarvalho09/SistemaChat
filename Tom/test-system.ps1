# Script para testar o sistema

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "🔍 TESTANDO SISTEMA WHATSAPP" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# 1. Testar Backend
Write-Host "1️⃣ Testando Backend (porta 3000)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   ✅ Backend: OK (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Backend: ERRO - $($_.Exception.Message)" -ForegroundColor Red
}

# 2. Testar Frontend
Write-Host "`n2️⃣ Testando Frontend (porta 5173)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5173" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   ✅ Frontend: OK (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Frontend: ERRO - $($_.Exception.Message)" -ForegroundColor Red
}

# 3. Testar PostgreSQL
Write-Host "`n3️⃣ Testando PostgreSQL (porta 5433)..." -ForegroundColor Yellow
$pgTest = Test-NetConnection -ComputerName localhost -Port 5433 -WarningAction SilentlyContinue
if ($pgTest.TcpTestSucceeded) {
    Write-Host "   ✅ PostgreSQL: OK (Porta aberta)" -ForegroundColor Green
} else {
    Write-Host "   ❌ PostgreSQL: ERRO (Porta fechada)" -ForegroundColor Red
}

# 4. Testar Redis
Write-Host "`n4️⃣ Testando Redis (porta 6380)..." -ForegroundColor Yellow
$redisTest = Test-NetConnection -ComputerName localhost -Port 6380 -WarningAction SilentlyContinue
if ($redisTest.TcpTestSucceeded) {
    Write-Host "   ✅ Redis: OK (Porta aberta)" -ForegroundColor Green
} else {
    Write-Host "   ❌ Redis: ERRO (Porta fechada)" -ForegroundColor Red
}

# 5. Listar processos
Write-Host "`n5️⃣ Processos rodando:" -ForegroundColor Yellow
$processes = netstat -ano | Select-String -Pattern ":3000|:5173|:5433|:6380"
if ($processes) {
    $processes | ForEach-Object {
        Write-Host "   $_" -ForegroundColor Gray
    }
} else {
    Write-Host "   ❌ Nenhum processo encontrado" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "✅ TESTE CONCLUÍDO" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "PROXIMOS PASSOS:" -ForegroundColor Yellow
Write-Host "   1. Abra: http://localhost:5173" -ForegroundColor White
Write-Host "   2. Faca login" -ForegroundColor White
Write-Host "   3. Tente enviar mensagem" -ForegroundColor White
Write-Host "   4. Pressione F12 para ver Console" -ForegroundColor White
Write-Host "   5. Me envie o erro" -ForegroundColor White
Write-Host ""
