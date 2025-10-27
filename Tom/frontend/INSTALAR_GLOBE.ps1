# Script para instalar a dependência do componente Globe
# Autor: Sistema CRM WEB
# Data: 2025

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Instalando Dependência Globe (cobe)  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se está no diretório correto
if (-not (Test-Path "package.json")) {
    Write-Host "ERRO: package.json não encontrado!" -ForegroundColor Red
    Write-Host "Execute este script na pasta frontend/" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Host "Instalando cobe..." -ForegroundColor Green
npm install cobe

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Instalação concluída com sucesso!   " -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "O componente Globe está pronto para uso!" -ForegroundColor Cyan
    Write-Host "Acesse /login ou /register para ver a animação" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  ERRO na instalação!                 " -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Tente executar manualmente:" -ForegroundColor Yellow
    Write-Host "npm install cobe" -ForegroundColor White
}

Write-Host ""
Read-Host "Pressione Enter para sair"
