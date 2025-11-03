# 🚀 Sistema de Chat WhatsApp

Monorepo com Backend (Node.js) e Frontend (React/Vite)

## 📦 Estrutura

```
/
├── Tom/
│   ├── backend/    # API Node.js + Prisma
│   │   ├── railway.toml
│   │   └── package.json
│   └── frontend/   # React + Vite
│       ├── railway.toml
│       └── package.json
└── README.md
```

## 🚂 Deploy no Railway (IMPORTANTE!)

### ⚠️ ATENÇÃO: Fazer 2 deploys SEPARADOS!

Railway precisa deployar Backend e Frontend SEPARADAMENTE.

---

### 1️⃣ Deploy do BACKEND:

1. Acesse https://railway.app
2. Clique em "New Project"
3. Escolha "Deploy from GitHub repo"
4. Selecione este repositório
5. **IMPORTANTE**: Configure:
   - **Root Directory**: `Tom/backend`
   - Build Command: (deixe automático)
   - Start Command: `npm start`

6. Adicione as Variáveis de Ambiente:
   ```
   DATABASE_URL=postgresql://...
   REDIS_URL=redis://...
   JWT_SECRET=...
   JWT_REFRESH_SECRET=...
   PORT=3000
   NODE_ENV=production
   CORS_ORIGIN=https://seu-frontend.railway.app
   ```

7. Deploy! ✅

8. Copie a URL do backend: `https://seu-backend.railway.app`

---

### 2️⃣ Deploy do FRONTEND:

1. No Railway, clique em "New Project" novamente
2. Escolha o mesmo repositório
3. **IMPORTANTE**: Configure:
   - **Root Directory**: `Tom/frontend`
   - Build Command: (deixe automático)
   - Start Command: `npm start`

4. Adicione as Variáveis de Ambiente:
   ```
   VITE_API_URL=https://seu-backend.railway.app
   VITE_WS_URL=wss://seu-backend.railway.app
   ```

5. Deploy! ✅

---

## ✅ Pronto!

Agora você tem 2 serviços no Railway:
- Backend: `https://seu-backend.railway.app`
- Frontend: `https://seu-frontend.railway.app`

## 🔧 Variáveis de Ambiente Completas

