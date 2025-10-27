# 🆓 Deploy Gratuito Completo - Sistema WhatsApp

## ✅ Tudo 100% Gratuito!

---

## 🎯 Arquitetura Gratuita

```
Frontend (Vercel) ← GRÁTIS
    ↓
Backend (Railway/Render) ← GRÁTIS
    ↓
PostgreSQL (Supabase) ← GRÁTIS (já está usando!)
    ↓
Redis (Redis Cloud) ← GRÁTIS (já está usando!)
```

**Custo total: R$ 0,00/mês** 🎉

---

## 📦 Componentes e Limites

### 1. Frontend - Vercel ✅
- **Custo:** Grátis
- **Limites:**
  - 100 GB bandwidth/mês
  - Builds ilimitados
  - Domínio `.vercel.app` grátis
- **Perfeito para:** Frontend React/Vite

### 2. Backend - Railway ⭐ (Recomendado)
- **Custo:** Grátis
- **Limites:**
  - $5 de crédito/mês (suficiente para projetos pequenos)
  - 500 horas de execução/mês
  - 1 GB RAM
  - 1 GB storage
- **Perfeito para:** Node.js + WebSocket

### 3. Backend - Render (Alternativa)
- **Custo:** Grátis
- **Limites:**
  - 750 horas/mês
  - 512 MB RAM
  - Dorme após 15 min de inatividade (demora ~30s para acordar)
- **Perfeito para:** Projetos de teste

### 4. PostgreSQL - Supabase ✅ (Já configurado!)
- **Custo:** Grátis
- **Limites:**
  - 500 MB database
  - Unlimited API requests
  - 50,000 usuários ativos/mês
- **Status:** ✅ Já está usando!

### 5. Redis - Redis Cloud ✅ (Já configurado!)
- **Custo:** Grátis
- **Limites:**
  - 30 MB storage
  - 30 conexões simultâneas
- **Status:** ✅ Já está usando!

---

## 🚀 Passo a Passo Completo

### 1️⃣ Frontend no Vercel (5 minutos)

#### A. Criar conta
1. Acesse: https://vercel.com
2. Faça login com GitHub

#### B. Deploy
```bash
cd frontend
npm install -g vercel
vercel login
vercel
```

#### C. Configurar variáveis
No painel Vercel:
- Settings > Environment Variables
- Adicionar:
  ```
  VITE_API_URL = https://seu-backend.railway.app
  VITE_WS_URL = wss://seu-backend.railway.app
  ```

**Custo: R$ 0,00** ✅

---

### 2️⃣ Backend no Railway (10 minutos) ⭐

#### A. Criar conta
1. Acesse: https://railway.app
2. Faça login com GitHub

#### B. Criar projeto
```bash
# Instalar CLI
npm install -g @railway/cli

# Login
railway login

# Criar projeto
cd backend
railway init

# Deploy
railway up
```

#### C. Configurar variáveis
No painel Railway:
- Variables > Add Variable
- Copiar do seu `.env`:
  ```
  DATABASE_URL=postgresql://...
  REDIS_URL=redis://...
  JWT_SECRET=...
  JWT_REFRESH_SECRET=...
  PORT=3000
  NODE_ENV=production
  ```

#### D. Configurar domínio
- Settings > Networking > Generate Domain
- Copiar URL: `https://seu-app.railway.app`

**Custo: R$ 0,00** ✅

---

### 3️⃣ PostgreSQL - Supabase ✅ (Já configurado!)

Você já está usando! Não precisa fazer nada.

**Custo: R$ 0,00** ✅

---

### 4️⃣ Redis - Redis Cloud ✅ (Já configurado!)

Você já está usando! Não precisa fazer nada.

**Custo: R$ 0,00** ✅

---

## 🔧 Configuração Completa

### Backend - package.json

Adicione o script de start:

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  }
}
```

### Backend - Procfile (Railway)

Crie `Procfile` na raiz do backend:

```
web: npm start
```

### Backend - .railwayignore

Crie `.railwayignore`:

```
node_modules
.env
.env.local
*.log
.DS_Store
```

---

## 🌐 URLs Finais

Após deploy completo:

```
Frontend:  https://seu-app.vercel.app
Backend:   https://seu-app.railway.app
Database:  Supabase (já configurado)
Redis:     Redis Cloud (já configurado)
```

---

## 💰 Comparação de Custos

### Opção 1: Railway (Recomendado) ⭐

| Serviço | Custo | Limites |
|---------|-------|---------|
| Vercel | R$ 0 | 100 GB/mês |
| Railway | R$ 0 | $5 crédito/mês |
| Supabase | R$ 0 | 500 MB DB |
| Redis Cloud | R$ 0 | 30 MB |
| **TOTAL** | **R$ 0/mês** | ✅ |

**Suficiente para:**
- 1.000-5.000 usuários/mês
- 10.000-50.000 requisições/dia
- 100-500 conversas simultâneas

---

### Opção 2: Render

| Serviço | Custo | Limites |
|---------|-------|---------|
| Vercel | R$ 0 | 100 GB/mês |
| Render | R$ 0 | 750h/mês, dorme |
| Supabase | R$ 0 | 500 MB DB |
| Redis Cloud | R$ 0 | 30 MB |
| **TOTAL** | **R$ 0/mês** | ✅ |

**Desvantagem:** Backend dorme após 15 min (demora ~30s para acordar)

---

## 🎯 Escolha a Melhor Opção

### Railway ⭐ (Recomendado)

**Use se:**
- ✅ Quer que o backend fique sempre ativo
- ✅ Precisa de WebSocket em tempo real
- ✅ Quer melhor performance
- ✅ Projeto vai ter usuários reais

**Limites:**
- $5 crédito/mês (renova todo mês)
- ~500 horas de execução
- Suficiente para projetos pequenos/médios

---

### Render (Alternativa)

**Use se:**
- ✅ É apenas para testes
- ✅ Não se importa com 30s de delay ao acordar
- ✅ Baixo tráfego

**Limites:**
- 750 horas/mês
- Dorme após 15 min inativo
- Acorda em ~30s

---

## 📋 Checklist de Deploy

### Preparação
- [x] Supabase configurado
- [x] Redis Cloud configurado
- [x] `vercel.json` criado
- [ ] Backend compilando (`npm run build`)
- [ ] Frontend compilando (`npm run build`)

### Deploy Frontend (Vercel)
- [ ] Conta criada
- [ ] Projeto conectado
- [ ] Variáveis configuradas
- [ ] Deploy feito
- [ ] Site acessível

### Deploy Backend (Railway)
- [ ] Conta criada
- [ ] Projeto criado
- [ ] Variáveis configuradas
- [ ] Deploy feito
- [ ] API acessível

### Configuração Final
- [ ] CORS configurado no backend
- [ ] URLs atualizadas no frontend
- [ ] Teste de login
- [ ] Teste de WebSocket
- [ ] Teste de envio de mensagem

---

## 🔧 Troubleshooting

### Backend não inicia no Railway

**Erro:** "Application failed to respond"

**Solução:**
```json
// package.json
{
  "scripts": {
    "start": "node dist/server.js"
  }
}
```

E certifique-se que `PORT` está configurado:
```typescript
// server.ts
const port = process.env.PORT || 3000;
```

---

### CORS Error

**Erro:** "CORS policy blocked"

**Solução:**
```typescript
// backend/src/app.ts
await app.register(cors, {
  origin: [
    'http://localhost:5173',
    'https://seu-frontend.vercel.app', // Adicionar
  ],
  credentials: true,
});
```

---

### WebSocket não conecta

**Erro:** "WebSocket connection failed"

**Solução:** Railway suporta WebSocket automaticamente, mas certifique-se:
```typescript
// Use WSS em produção
const wsUrl = process.env.NODE_ENV === 'production' 
  ? 'wss://seu-backend.railway.app'
  : 'ws://localhost:3000';
```

---

### Banco de dados não conecta

**Erro:** "Can't reach database"

**Solução:** Use a URL do Supabase Transaction Pooler:
```
postgresql://...@aws-X.pooler.supabase.com:6543/postgres?pgbouncer=true
```

---

## 🚀 Deploy Automático (GitHub Actions)

Crie `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./frontend

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: backend
```

---

## 💡 Dicas de Economia

### 1. Use Cache Agressivamente
```typescript
// Reduz queries ao banco = economiza recursos
const data = await cache.wrap('key', () => query(), 3600);
```

### 2. Paginação
```typescript
// Não busque tudo de uma vez
const data = await prisma.model.findMany({ take: 20 });
```

### 3. Compressão
```typescript
// Reduz bandwidth
await fastify.register(compress);
```

### 4. Índices no Banco
```sql
-- Queries mais rápidas = menos CPU
CREATE INDEX idx_user_id ON conversations(user_id);
```

---

## 📊 Monitoramento Gratuito

### 1. Vercel Analytics
```html
<!-- Adicionar no index.html -->
<script defer src="/_vercel/insights/script.js"></script>
```

### 2. Railway Logs
```bash
railway logs --follow
```

### 3. Supabase Dashboard
- Acesse: https://supabase.com/dashboard
- Veja queries, uso de storage, etc.

---

## 🎉 Resultado Final

### Custos
```
Frontend (Vercel):      R$ 0,00
Backend (Railway):      R$ 0,00
PostgreSQL (Supabase):  R$ 0,00
Redis (Redis Cloud):    R$ 0,00
──────────────────────────────
TOTAL:                  R$ 0,00/mês
```

### Capacidade
```
Usuários simultâneos:   100-500
Requisições/dia:        10.000-50.000
Conversas ativas:       100-500
Storage:                500 MB (DB) + 30 MB (Redis)
```

### Performance
```
Frontend:               Global CDN (rápido)
Backend:                Sempre ativo (Railway)
Database:               Supabase (rápido)
Cache:                  Redis (muito rápido)
```

---

## 🚀 Comandos Rápidos

```bash
# Deploy Frontend
cd frontend
vercel --prod

# Deploy Backend
cd backend
railway up

# Ver logs
railway logs --follow

# Ver status
railway status
```

---

## ✅ Pronto!

Seu sistema completo rodando **100% gratuito**! 🎉

**Próximo passo:** Fazer o deploy seguindo este guia! 🚀
