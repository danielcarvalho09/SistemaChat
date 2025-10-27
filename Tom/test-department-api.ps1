# Script para testar API de departamentos

Write-Host "Testando API de departamentos..." -ForegroundColor Cyan
Write-Host ""

# Pegar ID do departamento Recepção
$deptId = "c0958c67-3cb0-425b-aa1a-80d339895cce"

Write-Host "1. Testando GET /api/v1/departments/$deptId/users" -ForegroundColor Yellow
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/departments/$deptId/users" -Method Get
    
    Write-Host "Sucesso!" -ForegroundColor Green
    Write-Host "Usuarios encontrados: $($response.data.Count)" -ForegroundColor Cyan
    Write-Host ""
    
    foreach ($user in $response.data) {
        Write-Host "  - $($user.name) ($($user.email))" -ForegroundColor White
        Write-Host "    Roles: $($user.roles.name -join ', ')" -ForegroundColor Gray
    }
} catch {
    Write-Host "Erro: $_" -ForegroundColor Red
    Write-Host $_.Exception.Response.StatusCode -ForegroundColor Red
}
