# 🚂 Guia Completo de Deploy no Railway

Este guia cobre o deploy completo do sistema (frontend + backend) no Railway.

## 📋 Pré-requisitos

- Conta no [Railway.app](https://railway.app/)
- Banco de dados PostgreSQL (Supabase recomendado)
- Redis Cloud configurado
- GitHub repository configurado

## 🎯 Estrutura do Projeto

```
SistemaChat/
├── Tom/
│   ├── backend/     # API Node.js/Fastify
│   └── frontend/    # React/Vite
```

---

## 🔧 PARTE 1: Configuração Inicial

### 1.1 Criar Projeto no Railway

1. Acesse [Railway.app](https://railway.app/)
2. Clique em "New Project"
3. Selecione "Deploy from GitHub repo"
4. Escolha seu repositório

### 1.2 Preparar Banco de Dados (Supabase)

1. Acesse [Supabase](https://supabase.com/)
2. Crie um novo projeto
3. Vá em Settings → Database → Connection string
4. Copie a connection string `postgresql://...`

### 1.3 Preparar Redis (Redis Cloud)

1. Acesse [Redis Cloud](https://redis.io/cloud/)
2. Crie um banco gratuito
3. Copie o endpoint e senha

---

## 🚀 PARTE 2: Deploy do Backend

### 2.1 Criar Serviço Backend

1. No Railway, clique em "New Service"
2. Selecione "GitHub Repo"
3. Escolha o repositório

### 2.2 Configurar Root Directory

1. Clique no serviço backend
2. Vá em **Settings**
3. Em **Service**, configure:
   - **Root Directory**: `Tom/backend`
   - **Build Command**: (deixe vazio, está no railway.toml)
   - **Start Command**: (deixe vazio, está no railway.toml)

### 2.3 Configurar Variáveis de Ambiente

1. Vá em **Variables**
2. Clique em **RAW Editor**
3. Cole:

```env
DATABASE_URL=postgresql://postgres.xxx:password@xxx.supabase.co:6543/postgres?pgbouncer=true
REDIS_URL=redis://default:password@endpoint:13341
REDIS_PASSWORD=your-redis-password
QUEUE_REDIS_HOST=endpoint.redis-cloud.com
QUEUE_REDIS_PORT=13341
QUEUE_REDIS_PASSWORD=your-redis-password
JWT_SECRET=<gere com: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))">
JWT_REFRESH_SECRET=<gere outro diferente>
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
PORT=3000
NODE_ENV=production
API_PREFIX=/api/v1
BCRYPT_ROUNDS=12
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000
CORS_ORIGIN=*
LOG_LEVEL=info
LOG_FILE_PATH=./logs
WHATSAPP_SESSION_PATH=./whatsapp-sessions
MAX_CONNECTIONS=100
WHATSAPP_TIMEOUT=60000
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,video/mp4,application/pdf
```

4. Clique em **Update Variables**

### 2.4 Verificar Arquivos de Configuração

Certifique-se que existem:

**Tom/backend/railway.toml**
```toml
[build]
builder = "NIXPACKS"
buildCommand = "npm install && npm run build"

[deploy]
startCommand = "npm start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

**Tom/backend/nixpacks.toml**
```toml
[phases.setup]
nixPkgs = ["nodejs_20", "openssl"]

[phases.install]
cmds = ["npm install"]

[phases.build]
cmds = ["npm run build"]

[start]
cmd = "npm start"
```

### 2.5 Deploy

1. Faça commit e push:
```bash
git add .
git commit -m "Configure Railway deployment"
git push
```

2. Railway detectará automaticamente e fará deploy

### 2.6 Obter URL do Backend

1. No serviço backend, vá em **Settings**
2. Em **Networking**, clique em "Generate Domain"
3. Copie a URL gerada (ex: `https://backend-production-xxx.up.railway.app`)

---

## 🎨 PARTE 3: Deploy do Frontend

### 3.1 Criar Serviço Frontend

1. Clique em "New Service"
2. Selecione o mesmo repositório

### 3.2 Configurar Root Directory

1. Clique no serviço frontend
2. Vá em **Settings**
3. Em **Service**, configure:
   - **Root Directory**: `Tom/frontend`

### 3.3 Configurar Variáveis de Ambiente

1. Vá em **Variables**
2. Adicione:

```env
VITE_API_URL=https://backend-production-xxx.up.railway.app
VITE_WS_URL=wss://backend-production-xxx.up.railway.app
NODE_ENV=production
```

⚠️ **IMPORTANTE**: Substitua `xxx` pela URL real do seu backend!

### 3.4 Verificar Configuração

**Tom/frontend/railway.toml**
```toml
[build]
builder = "NIXPACKS"
buildCommand = "npm install && npm run build"

[deploy]
startCommand = "npm start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

**Tom/frontend/nixpacks.toml**
```toml
[phases.setup]
nixPkgs = ["nodejs-18_x"]

[phases.install]
cmds = ["npm install"]

[phases.build]
cmds = ["npm run build"]

[start]
cmd = "npm start"
```

### 3.5 Deploy

1. Push das mudanças (se houver)
2. Railway fará deploy automático

### 3.6 Atualizar CORS no Backend

1. Volte ao serviço **backend**
2. Em **Variables**, atualize:
```env
CORS_ORIGIN=https://frontend-production-xxx.up.railway.app
```
3. Substitua pela URL real do frontend

---

## ✅ PARTE 4: Verificação

### 4.1 Testar Backend

```bash
curl https://backend-production-xxx.up.railway.app/health
```

Deve retornar:
```json
{
  "status": "ok",
  "timestamp": "2024-...",
  "uptime": 123.45
}
```

### 4.2 Testar Health Check Detalhado

```bash
curl https://backend-production-xxx.up.railway.app/health/detailed
```

Deve mostrar status de Database e Redis.

### 4.3 Acessar Frontend

Abra no navegador:
```
https://frontend-production-xxx.up.railway.app
```

### 4.4 Verificar Logs

1. Clique em cada serviço
2. Vá na aba **Deployments**
3. Clique no deployment ativo
4. Veja os logs em tempo real

---

## 🔥 PARTE 5: Troubleshooting

### Problema: Build falha com "npm not found"

**Solução**: Verifique `nixpacks.toml` - deve ter `nodejs_20` ou `nodejs-18_x`

### Problema: "DATABASE_URL is required"

**Solução**: Adicione variáveis no Railway Variables (não no código!)

### Problema: CORS Error no frontend

**Solução**: 
1. Verifique `CORS_ORIGIN` no backend
2. Deve ser a URL do frontend (sem barra no final)

### Problema: WebSocket não conecta

**Solução**:
1. Verifique `VITE_WS_URL` usa `wss://` (não `ws://`)
2. URL deve ser a mesma do backend

### Problema: Deploy reiniciando constantemente

**Solução**:
1. Veja logs do deploy
2. Provavelmente falta variável de ambiente
3. Ou erro de compilação TypeScript

### Problema: "ERR_MODULE_NOT_FOUND"

**Solução**:
1. Todos os imports devem ter `.js` no final
2. `package.json` deve ter `"type": "module"`
3. `tsconfig.json` deve ter `"module": "ESNext"`

---

## 🔧 PARTE 6: Manutenção

### Limpar Cache de Build

1. Serviço → Settings
2. Scroll até "Build"
3. Clique em "Clear Build Cache"
4. Redeploy

### Forçar Redeploy

1. Vá na aba "Deployments"
2. Clique nos 3 pontinhos do deploy
3. "Redeploy"

### Ver Métricas

1. Aba "Metrics" mostra:
   - CPU usage
   - Memory usage
   - Network traffic

### Configurar Domínio Customizado

1. Settings → Networking
2. "Custom Domain"
3. Adicione seu domínio
4. Configure DNS conforme instruções

---

## 🎯 Checklist Final

Backend:
- [ ] Root Directory: `Tom/backend`
- [ ] Todas as variáveis de ambiente configuradas
- [ ] `railway.toml` e `nixpacks.toml` existem
- [ ] Deploy bem-sucedido
- [ ] `/health` retorna 200
- [ ] Domínio gerado

Frontend:
- [ ] Root Directory: `Tom/frontend`
- [ ] `VITE_API_URL` e `VITE_WS_URL` configurados
- [ ] Apontam para URL do backend
- [ ] Deploy bem-sucedido
- [ ] Site acessível no navegador

Segurança:
- [ ] JWT secrets gerados (não usar exemplo)
- [ ] CORS configurado corretamente
- [ ] DATABASE_URL usando pooler do Supabase
- [ ] Redis com senha configurada

---

## 📞 Suporte

Se encontrar problemas:

1. **Verifique os logs** no Railway
2. **Teste health checks**: `/health/detailed`
3. **Verifique variáveis**: estão todas configuradas?
4. **Limpe cache** e redeploy
5. **Consulte documentação** do Railway

---

**Deploy realizado com sucesso! 🎉**

Seu sistema está no ar e pronto para uso em produção!
