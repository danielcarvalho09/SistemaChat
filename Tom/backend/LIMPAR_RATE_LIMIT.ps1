# Script para limpar rate limit do Redis

Write-Host ""
Write-Host "LIMPANDO RATE LIMIT" -ForegroundColor Cyan
Write-Host "===================" -ForegroundColor Cyan
Write-Host ""

# Conectar ao Redis e limpar todas as chaves de rate limit
Write-Host "Limpando chaves de rate limit do Redis..." -ForegroundColor Yellow

# Usar redis-cli para deletar chaves
$redisCommand = "redis-cli -p 6380 --scan --pattern 'ratelimit:*' | redis-cli -p 6380 -x del"

try {
    # Tentar limpar via redis-cli
    Invoke-Expression "redis-cli -p 6380 KEYS 'ratelimit:*' | ForEach-Object { redis-cli -p 6380 DEL `$_ }"
    Write-Host "Rate limit limpo!" -ForegroundColor Green
} catch {
    Write-Host "Erro ao limpar rate limit (Redis pode não estar instalado localmente)" -ForegroundColor Yellow
    Write-Host "Aguarde 1 minuto ou reinicie o Redis" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Você já pode fazer login novamente!" -ForegroundColor Green
Write-Host ""
