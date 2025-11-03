# 🔧 Troubleshooting - Erro de Deploy

## ❌ ERRO ATUAL

```
ERROR: failed to build: listing workers for Build: failed to list workers: 
Unavailable: connection error: desc = "error reading server preface: 
read unix @->/run/docker.sock: use of closed network connection"
Error: Docker build failed
```

## 🔍 DIAGNÓSTICO

Este é um **erro temporário de infraestrutura do Railway/Docker**, não um problema do código.

### Causas Comuns:
1. **Timeout de conexão Docker** - Railway perdeu conexão com Docker daemon
2. **Sobrecarga temporária** - Muitos builds simultâneos
3. **Problema de rede** - Conexão instável entre Railway e Docker
4. **Recursos insuficientes** - Memória/CPU esgotados durante build

---

## ✅ SOLUÇÕES

### Solução 1: Retry Simples (Mais Comum)
```bash
# Simplesmente fazer push novamente
git push

# Ou forçar novo deploy no Railway
railway up
```

**Taxa de sucesso: 90%** - Geralmente resolve na segunda tentativa.

---

### Solução 2: Limpar Cache do Build
```bash
# No Railway Dashboard:
# Settings → Deploy → Clear Build Cache

# Depois fazer push novamente
git push
```

---

### Solução 3: Otimizar Dockerfile (Se Continuar Falhando)

**Criar/Otimizar:** `Tom/backend/Dockerfile`

```dockerfile
# Use imagem Node Alpine (mais leve)
FROM node:18-alpine AS builder

# Instalar dependências necessárias
RUN apk add --no-cache python3 make g++

# Definir diretório de trabalho
WORKDIR /app

# Copiar package files
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependências
RUN npm ci --only=production

# Copiar código fonte
COPY . .

# Gerar Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Estágio de produção
FROM node:18-alpine

WORKDIR /app

# Copiar node_modules e build do estágio anterior
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

# Expor porta
EXPOSE 3333

# Comando de inicialização
CMD ["node", "dist/server.js"]
```

---

### Solução 4: Configurar railway.toml

**Criar:** `Tom/backend/railway.toml`

```toml
[build]
builder = "NIXPACKS"
buildCommand = "npm ci && npx prisma generate && npm run build"

[deploy]
startCommand = "npm start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[healthcheck]
path = "/health"
timeout = 300
interval = 30
```

---

### Solução 5: Reduzir Tamanho do Build

**Criar/Atualizar:** `Tom/backend/.dockerignore`

```
node_modules
dist
.git
.env
.env.*
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.DS_Store
coverage
.vscode
.idea
*.swp
*.swo
uploads/*
!uploads/.gitkeep
```

---

### Solução 6: Aumentar Timeout (Railway Dashboard)

```
Settings → Deploy → Build Settings
- Build Timeout: 30 minutos (aumentar)
- Deploy Timeout: 10 minutos (aumentar)
```

---

## 🚀 ESTRATÉGIA RECOMENDADA

### Passo 1: Retry Imediato
```bash
# Simplesmente tentar novamente
git push
```

### Passo 2: Se Falhar Novamente (Aguardar 5 minutos)
```bash
# Aguardar Railway se recuperar
sleep 300

# Tentar novamente
git push
```

### Passo 3: Se Continuar Falhando
```bash
# Limpar cache no Railway Dashboard
# Settings → Deploy → Clear Build Cache

# Fazer commit vazio para forçar rebuild
git commit --allow-empty -m "chore: force rebuild"
git push
```

### Passo 4: Última Opção
```bash
# Criar Dockerfile otimizado (ver Solução 3)
# Criar railway.toml (ver Solução 4)
# Criar .dockerignore (ver Solução 5)

git add .
git commit -m "chore: optimize docker build"
git push
```

---

## 📊 VERIFICAR LOGS

### Railway CLI
```bash
# Ver logs do build
railway logs --build

# Ver logs da aplicação
railway logs
```

### Railway Dashboard
```
Deployments → [Último Deploy] → View Logs
```

---

## 🔍 VERIFICAR SAÚDE DO SISTEMA

### Antes de Tentar Deploy:

1. **Verificar Build Local**
```bash
cd Tom/backend
npm run build
# Deve compilar sem erros
```

2. **Verificar Prisma**
```bash
npx prisma generate
# Deve gerar client sem erros
```

3. **Verificar Dependências**
```bash
npm install
# Deve instalar sem erros
```

---

## ⚠️ PROBLEMAS CONHECIDOS

### 1. Prisma Generate Falha no Build
**Solução:** Adicionar ao `package.json`
```json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

### 2. TypeScript Build Muito Lento
**Solução:** Adicionar ao `tsconfig.json`
```json
{
  "compilerOptions": {
    "incremental": true,
    "skipLibCheck": true
  }
}
```

### 3. Memória Insuficiente
**Solução:** Aumentar plano do Railway ou otimizar build

---

## 📈 MONITORAMENTO

### Verificar Status do Railway
```bash
# Status dos serviços
railway status

# Uso de recursos
railway metrics
```

---

## ✅ CHECKLIST PRÉ-DEPLOY

Antes de fazer deploy, verificar:

- [ ] `npm run build` funciona localmente
- [ ] `npx prisma generate` funciona
- [ ] Não há erros de TypeScript
- [ ] `.env` está configurado no Railway
- [ ] Migrations estão aplicadas
- [ ] Build anterior foi bem-sucedido

---

## 🎯 AÇÃO IMEDIATA

**Para o erro atual, fazer:**

```bash
# Opção 1: Retry simples (RECOMENDADO)
git push

# Opção 2: Se falhar, aguardar 5 min e tentar novamente
sleep 300 && git push

# Opção 3: Limpar cache no Railway Dashboard e tentar
# Settings → Deploy → Clear Build Cache
# Depois: git push
```

---

## 📞 SUPORTE

Se o problema persistir após 3 tentativas:

1. Verificar status do Railway: https://status.railway.app
2. Verificar logs detalhados no Dashboard
3. Criar ticket no suporte do Railway
4. Considerar usar outro provider temporariamente

---

**Na maioria dos casos, simplesmente fazer `git push` novamente resolve o problema! 🚀**
