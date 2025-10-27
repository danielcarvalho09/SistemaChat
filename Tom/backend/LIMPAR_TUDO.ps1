# Script para limpar TODAS as conexoes e sessoes WhatsApp

Write-Host ""
Write-Host "LIMPANDO TUDO - Conexoes e Sessoes WhatsApp" -ForegroundColor Red
Write-Host "================================================" -ForegroundColor Red
Write-Host ""

# 1. Apagar pasta de sessoes do Baileys
$sessionsPath = ".\whatsapp-sessions"
if (Test-Path $sessionsPath) {
    Write-Host "Apagando sessoes do Baileys..." -ForegroundColor Yellow
    Remove-Item -Path $sessionsPath -Recurse -Force
    Write-Host "Sessoes apagadas!" -ForegroundColor Green
} else {
    Write-Host "Pasta de sessoes nao existe" -ForegroundColor Gray
}

# 2. Limpar conexoes do banco de dados
Write-Host ""
Write-Host "Limpando banco de dados..." -ForegroundColor Yellow
Write-Host "Executando: npx prisma db execute --file=limpar-conexoes.sql" -ForegroundColor Cyan

try {
    npx prisma db execute --file=limpar-conexoes.sql --schema=./prisma/schema.prisma
    Write-Host "Banco de dados limpo!" -ForegroundColor Green
} catch {
    Write-Host "Erro ao limpar banco de dados" -ForegroundColor Red
    Write-Host "Execute manualmente: npx prisma studio" -ForegroundColor Yellow
    Write-Host "E delete as conexoes pela interface" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "LIMPEZA COMPLETA!" -ForegroundColor Green
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Cyan
Write-Host "1. Reinicie o backend (Ctrl+C e npm run dev)" -ForegroundColor White
Write-Host "2. Recarregue o frontend (F5)" -ForegroundColor White
Write-Host "3. Sistema pronto sem WhatsApp" -ForegroundColor White
Write-Host ""
