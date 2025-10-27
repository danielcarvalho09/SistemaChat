# Script para parar Backend e Frontend
# Uso: .\stop-all.ps1

Write-Host "🛑 Parando Sistema WhatsApp Multi-Tenant..." -ForegroundColor Red
Write-Host ""

# Função para matar processos nas portas
function Kill-Port {
    param($Port, $Name)
    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($connections) {
        $processes = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($process in $processes) {
            try {
                $processInfo = Get-Process -Id $process -ErrorAction SilentlyContinue
                if ($processInfo) {
                    Write-Host "🔪 Matando $Name (PID: $process)..." -ForegroundColor Yellow
                    Stop-Process -Id $process -Force
                }
            } catch {
                Write-Host "⚠️  Não foi possível matar processo $process" -ForegroundColor Yellow
            }
        }
        Write-Host "✅ $Name parado!" -ForegroundColor Green
    } else {
        Write-Host "ℹ️  $Name não estava rodando" -ForegroundColor Gray
    }
}

# Parar serviços
Kill-Port 3000 "Backend"
Kill-Port 5173 "Frontend"

Write-Host ""
Write-Host "✅ Todos os serviços foram parados!" -ForegroundColor Green
Write-Host ""
