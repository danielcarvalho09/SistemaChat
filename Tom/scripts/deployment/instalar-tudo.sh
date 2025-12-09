#!/bin/bash

# ==========================================
# Script de Instalação Completa
# Instala tudo que você precisa para o projeto
# ==========================================

set -e  # Parar em caso de erro

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

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

log_title "🚀 INSTALAÇÃO COMPLETA DO PROJETO"

# ==========================================
# 1. Verificar/Instalar Homebrew
# ==========================================

log_info "Verificando Homebrew..."

if ! command -v brew &> /dev/null; then
    log_warning "Homebrew não encontrado. Instalando..."
    
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Adicionar ao PATH (para Apple Silicon)
    if [[ $(uname -m) == 'arm64' ]]; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
    
    log_success "Homebrew instalado!"
else
    log_success "Homebrew já instalado"
fi

# ==========================================
# 2. Instalar Node.js
# ==========================================

log_info "Verificando Node.js..."

if ! command -v node &> /dev/null; then
    log_warning "Node.js não encontrado. Instalando..."
    
    brew install node
    
    log_success "Node.js instalado!"
    node --version
    npm --version
else
    log_success "Node.js já instalado ($(node --version))"
fi

# ==========================================
# 3. Instalar Docker Desktop (opcional)
# ==========================================

log_info "Verificando Docker..."

if ! command -v docker &> /dev/null; then
    log_warning "Docker não encontrado."
    echo ""
    echo -e "${YELLOW}Docker Desktop é necessário apenas se você quiser usar o banco local como fallback.${NC}"
    echo -e "${YELLOW}Se você vai usar apenas Supabase + Redis Cloud, pode pular.${NC}"
    echo ""
    read -p "Deseja instalar Docker Desktop? (s/N) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        log_info "Instalando Docker Desktop..."
        brew install --cask docker
        log_success "Docker Desktop instalado!"
        log_warning "IMPORTANTE: Abra o Docker Desktop manualmente para completar a configuração"
    else
        log_info "Docker não será instalado (você usará apenas Cloud)"
    fi
else
    log_success "Docker já instalado"
fi

# ==========================================
# 4. Instalar Git (se não tiver)
# ==========================================

log_info "Verificando Git..."

if ! command -v git &> /dev/null; then
    log_warning "Git não encontrado. Instalando..."
    brew install git
    log_success "Git instalado!"
else
    log_success "Git já instalado ($(git --version))"
fi

# ==========================================
# 5. Instalar dependências do projeto
# ==========================================

log_title "📦 INSTALANDO DEPENDÊNCIAS DO PROJETO"

# Backend
log_info "Instalando dependências do backend..."
cd backend

if [ ! -d "node_modules" ]; then
    npm install
    log_success "Dependências do backend instaladas!"
else
    log_info "Dependências do backend já instaladas"
fi

# Gerar Prisma Client
log_info "Gerando Prisma Client..."
npx prisma generate
log_success "Prisma Client gerado!"

cd ..

# Frontend
log_info "Instalando dependências do frontend..."
cd frontend

if [ ! -d "node_modules" ]; then
    npm install
    log_success "Dependências do frontend instaladas!"
else
    log_info "Dependências do frontend já instaladas"
fi

cd ..

# ==========================================
# 6. Verificar instalações
# ==========================================

log_title "✅ VERIFICANDO INSTALAÇÕES"

echo -e "${GREEN}Node.js:${NC} $(node --version)"
echo -e "${GREEN}npm:${NC} $(npm --version)"
echo -e "${GREEN}npx:${NC} $(npx --version)"

if command -v git &> /dev/null; then
    echo -e "${GREEN}Git:${NC} $(git --version)"
fi

if command -v docker &> /dev/null; then
    echo -e "${GREEN}Docker:${NC} $(docker --version)"
else
    echo -e "${YELLOW}Docker:${NC} Não instalado (apenas Cloud será usado)"
fi

# ==========================================
# CONCLUSÃO
# ==========================================

log_title "🎉 INSTALAÇÃO CONCLUÍDA!"

echo -e "${GREEN}Tudo instalado com sucesso!${NC}"
echo ""
echo -e "${CYAN}Próximos passos:${NC}"
echo ""
echo -e "1. ${YELLOW}Configure suas credenciais no arquivo:${NC}"
echo -e "   ${BLUE}backend/.env${NC}"
echo ""
echo -e "2. ${YELLOW}Obtenha credenciais em:${NC}"
echo -e "   - Supabase: ${BLUE}https://supabase.com/dashboard${NC}"
echo -e "   - Redis Cloud: ${BLUE}https://app.redislabs.com/${NC}"
echo ""
echo -e "3. ${YELLOW}Aplique as migrations:${NC}"
echo -e "   ${BLUE}cd backend${NC}"
echo -e "   ${BLUE}npx prisma migrate deploy${NC}"
echo ""
echo -e "4. ${YELLOW}Inicie o sistema:${NC}"
echo -e "   Terminal 1: ${BLUE}cd backend && npm run dev${NC}"
echo -e "   Terminal 2: ${BLUE}cd frontend && npm run dev${NC}"
echo ""
echo -e "${GREEN}📖 Guias disponíveis:${NC}"
echo -e "   - ${BLUE}RESOLVER_ERRO_MIGRATION.md${NC}"
echo -e "   - ${BLUE}GUIA_MIGRACAO_SUPABASE_REDIS.md${NC}"
echo -e "   - ${BLUE}COMANDOS_RAPIDOS_MIGRACAO.txt${NC}"
echo ""
