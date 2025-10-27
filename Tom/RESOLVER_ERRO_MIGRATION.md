# ❌ Resolvendo o Erro: "relation roles does not exist"

## 🔍 O que aconteceu?

Você tentou executar o script SQL `setup-supabase.sql` **antes** de criar as tabelas no banco.

O script SQL tenta inserir dados na tabela `roles`, mas ela ainda não existe!

## ✅ Solução: Use o Prisma Migrate

O Prisma cria **automaticamente** todas as tabelas. Não precisa executar SQL manualmente.

---

## 📋 Passo a Passo Correto

### 1️⃣ Configurar Credenciais

Edite o arquivo `backend/.env` e substitua os placeholders:

```bash
# SUPABASE
DATABASE_URL="postgresql://postgres:SUA_SENHA@db.SEU_PROJECT.supabase.co:5432/postgres"

# REDIS CLOUD  
REDIS_URL="redis://default:SUA_SENHA@SEU_ENDPOINT.cloud.redislabs.com:PORTA"
REDIS_PASSWORD="SUA_SENHA_REDIS"

QUEUE_REDIS_HOST="SEU_ENDPOINT.cloud.redislabs.com"
QUEUE_REDIS_PORT=PORTA
QUEUE_REDIS_PASSWORD="SUA_SENHA_REDIS"
```

#### Como obter as credenciais:

**Supabase:**
1. Dashboard → Settings → Database
2. Copie "Connection string" (URI format)
3. A senha já vem incluída na string

**Redis Cloud:**
1. Dashboard → Database → Configuration
2. Copie "Endpoint" e "Password"
3. Formato: `redis://default:PASSWORD@endpoint:porta`

### 2️⃣ Aplicar Migrations (Cria as Tabelas)

```bash
cd backend

# Gerar Prisma Client
npx prisma generate

# Aplicar TODAS as migrations (cria as tabelas automaticamente)
npx prisma migrate deploy
```

**O que isso faz:**
- ✅ Cria TODAS as tabelas no Supabase
- ✅ Aplica todas as migrations em ordem
- ✅ Configura índices e relações

### 3️⃣ Verificar se Funcionou

```bash
# Ver as tabelas criadas
npx prisma studio
```

Ou no Supabase:
- Dashboard → Table Editor → Você verá todas as tabelas criadas

### 4️⃣ (Opcional) Criar Dados Iniciais

**Opção A - Via Prisma Studio:**
1. Abra: `npx prisma studio`
2. Crie usuários, roles, etc. pela interface

**Opção B - Via SQL no Supabase:**
1. Dashboard → SQL Editor
2. Cole **APENAS A PARTE DE INSERÇÃO** do `setup-supabase.sql`:

```sql
-- Inserir roles
INSERT INTO roles (id, name, description, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'admin', 'Administrador do sistema', NOW(), NOW()),
  (gen_random_uuid(), 'user', 'Usuário padrão', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Inserir usuário admin (senha: Admin@123)
INSERT INTO users (id, email, password, name, status, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'admin@sistema.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5eoWy.Hlsu7su',
  'Administrador',
  'online',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;
```

**Opção C - Via Script TypeScript:**
```bash
npx ts-node criar-admin.ts
```

---

## 🧪 Testar Conexões

```bash
# Testar se tudo está funcionando
node test-connections.js
```

Você deve ver:
```
✅ Supabase (Cloud) disponível
✅ Redis Cloud disponível
🎉 Todas as conexões estão funcionando!
```

---

## 🚀 Iniciar o Sistema

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

---

## 🔄 Sistema de Fallback

O sistema agora tenta automaticamente:

1. **Primeira tentativa**: Supabase + Redis Cloud
2. **Se falhar**: Docker local (automático)

Você **NÃO precisa** escolher manualmente. O sistema detecta qual está disponível.

Para **desabilitar** o fallback (modo produção):
```bash
# Adicione no .env:
USE_SIMPLE_FALLBACK=false
```

---

## 📊 Resumo: O que NÃO fazer

❌ **NÃO** execute o `setup-supabase.sql` completo no SQL Editor  
❌ **NÃO** crie as tabelas manualmente  
❌ **NÃO** use `prisma db push` (use `migrate deploy`)

✅ **USE** apenas: `npx prisma migrate deploy`  
✅ Deixe o Prisma gerenciar o schema automaticamente

---

## 🆘 Problemas Comuns

### "SSL connection required"
Adicione `?sslmode=require` na DATABASE_URL:
```
DATABASE_URL="postgresql://...?sslmode=require"
```

### "Connection timeout"
Verifique firewall do Supabase:
- Settings → Database → Connection Pooling
- Habilite "Allow connections from any IP"

### "WRONGPASS" no Redis
Verifique se a senha está correta no REDIS_URL

---

## 📚 Estrutura Criada Automaticamente

Após `prisma migrate deploy`, você terá:

- 📊 **30+ tabelas** criadas
- 🔐 Sistema de autenticação
- 💬 Conversas e mensagens
- 👥 Usuários e departamentos
- 🏷️ Tags e templates
- 📡 Broadcast e listas
- 📋 Kanban de atendimento
- 🔔 Notificações
- 📈 Métricas e logs

Tudo pronto para usar! 🎉
