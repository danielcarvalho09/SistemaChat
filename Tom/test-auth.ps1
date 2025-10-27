# Script para testar autenticação

Write-Host "Testando autenticacao..." -ForegroundColor Cyan
Write-Host ""

# Pegar token do localStorage (você precisa copiar manualmente)
Write-Host "1. Abra o console do navegador (F12)" -ForegroundColor Yellow
Write-Host "2. Execute: localStorage.getItem('accessToken')" -ForegroundColor Yellow
Write-Host "3. Copie o token e cole aqui" -ForegroundColor Yellow
Write-Host ""

$token = Read-Host "Cole o token aqui"

if ($token) {
    Write-Host ""
    Write-Host "Testando endpoint /auth/me..." -ForegroundColor Cyan
    
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/me" -Method Get -Headers $headers
        
        Write-Host ""
        Write-Host "Usuario:" -ForegroundColor Green
        Write-Host "  Email: $($response.data.email)"
        Write-Host "  Nome: $($response.data.name)"
        Write-Host "  Roles: $($response.data.roles | ForEach-Object { $_.role.name })"
        
        if ($response.data.roles | Where-Object { $_.role.name -eq 'admin' }) {
            Write-Host ""
            Write-Host "Usuario e ADMIN!" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "Usuario NAO e admin!" -ForegroundColor Red
            Write-Host "Faca logout e login novamente!" -ForegroundColor Yellow
        }
    } catch {
        Write-Host ""
        Write-Host "Erro ao testar: $_" -ForegroundColor Red
        Write-Host "Token pode estar expirado. Faca logout e login novamente." -ForegroundColor Yellow
    }
} else {
    Write-Host "Token nao fornecido." -ForegroundColor Red
}
