# Script para corrigir migracoes problematicas do Prisma

Write-Host "Corrigindo migracoes do Prisma..." -ForegroundColor Cyan

# 1. Remover migracao problematica
$migrationPath = "prisma\migrations\20251022222431_sistema_robusto_sincronizacao"
if (Test-Path $migrationPath) {
    Write-Host "Removendo migracao problematica..." -ForegroundColor Yellow
    Remove-Item -Path $migrationPath -Recurse -Force
    Write-Host "Migracao removida" -ForegroundColor Green
}

# 2. Remover migracoes sem timestamp
$oldMigrations = @(
    "prisma\migrations\add_connection_departments",
    "prisma\migrations\add_external_id"
)

foreach ($migration in $oldMigrations) {
    if (Test-Path $migration) {
        Write-Host "Removendo migracao antiga: $migration" -ForegroundColor Yellow
        Remove-Item -Path $migration -Recurse -Force
        Write-Host "Removida" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Limpeza concluida!" -ForegroundColor Green
Write-Host ""
Write-Host "Agora execute:" -ForegroundColor Cyan
Write-Host "  npx prisma migrate deploy" -ForegroundColor White
Write-Host "  npx prisma migrate dev --name add_transferred_status" -ForegroundColor White
