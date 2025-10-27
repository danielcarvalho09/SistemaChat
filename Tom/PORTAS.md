# 🔌 Configuração de Portas do Sistema

## Portas Utilizadas

### **Serviços Externos (Seus)**
- `5678` - n8n
- `8080` - Evolution API
- `5432` - PostgreSQL (seu)
- `6379` - Redis (seu)

### **Sistema WhatsApp Multi-Tenant**

#### Desenvolvimento Local
- `3000` - Backend API (Fastify)
- `5173` - Frontend Dev Server (Vite)
- `5433` - PostgreSQL (WhatsApp System) ⚠️ **Porta ajustada para evitar conflito**
- `6380` - Redis (WhatsApp System) ⚠️ **Porta ajustada para evitar conflito**

#### Produção (Docker)
- `80` - Nginx (Frontend)
- `443` - Nginx SSL (Frontend)
- `3000` - Backend API
- `5433` - PostgreSQL (mapeado internamente)
- `6380` - Redis (mapeado internamente)

## 📝 Strings de Conexão

### Desenvolvimento Local

**Backend (.env):**
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/whatsapp_system"
REDIS_URL="redis://localhost:6380"
PORT=3000
```

**Frontend (.env):**
```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=http://localhost:3000
```

### Docker Compose

**Interno (containers se comunicam):**
- PostgreSQL: `postgres:5432` (porta interna)
- Redis: `redis:6379` (porta interna)
- Backend: `backend:3000`

**Externo (acesso do host):**
- PostgreSQL: `localhost:5433`
- Redis: `localhost:6380`
- Backend: `localhost:3000`
- Frontend: `localhost:5173` (dev) ou `localhost:80` (prod)

## 🚀 Como Usar

### Opção 1: Usar seus serviços existentes

Se você quiser usar seu PostgreSQL e Redis existentes (portas 5432 e 6379):

```env
# backend/.env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/whatsapp_system"
REDIS_URL="redis://localhost:6379"
```

**Não execute** `docker-compose up postgres redis`

### Opção 2: Usar serviços isolados (Recomendado)

Use as portas ajustadas (5433 e 6380) para manter os serviços isolados:

```bash
# Iniciar apenas os serviços do WhatsApp System
docker-compose up -d postgres redis
```

```env
# backend/.env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/whatsapp_system"
REDIS_URL="redis://localhost:6380"
```

## ⚠️ Importante

1. **Isolamento:** Recomendo usar portas diferentes (5433/6380) para manter os dados isolados
2. **Backup:** Seus dados do Evolution API não serão afetados
3. **Performance:** Cada serviço terá sua própria instância de banco

## 🔧 Comandos Úteis

```bash
# Ver portas em uso no Windows
netstat -ano | findstr :5433
netstat -ano | findstr :6380
netstat -ano | findstr :3000

# Conectar ao PostgreSQL do WhatsApp System
psql -h localhost -p 5433 -U postgres -d whatsapp_system

# Conectar ao Redis do WhatsApp System
redis-cli -h localhost -p 6380
```

## 📊 Resumo de Mudanças

| Serviço | Porta Original | Nova Porta | Motivo |
|---------|---------------|------------|---------|
| PostgreSQL | 5432 | **5433** | Conflito com seu PostgreSQL |
| Redis | 6379 | **6380** | Conflito com seu Redis |
| Backend | 3000 | 3000 | ✅ Sem conflito |
| Frontend | 5173 | 5173 | ✅ Sem conflito |

---

**Status:** ✅ Todas as portas ajustadas e sem conflitos!
