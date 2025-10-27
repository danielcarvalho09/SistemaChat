# Script para matar processos do backend na porta 3000

Write-Host "Procurando processos na porta 3000..." -ForegroundColor Cyan

# Encontrar processo usando a porta 3000
$process = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -First 1

if ($process) {
    $pid = $process.OwningProcess
    Write-Host "Processo encontrado: PID $pid" -ForegroundColor Yellow
    
    # Matar processo
    Stop-Process -Id $pid -Force
    Write-Host "Processo $pid finalizado!" -ForegroundColor Green
} else {
    Write-Host "Nenhum processo encontrado na porta 3000" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Agora você pode iniciar o backend novamente!" -ForegroundColor Green
