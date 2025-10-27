# 🚀 Guia Completo de Deploy na VPS Hostinger

## 📋 Pré-requisitos

### 1. Contratar VPS na Hostinger
- **Sistema Operacional:** Ubuntu 22.04 LTS (64-bit)
- **Recursos Mínimos Recomendados:**
  - RAM: 2GB (mínimo) / 4GB (recomendado)
  - CPU: 2 vCPUs
  - Armazenamento: 40GB SSD
  - Largura de banda: Ilimitada

### 2. Acesso SSH
Você receberá da Hostinger:
- IP do servidor (ex: 123.456.789.10)
- Usuário root
- Senha inicial

---

## 🔧 Passo 1: Configuração Inicial do Servidor

### 1.1 Conectar via SSH
```bash
ssh root@SEU_IP_AQUI
```

### 1.2 Atualizar Sistema
```bash
apt update && apt upgrade -y
```

### 1.3 Criar Usuário Não-Root (Segurança)
```bash
adduser deploy
usermod -aG sudo deploy
```

### 1.4 Configurar Firewall
```bash
ufw allow OpenSSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable
```

---

## 📦 Passo 2: Instalar Dependências

### 2.1 Instalar Node.js 20.x (LTS)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs
node --version  # Verificar instalação
npm --version
```

### 2.2 Instalar PostgreSQL 15
```bash
apt install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql
```

### 2.3 Instalar Nginx
```bash
apt install -y nginx
systemctl start nginx
systemctl enable nginx
```

### 2.4 Instalar PM2 (Gerenciador de Processos)
```bash
npm install -g pm2
```

### 2.5 Instalar Git
```bash
apt install -y git
```

---

## 🗄️ Passo 3: Configurar PostgreSQL

### 3.1 Criar Banco de Dados e Usuário
```bash
sudo -u postgres psql
```

Dentro do PostgreSQL:
```sql
-- Criar usuário
CREATE USER crmuser WITH PASSWORD 'SUA_SENHA_FORTE_AQUI';

-- Criar banco de dados
CREATE DATABASE crmweb;

-- Dar permissões
GRANT ALL PRIVILEGES ON DATABASE crmweb TO crmuser;

-- Sair
\q
```

### 3.2 Permitir Conexões Locais
```bash
nano /etc/postgresql/15/main/pg_hba.conf
```

Adicionar linha:
```
local   all             crmuser                                 md5
```

Reiniciar PostgreSQL:
```bash
systemctl restart postgresql
```

---

## 📂 Passo 4: Clonar e Configurar Projeto

### 4.1 Mudar para Usuário Deploy
```bash
su - deploy
```

### 4.2 Clonar Repositório (ou Upload via SFTP)
```bash
cd ~
git clone SEU_REPOSITORIO_AQUI crm-web
# OU criar pasta e fazer upload via SFTP
mkdir crm-web
```

### 4.3 Configurar Backend

#### 4.3.1 Instalar Dependências
```bash
cd ~/crm-web/backend
npm install
```

#### 4.3.2 Criar Arquivo .env
```bash
nano .env
```

Conteúdo do .env:
```env
# Database
DATABASE_URL="postgresql://crmuser:SUA_SENHA_FORTE_AQUI@localhost:5432/crmweb?schema=public"

# JWT
JWT_SECRET="sua-chave-secreta-super-forte-aqui-min-32-chars"
JWT_EXPIRES_IN="7d"

# Server
PORT=3000
NODE_ENV=production

# CORS
CORS_ORIGIN="https://seu-dominio.com"

# Upload
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE=10485760
```

#### 4.3.3 Executar Migrations
```bash
npx prisma migrate deploy
npx prisma generate
```

#### 4.3.4 Build do Backend
```bash
npm run build
```

### 4.4 Configurar Frontend

#### 4.4.1 Instalar Dependências
```bash
cd ~/crm-web/frontend
npm install
```

#### 4.4.2 Criar Arquivo .env
```bash
nano .env
```

Conteúdo do .env:
```env
VITE_API_URL=https://seu-dominio.com/api
VITE_WS_URL=https://seu-dominio.com
```

#### 4.4.3 Build do Frontend
```bash
npm run build
```

---

## 🚀 Passo 5: Configurar PM2 (Backend)

### 5.1 Criar Arquivo de Configuração PM2
```bash
cd ~/crm-web/backend
nano ecosystem.config.js
```

Conteúdo:
```javascript
module.exports = {
  apps: [{
    name: 'crm-backend',
    script: './dist/index.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
```

### 5.2 Criar Pasta de Logs
```bash
mkdir -p logs
```

### 5.3 Iniciar Backend com PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 5.4 Verificar Status
```bash
pm2 status
pm2 logs crm-backend
```

---

## 🌐 Passo 6: Configurar Nginx

### 6.1 Criar Configuração do Site
```bash
sudo nano /etc/nginx/sites-available/crm-web
```

Conteúdo:
```nginx
server {
    listen 80;
    server_name seu-dominio.com www.seu-dominio.com;

    # Frontend (React)
    root /home/deploy/crm-web/frontend/dist;
    index index.html;

    # Logs
    access_log /var/log/nginx/crm-access.log;
    error_log /var/log/nginx/crm-error.log;

    # Frontend - SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket (Socket.IO)
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Uploads
    location /uploads {
        alias /home/deploy/crm-web/backend/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 6.2 Ativar Site
```bash
sudo ln -s /etc/nginx/sites-available/crm-web /etc/nginx/sites-enabled/
sudo nginx -t  # Testar configuração
sudo systemctl restart nginx
```

---

## 🔒 Passo 7: Configurar SSL (HTTPS) com Certbot

### 7.1 Instalar Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 7.2 Obter Certificado SSL
```bash
sudo certbot --nginx -d seu-dominio.com -d www.seu-dominio.com
```

Siga as instruções:
- Digite seu email
- Aceite os termos
- Escolha redirecionar HTTP para HTTPS (opção 2)

### 7.3 Renovação Automática
```bash
sudo certbot renew --dry-run  # Testar renovação
```

O Certbot configura renovação automática automaticamente!

---

## 📊 Passo 8: Monitoramento

### 8.1 Ver Logs do Backend
```bash
pm2 logs crm-backend
pm2 logs crm-backend --lines 100  # Últimas 100 linhas
```

### 8.2 Ver Logs do Nginx
```bash
sudo tail -f /var/log/nginx/crm-access.log
sudo tail -f /var/log/nginx/crm-error.log
```

### 8.3 Monitorar Recursos
```bash
pm2 monit  # Monitoramento em tempo real
htop       # Monitorar CPU/RAM (instalar: apt install htop)
```

---

## 🔄 Passo 9: Atualizar Aplicação

### 9.1 Script de Deploy Automático
Criar arquivo `deploy.sh`:
```bash
nano ~/crm-web/deploy.sh
```

Conteúdo:
```bash
#!/bin/bash

echo "🚀 Starting deployment..."

# Backend
echo "📦 Updating backend..."
cd ~/crm-web/backend
git pull
npm install
npx prisma migrate deploy
npx prisma generate
npm run build
pm2 restart crm-backend

# Frontend
echo "🎨 Updating frontend..."
cd ~/crm-web/frontend
git pull
npm install
npm run build

echo "✅ Deployment completed!"
```

Tornar executável:
```bash
chmod +x ~/crm-web/deploy.sh
```

### 9.2 Executar Deploy
```bash
~/crm-web/deploy.sh
```

---

## 🛡️ Passo 10: Segurança Adicional

### 10.1 Configurar Fail2Ban (Proteção contra Brute Force)
```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 10.2 Desabilitar Login Root via SSH
```bash
sudo nano /etc/ssh/sshd_config
```

Alterar:
```
PermitRootLogin no
```

Reiniciar SSH:
```bash
sudo systemctl restart sshd
```

### 10.3 Configurar Backups Automáticos do Banco
```bash
nano ~/backup-db.sh
```

Conteúdo:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/deploy/backups"
mkdir -p $BACKUP_DIR

pg_dump -U crmuser -h localhost crmweb | gzip > $BACKUP_DIR/crmweb_$DATE.sql.gz

# Manter apenas últimos 7 backups
find $BACKUP_DIR -name "crmweb_*.sql.gz" -mtime +7 -delete

echo "Backup completed: crmweb_$DATE.sql.gz"
```

Tornar executável:
```bash
chmod +x ~/backup-db.sh
```

Agendar backup diário (crontab):
```bash
crontab -e
```

Adicionar linha:
```
0 2 * * * /home/deploy/backup-db.sh
```

---

## 📝 Checklist Final

- [ ] VPS contratada com Ubuntu 22.04 LTS
- [ ] Sistema atualizado
- [ ] Node.js 20.x instalado
- [ ] PostgreSQL 15 instalado e configurado
- [ ] Nginx instalado e configurado
- [ ] PM2 instalado
- [ ] Banco de dados criado
- [ ] Backend clonado e configurado
- [ ] Frontend clonado e configurado
- [ ] Migrations executadas
- [ ] Backend rodando com PM2
- [ ] Nginx servindo frontend
- [ ] SSL configurado (HTTPS)
- [ ] Firewall configurado
- [ ] Backups automáticos configurados
- [ ] Domínio apontando para o IP da VPS

---

## 🌐 Configurar Domínio

### No Painel da Hostinger (ou seu provedor de domínio):

1. **Adicionar Registro A:**
   - Nome: `@`
   - Tipo: `A`
   - Valor: `IP_DA_SUA_VPS`
   - TTL: `14400`

2. **Adicionar Registro A para www:**
   - Nome: `www`
   - Tipo: `A`
   - Valor: `IP_DA_SUA_VPS`
   - TTL: `14400`

3. **Aguardar Propagação DNS** (pode levar até 24h, geralmente 1-2h)

---

## 🆘 Troubleshooting

### Problema: Backend não inicia
```bash
pm2 logs crm-backend --lines 50
# Verificar erros nos logs
```

### Problema: Nginx retorna 502 Bad Gateway
```bash
# Verificar se backend está rodando
pm2 status

# Verificar logs do Nginx
sudo tail -f /var/log/nginx/crm-error.log
```

### Problema: Banco de dados não conecta
```bash
# Testar conexão
psql -U crmuser -h localhost -d crmweb

# Verificar se PostgreSQL está rodando
sudo systemctl status postgresql
```

### Problema: SSL não funciona
```bash
# Verificar certificado
sudo certbot certificates

# Renovar manualmente
sudo certbot renew
```

---

## 📞 Comandos Úteis

```bash
# PM2
pm2 list                    # Listar processos
pm2 restart crm-backend     # Reiniciar backend
pm2 stop crm-backend        # Parar backend
pm2 delete crm-backend      # Remover processo
pm2 logs crm-backend        # Ver logs

# Nginx
sudo systemctl status nginx    # Status
sudo systemctl restart nginx   # Reiniciar
sudo nginx -t                  # Testar configuração

# PostgreSQL
sudo systemctl status postgresql  # Status
sudo systemctl restart postgresql # Reiniciar

# Sistema
df -h                # Espaço em disco
free -h              # Memória RAM
htop                 # Monitor de recursos
```

---

## 🎉 Pronto!

Seu CRM WEB está agora rodando em produção na VPS Hostinger!

**URLs de Acesso:**
- Frontend: `https://seu-dominio.com`
- Backend API: `https://seu-dominio.com/api`
- WebSocket: `https://seu-dominio.com/socket.io`

**Próximos Passos:**
1. Testar todas as funcionalidades
2. Configurar monitoramento (Uptime Robot, etc)
3. Configurar backups externos (S3, Dropbox, etc)
4. Documentar credenciais em local seguro
