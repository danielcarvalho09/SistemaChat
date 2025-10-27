# Script para reiniciar backend LIMPO (sem cache)

Write-Host ""
Write-Host "REINICIANDO BACKEND LIMPO" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan
Write-Host ""

# 1. Matar todos os processos Node
Write-Host "1. Matando processos Node..." -ForegroundColor Yellow
taskkill /F /IM node.exe 2>$null
Start-Sleep -Seconds 1

# 2. Limpar cache do tsx
Write-Host "2. Limpando cache do tsx..." -ForegroundColor Yellow
if (Test-Path "$env:TEMP\.tsx") {
    Remove-Item -Path "$env:TEMP\.tsx" -Recurse -Force -ErrorAction SilentlyContinue
}
if (Test-Path ".tsx") {
    Remove-Item -Path ".tsx" -Recurse -Force -ErrorAction SilentlyContinue
}

# 3. Limpar node_modules/.cache
Write-Host "3. Limpando cache do node_modules..." -ForegroundColor Yellow
if (Test-Path "node_modules\.cache") {
    Remove-Item -Path "node_modules\.cache" -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "CACHE LIMPO!" -ForegroundColor Green
Write-Host ""
Write-Host "Iniciando backend..." -ForegroundColor Cyan
Write-Host ""

# 4. Iniciar backend
npm run dev
