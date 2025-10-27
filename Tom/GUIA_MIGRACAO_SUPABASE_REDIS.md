# 🚀 Guia de Migração: Docker Local → Supabase + Redis Cloud

Este guia explica como migrar seu banco de dados PostgreSQL e Redis do Docker local para Supabase e Redis Cloud.

## 📋 Pré-requisitos

- Conta no [Supabase](https://supabase.com/) (gratuita)
- Conta no [Redis Cloud](https://redis.com/try-free/) (gratuita)
- Node.js instalado
- Prisma CLI instalado (`npm install -g prisma`)

---

## 1️⃣ Configurar Supabase (PostgreSQL)

### 1.1 Criar Projeto no Supabase

1. Acesse [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Clique em **"New Project"**
3. Preencha:
   - **Name**: `whatsapp-system` (ou nome de sua preferência)
   - **Database Password**: Crie uma senha forte e **guarde-a**
   - **Region**: Escolha a região mais próxima (ex: South America)
4. Clique em **"Create new project"** e aguarde ~2 minutos

### 1.2 Obter Connection String

1. No dashboard do projeto, vá em **Settings** → **Database**
2. Role até **Connection string** → **URI**
3. Copie a string que começa com `postgresql://postgres:[YOUR-PASSWORD]@...`
4. **Substitua** `[YOUR-PASSWORD]` pela senha que você criou

Exemplo:
```
postgresql://postgres:SuaSenhaForte123@db.abcdefghijk.supabase.co:5432/postgres
```

### 1.3 Aplicar Schema no Supabase

No terminal, dentro da pasta `backend`:

```bash
# 1. Atualizar o .env com a connection string do Supabase
# Edite o arquivo backend/.env e substitua DATABASE_URL

# 2. Gerar o Prisma Client
npx prisma generate

# 3. Aplicar todas as migrations
npx prisma migrate deploy

# 4. (Opcional) Visualizar o banco no Prisma Studio
npx prisma studio
```

---

## 2️⃣ Configurar Redis Cloud

### 2.1 Criar Database no Redis Cloud

1. Acesse [https://app.redislabs.com/](https://app.redislabs.com/)
2. Faça login ou crie uma conta
3. Clique em **"New Database"**
4. Preencha:
   - **Subscription**: Selecione o plano gratuito (30MB)
   - **Cloud Provider**: AWS, GCP ou Azure
   - **Region**: Escolha a região mais próxima
   - **Database Name**: `whatsapp-redis`
5. Clique em **"Activate"**

### 2.2 Obter Credenciais

1. Após criar, clique no database criado
2. Na aba **Configuration**, copie:
   - **Endpoint**: `redis-12345.c123.us-east-1-1.ec2.cloud.redislabs.com:12345`
   - **Password**: Clique em "Show" e copie a senha

### 2.3 Formato da Connection String

Monte sua `REDIS_URL` no formato:
```
redis://default:[PASSWORD]@[ENDPOINT]
```

Exemplo:
```
redis://default:SuaSenhaRedis123@redis-12345.c123.us-east-1-1.ec2.cloud.redislabs.com:12345
```

---

## 3️⃣ Atualizar Variáveis de Ambiente

### 3.1 Editar `backend/.env`

Substitua as variáveis de banco de dados:

```env
# ==================== DATABASE ====================
# ANTES (Docker local):
# DATABASE_URL="postgresql://postgres:postgres@localhost:5433/whatsapp_system"

# DEPOIS (Supabase):
DATABASE_URL="postgresql://postgres:SuaSenhaSupabase@db.abcdefghijk.supabase.co:5432/postgres"

# ==================== REDIS ====================
# ANTES (Docker local):
# REDIS_URL="redis://:redis_password@localhost:6380"
# REDIS_PASSWORD="redis_password"

# DEPOIS (Redis Cloud):
REDIS_URL="redis://default:SuaSenhaRedis@redis-12345.c123.us-east-1-1.ec2.cloud.redislabs.com:12345"
REDIS_PASSWORD="SuaSenhaRedis"

# Queue Redis (mesmo endpoint)
QUEUE_REDIS_HOST="redis-12345.c123.us-east-1-1.ec2.cloud.redislabs.com"
QUEUE_REDIS_PORT=12345
QUEUE_REDIS_PASSWORD="SuaSenhaRedis"
```

### 3.2 Atualizar Frontend (se necessário)

Se o frontend faz conexões diretas ao banco (não recomendado), atualize também o `.env` do frontend.

---

## 4️⃣ Testar a Conexão

### 4.1 Testar PostgreSQL (Supabase)

```bash
cd backend
npx prisma db pull
```

Se funcionar, você verá: `✔ Introspected 30 models and wrote them into prisma/schema.prisma`

### 4.2 Testar Redis Cloud

Crie um arquivo de teste `test-redis.js`:

```javascript
const Redis = require('ioredis');

const redis = new Redis('redis://default:SuaSenhaRedis@seu-endpoint:porta');

redis.ping((err, result) => {
  if (err) {
    console.error('❌ Erro:', err);
  } else {
    console.log('✅ Redis conectado:', result);
  }
  redis.quit();
});
```

Execute:
```bash
node test-redis.js
```

---

## 5️⃣ Iniciar a Aplicação

### 5.1 Parar Docker (se estiver rodando)

```bash
cd Tom
docker-compose down
```

### 5.2 Iniciar Backend

```bash
cd backend
npm install
npm run dev
```

### 5.3 Iniciar Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 6️⃣ Criar Usuário Admin

Execute o script para criar o primeiro usuário admin:

```bash
cd backend
npx ts-node criar-admin.ts
```

Ou execute o SQL manualmente no Supabase:

1. Vá em **SQL Editor** no dashboard do Supabase
2. Cole o conteúdo de `backend/CRIAR_ADMIN.sql`
3. Clique em **Run**

---

## 🔒 Segurança

### ✅ Boas Práticas

1. **Nunca commite** o arquivo `.env` no Git
2. Use **senhas fortes** (mínimo 16 caracteres)
3. Ative **2FA** no Supabase e Redis Cloud
4. No Supabase, configure **Row Level Security (RLS)** se necessário
5. Monitore o uso no dashboard de ambos os serviços

### 🔐 Rotação de Senhas

Para trocar as senhas:

**Supabase:**
1. Settings → Database → Reset Database Password
2. Atualize `DATABASE_URL` no `.env`
3. Reinicie o backend

**Redis Cloud:**
1. Configuration → Security → Reset Password
2. Atualize `REDIS_URL` e `REDIS_PASSWORD` no `.env`
3. Reinicie o backend

---

## 📊 Monitoramento

### Supabase
- **Dashboard**: [https://supabase.com/dashboard](https://supabase.com/dashboard)
- Monitore: Queries, Storage, API Requests
- Logs: Database → Logs

### Redis Cloud
- **Dashboard**: [https://app.redislabs.com/](https://app.redislabs.com/)
- Monitore: Memory Usage, Operations/sec, Latency
- Alertas: Configure em Settings → Alerts

---

## 🆘 Troubleshooting

### Erro: "Connection refused"

**Causa**: Firewall ou IP bloqueado

**Solução Supabase:**
1. Settings → Database → Connection Pooling
2. Verifique se "Allow connections from any IP" está habilitado

**Solução Redis Cloud:**
1. Configuration → Security
2. Adicione seu IP em "Allowed IPs" ou use `0.0.0.0/0` (desenvolvimento)

### Erro: "SSL connection required"

**Causa**: Supabase requer SSL

**Solução**: Adicione `?sslmode=require` na connection string:
```
postgresql://postgres:senha@host:5432/postgres?sslmode=require
```

### Erro: "Too many connections"

**Causa**: Limite de conexões atingido

**Solução Supabase (plano gratuito = 60 conexões):**
1. Use Connection Pooling
2. Adicione `?pgbouncer=true` na connection string

**Solução Redis Cloud (plano gratuito = 30 conexões):**
1. Implemente connection pooling no código
2. Feche conexões não utilizadas

---

## 💰 Limites dos Planos Gratuitos

### Supabase Free Tier
- ✅ 500MB de banco de dados
- ✅ 1GB de armazenamento de arquivos
- ✅ 2GB de transferência de dados/mês
- ✅ 50.000 usuários autenticados
- ⚠️ Projeto pausa após 1 semana de inatividade

### Redis Cloud Free Tier
- ✅ 30MB de memória
- ✅ 30 conexões simultâneas
- ✅ Sem limite de operações
- ⚠️ Sem persistência em disco (apenas RAM)

---

## 🎯 Próximos Passos

1. ✅ Migração concluída
2. 🔄 Configure backups automáticos no Supabase
3. 📈 Monitore o uso para não exceder limites
4. 🚀 Considere upgrade para planos pagos se necessário

---

## 📚 Recursos Úteis

- [Documentação Supabase](https://supabase.com/docs)
- [Documentação Redis Cloud](https://docs.redis.com/latest/rc/)
- [Prisma com Supabase](https://supabase.com/docs/guides/integrations/prisma)
- [ioredis Documentation](https://github.com/redis/ioredis)

---

## ❓ Dúvidas?

Se encontrar problemas:
1. Verifique os logs do backend: `backend/logs/`
2. Teste conexões individualmente (Supabase e Redis)
3. Consulte a documentação oficial
4. Verifique se as credenciais estão corretas no `.env`
