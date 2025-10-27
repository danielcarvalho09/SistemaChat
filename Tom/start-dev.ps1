# Script para iniciar Backend e Frontend simultaneamente

Write-Host "Iniciando Backend e Frontend..." -ForegroundColor Cyan

# Caminho do projeto
$projectPath = "c:\Users\Dani\Desktop\projeto empresa\Projetos\Tom"

# Inicia o Backend em uma nova janela
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectPath\backend'; Write-Host 'Backend iniciando...' -ForegroundColor Green; npm run dev"

# Aguarda 3 segundos
Start-Sleep -Seconds 3

# Inicia o Frontend em uma nova janela
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectPath\frontend'; Write-Host 'Frontend iniciando...' -ForegroundColor Blue; npm run dev"

Write-Host "Backend e Frontend iniciados em janelas separadas!" -ForegroundColor Green
Write-Host "Backend: http://localhost:3000" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Yellow
