# 🚀 Deploy Frontend no Vercel - Guia Completo

## ❌ Erro 404: NOT_FOUND

**Causa:** Falta configuração do Vercel para SPA (Single Page Application)

**Solução:** Arquivo `vercel.json` criado! ✅

---

## 📋 Passo a Passo para Deploy

### 1️⃣ Configurar Variáveis de Ambiente

No painel do Vercel:

1. Vá em **Settings** > **Environment Variables**
2. Adicione as variáveis:

```env
VITE_API_URL=https://seu-backend.com
VITE_WS_URL=wss://seu-backend.com
```

**Importante:** Use a URL do seu backend em produção!

---

### 2️⃣ Verificar package.json

Certifique-se que tem os scripts corretos:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

---

### 3️⃣ Fazer Deploy

#### Opção A: Via CLI

```bash
# Instalar Vercel CLI
npm i -g vercel

# Fazer deploy
cd frontend
vercel

# Seguir as instruções
```

#### Opção B: Via GitHub

1. Conecte seu repositório no Vercel
2. Selecione a pasta `frontend`
3. Configure:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Root Directory**: `frontend`

---

### 4️⃣ Configurações Importantes

#### vercel.json (Já criado! ✅)

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**O que faz:** Redireciona todas as rotas para `index.html` (necessário para React Router)

---

## 🔧 Troubleshooting

### Erro: 404 nas rotas

**Causa:** Vercel não sabe que é SPA
**Solução:** `vercel.json` com rewrites ✅

### Erro: Build falha

**Causa:** Variáveis de ambiente faltando
**Solução:** Adicionar `VITE_API_URL` e `VITE_WS_URL`

### Erro: API não conecta

**Causa:** CORS ou URL errada
**Solução:** 
1. Verificar `VITE_API_URL` está correto
2. Configurar CORS no backend:

```typescript
// backend/src/app.ts
await app.register(cors, {
  origin: [
    'http://localhost:5173',
    'https://seu-frontend.vercel.app' // Adicionar
  ],
  credentials: true,
});
```

### Erro: WebSocket não conecta

**Causa:** WSS não configurado
**Solução:** Backend precisa suportar WSS (HTTPS + WebSocket)

---

## 🎯 Checklist de Deploy

- [x] `vercel.json` criado
- [ ] Variáveis de ambiente configuradas no Vercel
- [ ] Backend em produção (Render, Railway, etc)
- [ ] CORS configurado no backend
- [ ] URLs corretas no `.env` local e Vercel
- [ ] Build local funciona (`npm run build`)
- [ ] Preview funciona (`npm run preview`)

---

## 🌐 Estrutura de URLs

### Desenvolvimento:
```
Frontend: http://localhost:5173
Backend:  http://localhost:3000
```

### Produção:
```
Frontend: https://seu-app.vercel.app
Backend:  https://seu-backend.railway.app (ou outro)
```

---

## 📦 Deploy do Backend

O backend NÃO pode ir no Vercel (Vercel é para frontend/serverless).

### Opções para Backend:

#### 1. Railway ⭐ (Recomendado)
```bash
# Instalar CLI
npm i -g @railway/cli

# Login
railway login

# Deploy
cd backend
railway init
railway up
```

**Vantagens:**
- ✅ Suporta Node.js long-running
- ✅ PostgreSQL incluído
- ✅ Redis incluído
- ✅ WebSocket suportado
- ✅ Free tier generoso

#### 2. Render
```bash
# Conectar GitHub
# Criar Web Service
# Configurar:
- Build: npm install
- Start: npm start
```

**Vantagens:**
- ✅ Free tier
- ✅ PostgreSQL gratuito
- ✅ Fácil configurar

#### 3. Heroku
```bash
heroku create
git push heroku main
```

**Desvantagens:**
- ❌ Não tem free tier mais

---

## 🔐 Variáveis de Ambiente

### Frontend (.env)
```env
VITE_API_URL=https://seu-backend.railway.app
VITE_WS_URL=wss://seu-backend.railway.app
```

### Backend (.env)
```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
CORS_ORIGIN=https://seu-frontend.vercel.app
```

---

## 🚀 Deploy Automático

### GitHub Actions (Opcional)

Crie `.github/workflows/deploy.yml`:

```yaml
name: Deploy Frontend

on:
  push:
    branches: [main]
    paths:
      - 'frontend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install and Build
        working-directory: ./frontend
        run: |
          npm ci
          npm run build
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./frontend
```

---

## 📊 Monitoramento

### Vercel Analytics

Adicione no `index.html`:

```html
<script defer src="/_vercel/insights/script.js"></script>
```

### Logs

```bash
# Ver logs em tempo real
vercel logs seu-projeto --follow
```

---

## ✅ Teste Final

Após deploy:

1. ✅ Acesse `https://seu-app.vercel.app`
2. ✅ Teste login
3. ✅ Teste navegação entre páginas
4. ✅ Teste conexão com API
5. ✅ Teste WebSocket (se aplicável)
6. ✅ Teste em mobile

---

## 🎯 Comandos Úteis

```bash
# Build local
npm run build

# Preview do build
npm run preview

# Deploy para produção
vercel --prod

# Ver deployments
vercel ls

# Ver logs
vercel logs

# Remover deployment
vercel rm deployment-url
```

---

## 📚 Recursos

- [Vercel Docs](https://vercel.com/docs)
- [Vite Docs](https://vitejs.dev/guide/)
- [Railway Docs](https://docs.railway.app/)

---

## 🎉 Pronto!

Agora seu frontend está configurado para deploy no Vercel!

**Próximo passo:** Fazer deploy do backend no Railway/Render 🚀
