# ========================================
# Script de Setup Automático - WhatsApp System
# Windows PowerShell
# ========================================

Write-Host ">>> Iniciando setup do WhatsApp System..." -ForegroundColor Green
Write-Host ""

# Verificar se está na pasta correta
$currentPath = Get-Location
if (-not (Test-Path ".\backend") -or -not (Test-Path ".\frontend")) {
    Write-Host "[ERRO] Execute este script na pasta raiz do projeto (Tom)" -ForegroundColor Red
    exit 1
}

# ========================================
# 1. VERIFICAR PRÉ-REQUISITOS
# ========================================
Write-Host "[1/7] Verificando pre-requisitos..." -ForegroundColor Cyan

# Node.js
try {
    $nodeVersion = node --version
    Write-Host "[OK] Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERRO] Node.js nao encontrado. Instale: https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# npm
try {
    $npmVersion = npm --version
    Write-Host "[OK] npm: v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERRO] npm nao encontrado" -ForegroundColor Red
    exit 1
}

# Docker
try {
    $dockerVersion = docker --version
    Write-Host "[OK] Docker: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERRO] Docker nao encontrado. Instale: https://www.docker.com/products/docker-desktop/" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ========================================
# 2. GERAR SECRETS JWT
# ========================================
Write-Host "[2/7] Gerando secrets JWT..." -ForegroundColor Cyan

function Generate-Secret {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    return [Convert]::ToBase64String($bytes)
}

$jwtSecret = Generate-Secret
$jwtRefreshSecret = Generate-Secret

Write-Host "[OK] Secrets gerados com sucesso" -ForegroundColor Green
Write-Host ""

# ========================================
# 3. CONFIGURAR BACKEND
# ========================================
Write-Host "[3/7] Configurando backend..." -ForegroundColor Cyan

Set-Location backend

# Criar .env
$envContent = @"
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/whatsapp_system"

# Redis
REDIS_URL="redis://localhost:6380"
REDIS_PASSWORD="redis_password"

# JWT
JWT_SECRET="$jwtSecret"
JWT_REFRESH_SECRET="$jwtRefreshSecret"
JWT_EXPIRES_IN="7d"
JWT_REFRESH_EXPIRES_IN="30d"

# Server
PORT=3000
NODE_ENV="development"
API_PREFIX="/api/v1"

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000
CORS_ORIGIN="http://localhost:5173"

# WhatsApp
WHATSAPP_SESSION_PATH="./whatsapp-sessions"
MAX_CONNECTIONS=100
WHATSAPP_TIMEOUT=60000

# Logging
LOG_LEVEL="info"
LOG_FILE_PATH="./logs"

# Queue
QUEUE_REDIS_HOST="localhost"
QUEUE_REDIS_PORT=6380
QUEUE_REDIS_PASSWORD="redis_password"

# Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH="./uploads"
ALLOWED_FILE_TYPES="image/jpeg,image/png,image/gif,video/mp4,application/pdf"
"@

$envContent | Out-File -FilePath ".env" -Encoding UTF8
Write-Host "✅ Arquivo .env criado" -ForegroundColor Green

# Instalar dependências
Write-Host "Instalando dependencias do backend (pode demorar)..." -ForegroundColor Yellow
npm install --silent

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERRO] Erro ao instalar dependencias do backend" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Dependencias do backend instaladas" -ForegroundColor Green

# Gerar Prisma Client
Write-Host "Gerando Prisma Client..." -ForegroundColor Yellow
npx prisma generate

Write-Host "[OK] Prisma Client gerado" -ForegroundColor Green

Set-Location ..
Write-Host ""

# ========================================
# 4. CONFIGURAR FRONTEND
# ========================================
Write-Host "[4/7] Configurando frontend..." -ForegroundColor Cyan

Set-Location frontend

# Criar .env
$frontendEnv = @"
VITE_API_URL=http://localhost:3000
VITE_WS_URL=http://localhost:3000
"@

$frontendEnv | Out-File -FilePath ".env" -Encoding UTF8
Write-Host "✅ Arquivo .env criado" -ForegroundColor Green

# Instalar dependências
Write-Host "Instalando dependencias do frontend (pode demorar)..." -ForegroundColor Yellow
npm install --silent

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERRO] Erro ao instalar dependencias do frontend" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Dependencias do frontend instaladas" -ForegroundColor Green

Set-Location ..
Write-Host ""

# ========================================
# 5. INICIAR DOCKER (POSTGRES + REDIS)
# ========================================
Write-Host "[5/7] Iniciando PostgreSQL e Redis..." -ForegroundColor Cyan

docker-compose up -d postgres redis

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERRO] Erro ao iniciar containers Docker" -ForegroundColor Red
    exit 1
}

Write-Host "Aguardando servicos iniciarem (15 segundos)..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

Write-Host "[OK] PostgreSQL e Redis iniciados" -ForegroundColor Green
Write-Host ""

# ========================================
# 6. EXECUTAR MIGRATIONS
# ========================================
Write-Host "[6/7] Executando migrations do banco de dados..." -ForegroundColor Cyan

Set-Location backend

npx prisma migrate dev --name init

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERRO] Erro ao executar migrations" -ForegroundColor Red
    Write-Host "Tente executar manualmente: cd backend && npx prisma migrate dev" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Migrations executadas com sucesso" -ForegroundColor Green

Set-Location ..
Write-Host ""

# ========================================
# 7. RESUMO
# ========================================
Write-Host "================================================" -ForegroundColor Green
Write-Host "[7/7] SETUP CONCLUIDO COM SUCESSO!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Servicos configurados:" -ForegroundColor Cyan
Write-Host "  - PostgreSQL: localhost:5433" -ForegroundColor White
Write-Host "  - Redis: localhost:6380" -ForegroundColor White
Write-Host "  - Backend API: localhost:3000 (pronto para iniciar)" -ForegroundColor White
Write-Host "  - Frontend: localhost:5173 (pronto para iniciar)" -ForegroundColor White
Write-Host ""
Write-Host "Para iniciar a aplicacao:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Terminal 1 (Backend):" -ForegroundColor Yellow
Write-Host "    cd backend" -ForegroundColor White
Write-Host "    npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "  Terminal 2 (Frontend):" -ForegroundColor Yellow
Write-Host "    cd frontend" -ForegroundColor White
Write-Host "    npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Acesse:" -ForegroundColor Cyan
Write-Host "  - Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "  - Backend API: http://localhost:3000/health" -ForegroundColor White
Write-Host "  - Prisma Studio: npx prisma studio (dentro da pasta backend)" -ForegroundColor White
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Cyan
Write-Host "  1. Acesse http://localhost:5173" -ForegroundColor White
Write-Host "  2. Clique em 'Cadastre-se'" -ForegroundColor White
Write-Host "  3. Crie sua conta" -ForegroundColor White
Write-Host "  4. Execute: .\promote-admin.ps1 (para se tornar admin)" -ForegroundColor White
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
