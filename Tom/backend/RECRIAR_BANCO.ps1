# Script para recriar banco de dados do zero

Write-Host ""
Write-Host "RECRIANDO BANCO DE DADOS" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""

# 1. Deletar migration problemática
Write-Host "1. Deletando migration problemática..." -ForegroundColor Yellow
$migrationPath = "prisma\migrations\20250123_add_tags_and_monitoring"
if (Test-Path $migrationPath) {
    Remove-Item -Path $migrationPath -Recurse -Force
    Write-Host "   Migration deletada!" -ForegroundColor Green
} else {
    Write-Host "   Migration já foi deletada" -ForegroundColor Gray
}

# 2. Dropar e recriar banco
Write-Host ""
Write-Host "2. Dropando e recriando banco..." -ForegroundColor Yellow
npx prisma migrate reset --force --skip-seed

# 3. Gerar Prisma Client
Write-Host ""
Write-Host "3. Gerando Prisma Client..." -ForegroundColor Yellow
npx prisma generate

Write-Host ""
Write-Host "BANCO RECRIADO COM SUCESSO!" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Cyan
Write-Host "1. npm run dev" -ForegroundColor White
Write-Host ""
