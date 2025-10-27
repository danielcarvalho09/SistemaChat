#!/bin/bash

# ==========================================
# Script de Migração Rápida
# Docker Local → Supabase + Redis Cloud
# ==========================================

set -e  # Parar em caso de erro

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Funções de log
log_title() {
    echo -e "\n${CYAN}========================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}========================================${NC}\n"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Verificar se está no diretório correto
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    log_error "Execute este script na pasta Tom/"
    exit 1
fi

log_title "🚀 MIGRAÇÃO PARA SUPABASE + REDIS CLOUD"

# ==========================================
# 1. Verificar dependências
# ==========================================

log_info "Verificando dependências..."

if ! command -v node &> /dev/null; then
    log_error "Node.js não está instalado"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    log_error "npm não está instalado"
    exit 1
fi

log_success "Node.js e npm encontrados"

# ==========================================
# 2. Parar Docker (se estiver rodando)
# ==========================================

log_info "Parando containers Docker..."

if command -v docker-compose &> /dev/null; then
    docker-compose down 2>/dev/null || true
    log_success "Docker parado"
else
    log_warning "docker-compose não encontrado (ignorando)"
fi

# ==========================================
# 3. Verificar arquivo .env
# ==========================================

log_info "Verificando configuração do .env..."

if [ ! -f "backend/.env" ]; then
    log_error "Arquivo backend/.env não encontrado"
    log_info "Copie o .env.example e configure suas credenciais:"
    log_info "  cp backend/.env.example backend/.env"
    exit 1
fi

# Verificar se DATABASE_URL contém supabase
if ! grep -q "supabase" backend/.env; then
    log_warning "DATABASE_URL não parece ser do Supabase"
    log_info "Edite backend/.env e configure:"
    log_info "  DATABASE_URL=\"postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres\""
    read -p "Deseja continuar mesmo assim? (s/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        exit 1
    fi
fi

log_success "Arquivo .env encontrado"

# ==========================================
# 4. Instalar dependências do backend
# ==========================================

log_info "Instalando dependências do backend..."

cd backend

if [ ! -d "node_modules" ]; then
    npm install
    log_success "Dependências instaladas"
else
    log_info "Dependências já instaladas (pulando)"
fi

# ==========================================
# 5. Gerar Prisma Client
# ==========================================

log_info "Gerando Prisma Client..."

npx prisma generate
log_success "Prisma Client gerado"

# ==========================================
# 6. Aplicar migrations no Supabase
# ==========================================

log_info "Aplicando migrations no Supabase..."

npx prisma migrate deploy
log_success "Migrations aplicadas"

# ==========================================
# 7. Testar conexões
# ==========================================

log_info "Testando conexões com Supabase e Redis Cloud..."

if [ -f "test-connections.js" ]; then
    node test-connections.js
    
    if [ $? -eq 0 ]; then
        log_success "Todas as conexões estão funcionando!"
    else
        log_error "Falha nos testes de conexão"
        log_info "Verifique as credenciais no .env"
        exit 1
    fi
else
    log_warning "Script de teste não encontrado (pulando)"
fi

# ==========================================
# 8. Criar usuário admin (opcional)
# ==========================================

log_info "Deseja criar um usuário admin?"
read -p "Criar admin? (s/N) " -n 1 -r
echo

if [[ $REPLY =~ ^[Ss]$ ]]; then
    if [ -f "criar-admin.ts" ]; then
        npx ts-node criar-admin.ts
        log_success "Usuário admin criado"
    else
        log_warning "Script criar-admin.ts não encontrado"
        log_info "Execute manualmente: npx ts-node criar-admin.ts"
    fi
fi

# ==========================================
# 9. Voltar para pasta raiz
# ==========================================

cd ..

# ==========================================
# 10. Instalar dependências do frontend
# ==========================================

log_info "Instalando dependências do frontend..."

cd frontend

if [ ! -d "node_modules" ]; then
    npm install
    log_success "Dependências do frontend instaladas"
else
    log_info "Dependências do frontend já instaladas (pulando)"
fi

cd ..

# ==========================================
# CONCLUSÃO
# ==========================================

log_title "✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!"

echo -e "${GREEN}Próximos passos:${NC}"
echo -e "  1. ${CYAN}cd backend && npm run dev${NC}  (em um terminal)"
echo -e "  2. ${CYAN}cd frontend && npm run dev${NC} (em outro terminal)"
echo -e "  3. Acesse: ${CYAN}http://localhost:5173${NC}"
echo ""
echo -e "${YELLOW}Credenciais padrão (se criou admin):${NC}"
echo -e "  Email: ${CYAN}admin@sistema.com${NC}"
echo -e "  Senha: ${CYAN}Admin@123${NC}"
echo -e "  ${RED}⚠️  Altere a senha após o primeiro login!${NC}"
echo ""
echo -e "${BLUE}Documentação completa:${NC}"
echo -e "  📖 ${CYAN}GUIA_MIGRACAO_SUPABASE_REDIS.md${NC}"
echo ""
