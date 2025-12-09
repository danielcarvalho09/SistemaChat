#!/bin/bash

# Script de Instalação Automática - Hostinger
# Executa configuração básica do servidor

set -e  # Parar em caso de erro

echo "🚀 Iniciando instalação no Hostinger..."
echo ""

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar se é root
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}❌ Por favor, execute como root (sudo)${NC}"
  exit 1
fi

# Atualizar sistema
echo -e "${YELLOW}📦 Atualizando sistema...${NC}"
apt update && apt upgrade -y

# Instalar dependências básicas
echo -e "${YELLOW}📦 Instalando dependências...${NC}"
apt install -y curl wget git build-essential

# Instalar Node.js 20
echo -e "${YELLOW}📦 Instalando Node.js 20...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verificar instalação
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
echo -e "${GREEN}✅ Node.js instalado: $NODE_VERSION${NC}"
echo -e "${GREEN}✅ npm instalado: $NPM_VERSION${NC}"

# Instalar PM2
echo -e "${YELLOW}📦 Instalando PM2...${NC}"
npm install -g pm2

PM2_VERSION=$(pm2 --version)
echo -e "${GREEN}✅ PM2 instalado: v$PM2_VERSION${NC}"

# Instalar Nginx
echo -e "${YELLOW}📦 Instalando Nginx...${NC}"
apt install -y nginx
systemctl enable nginx
systemctl start nginx

# Instalar Certbot (para SSL)
echo -e "${YELLOW}📦 Instalando Certbot...${NC}"
apt install -y certbot python3-certbot-nginx

# Configurar Firewall (UFW)
echo -e "${YELLOW}🔥 Configurando firewall...${NC}"
ufw --force enable
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3000/tcp  # Backend (temporário)
ufw allow 5173/tcp  # Frontend (temporário)

echo -e "${GREEN}✅ Firewall configurado${NC}"

# Criar diretório da aplicação
echo -e "${YELLOW}📁 Criando diretórios...${NC}"
mkdir -p /var/www/autochat
mkdir -p /var/www/autochat/logs
chmod -R 755 /var/www/autochat

echo -e "${GREEN}✅ Diretórios criados${NC}"

# Resumo
echo ""
echo -e "${GREEN}═════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ INSTALAÇÃO CONCLUÍDA${NC}"
echo -e "${GREEN}═════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Próximos passos:"
echo "1. Upload do código para /var/www/autochat"
echo "2. Instalar dependências (npm ci)"
echo "3. Configurar .env"
echo "4. Configurar PM2 (ecosystem.config.js)"
echo "5. Configurar Nginx"
echo ""
echo "Consulte: MIGRATION_HOSTINGER.md para detalhes"
echo ""

