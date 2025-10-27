# 🚀 Sistema de Chat WhatsApp

Monorepo com Backend (Node.js) e Frontend (React/Vite)

## 📦 Estrutura

```
/
├── Tom/
│   ├── backend/    # API Node.js + Prisma
│   └── frontend/   # React + Vite
├── railway.toml    # Configuração Railway
└── package.json    # Monorepo config
```

## 🚂 Deploy no Railway

Este projeto está configurado para deploy automático no Railway!

### Opção 1: Deploy Direto (Recomendado)

1. Conecte seu GitHub ao Railway
2. New Project → Deploy from GitHub
3. Selecione este repositório
4. Railway vai detectar automaticamente 2 serviços:
   - `backend` (Tom/backend)
   - `frontend` (Tom/frontend)
5. Configure as variáveis de ambiente (ver abaixo)

### Opção 2: CLI

```bash
railway login
railway init
railway up
```

## 🔧 Variáveis de Ambiente

### Backend

Copie de `Tom/backend/.env.railway`:

```env
DATABASE_URL=...
REDIS_URL=...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
PORT=3000
NODE_ENV=production
```

### Frontend

```env
VITE_API_URL=https://seu-backend.railway.app
VITE_WS_URL=wss://seu-backend.railway.app
```

## ✅ Pronto!

Railway vai fazer build e deploy automaticamente! 🎉
