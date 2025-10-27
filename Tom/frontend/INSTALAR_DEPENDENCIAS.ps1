# Script para instalar dependências necessárias

Write-Host "📦 Instalando dependências do Radix UI e Sonner..." -ForegroundColor Cyan

npm install @radix-ui/react-dialog @radix-ui/react-label @radix-ui/react-checkbox @radix-ui/react-dropdown-menu sonner

Write-Host "✅ Dependências instaladas com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "Agora você pode rodar: npm run dev" -ForegroundColor Yellow
