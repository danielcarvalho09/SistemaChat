# Script para verificar usuários no banco de dados

Write-Host "Verificando usuarios no banco..." -ForegroundColor Cyan

# Executar query no PostgreSQL via Docker
docker exec whatsapp_postgres psql -U postgres -d whatsapp_system -c "SELECT id, email, name, is_active FROM users;"

Write-Host ""
Write-Host "Se nao houver usuarios, voce precisa:" -ForegroundColor Yellow
Write-Host "1. Registrar um novo usuario em /register" -ForegroundColor White
Write-Host "2. Ou usar o script promote-admin.ps1 para criar um admin" -ForegroundColor White
