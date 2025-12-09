# 🔄 Guia de Migração para Nova Conta Supabase

Este guia lista todas as credenciais e configurações necessárias para migrar o projeto para uma nova conta do Supabase.

## 📋 Credenciais Necessárias

### 1. **DATABASE_URL** (OBRIGATÓRIO)
**Onde encontrar:**
- Acesse: `https://app.supabase.com/project/[SEU_PROJECT_ID]/settings/database`
- Role até "Connection string"
- Selecione "URI" ou "Connection pooling"
- Copie a string completa

**Formato:**
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Ou:**
```
postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
```

**Configuração:**
```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
```

---

### 2. **SUPABASE_URL** (OPCIONAL - mas recomendado)
**Onde encontrar:**
- Acesse: `https://app.supabase.com/project/[SEU_PROJECT_ID]/settings/api`
- Copie a "Project URL"

**Formato:**
```
https://[PROJECT_REF].supabase.co
```

**Configuração:**
```env
SUPABASE_URL=https://[PROJECT_REF].supabase.co
```

**Nota:** Se não configurar, o sistema tenta extrair automaticamente da `DATABASE_URL`, mas é melhor configurar manualmente.

---

### 3. **SUPABASE_SERVICE_ROLE_KEY** (OPCIONAL - para Storage)
**Onde encontrar:**
- Acesse: `https://app.supabase.com/project/[SEU_PROJECT_ID]/settings/api`
- Role até "Project API keys"
- Copie a chave "service_role" (⚠️ **NUNCA exponha esta chave no frontend!**)

**Configuração:**
```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Nota:** Necessária apenas se você usar Supabase Storage para upload de arquivos. Se não configurar, o sistema usa armazenamento local.

---

### 4. **SUPABASE_ANON_KEY** (OPCIONAL - alternativa ao SERVICE_ROLE_KEY)
**Onde encontrar:**
- Acesse: `https://app.supabase.com/project/[SEU_PROJECT_ID]/settings/api`
- Copie a chave "anon" ou "public"

**Configuração:**
```env
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Nota:** Pode ser usada como alternativa ao `SUPABASE_SERVICE_ROLE_KEY`, mas com permissões limitadas.

---

## 🔐 Outras Variáveis de Ambiente Necessárias

### Variáveis Obrigatórias:

```env
# JWT Secrets (gere novos para segurança)
JWT_SECRET=seu-jwt-secret-minimo-32-caracteres-aqui
JWT_REFRESH_SECRET=seu-jwt-refresh-secret-minimo-32-caracteres-aqui

# Encryption Key (64 caracteres hexadecimais = 32 bytes)
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

### Variáveis Opcionais (com valores padrão):

```env
# Server
NODE_ENV=production
PORT=3000
API_PREFIX=/api/v1

# JWT Expiration
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Redis (se usar)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000
CORS_ORIGIN=http://localhost:5173

# WhatsApp
WHATSAPP_SESSION_PATH=./whatsapp-sessions
MAX_CONNECTIONS=100
WHATSAPP_TIMEOUT=60000

# Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,video/mp4,application/pdf
```

---

## 📝 Passo a Passo da Migração

### 1. **Criar Novo Projeto no Supabase**
1. Acesse: https://app.supabase.com
2. Clique em "New Project"
3. Preencha:
   - **Name:** Nome do projeto
   - **Database Password:** Senha forte (anote bem!)
   - **Region:** Escolha a região mais próxima
4. Aguarde a criação (pode levar alguns minutos)

### 2. **Executar Script SQL**
1. No novo projeto, acesse: **SQL Editor**
2. Abra o arquivo: `Tom/backend/replicate-database-schema.sql`
3. Cole todo o conteúdo no editor
4. Execute o script
5. Verifique se todas as tabelas foram criadas

### 3. **Configurar Variáveis de Ambiente**

#### **Backend (.env)**
Crie/atualize o arquivo `Tom/backend/.env`:

```env
# ===== SUPABASE =====
DATABASE_URL=postgresql://postgres:[SENHA]@db.[PROJECT_REF].supabase.co:5432/postgres
SUPABASE_URL=https://[PROJECT_REF].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY]

# ===== JWT =====
JWT_SECRET=[GERE_UMA_CHAVE_ALEATORIA_DE_32_CARACTERES]
JWT_REFRESH_SECRET=[GERE_OUTRA_CHAVE_ALEATORIA_DE_32_CARACTERES]
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# ===== ENCRYPTION =====
ENCRYPTION_KEY=[64_CARACTERES_HEXADECIMAIS]

# ===== SERVER =====
NODE_ENV=production
PORT=3000
API_PREFIX=/api/v1

# ===== CORS =====
CORS_ORIGIN=https://seu-dominio.com,http://localhost:5173
```

#### **Frontend (.env)**
Se o frontend usar variáveis de ambiente, atualize `Tom/frontend/.env`:

```env
VITE_API_URL=https://sua-api.com/api/v1
# Outras variáveis do frontend...
```

### 4. **Executar Seed do Banco**
Execute o seed para criar roles, permissões e dados iniciais:

```bash
cd Tom/backend
npm run seed
# ou
node run-seed.js
```

### 5. **Criar Usuário Admin Inicial**
Execute o script para criar o primeiro usuário admin:

```bash
cd Tom/backend
npm run promote-admin [email-do-admin]
# ou
node src/scripts/promote-admin.ts [email-do-admin]
```

### 6. **Configurar Supabase Storage (Opcional)**
Se você usa upload de arquivos:

1. No Supabase, acesse: **Storage**
2. Crie um bucket chamado `whatsapp-media` (ou o nome configurado)
3. Configure as políticas de acesso:
   - **Public:** Se quiser acesso público
   - **Private:** Se quiser acesso restrito

### 7. **Testar Conexão**
1. Inicie o backend:
   ```bash
   cd Tom/backend
   npm run dev
   ```

2. Verifique os logs:
   - Deve aparecer: `✅ Database connected successfully (Supabase Cloud)`
   - Se configurou Storage: `✅ Supabase Storage client initialized`

---

## 🔍 Como Encontrar as Credenciais no Supabase

### **Project ID / Project Ref:**
- Acesse: `https://app.supabase.com/project/[PROJECT_ID]/settings/general`
- O "Reference ID" é o `[PROJECT_REF]` usado nas URLs

### **Database Password:**
- Foi definida na criação do projeto
- Se esqueceu, pode resetar em: `Settings > Database > Reset database password`

### **API Keys:**
- Acesse: `https://app.supabase.com/project/[PROJECT_ID]/settings/api`
- **anon/public key:** Chave pública (pode ser exposta no frontend)
- **service_role key:** Chave privada (⚠️ NUNCA exponha no frontend!)

---

## ⚠️ Importante

1. **NUNCA commite arquivos `.env` no Git!**
2. **NUNCA exponha `SUPABASE_SERVICE_ROLE_KEY` no frontend!**
3. **Gere novos `JWT_SECRET` e `ENCRYPTION_KEY` para cada ambiente!**
4. **Mantenha backups regulares do banco de dados!**

---

## 📦 Resumo das Credenciais Necessárias

| Credencial | Obrigatório | Onde Encontrar |
|------------|-------------|----------------|
| `DATABASE_URL` | ✅ SIM | Settings > Database > Connection string |
| `SUPABASE_URL` | ⚠️ Recomendado | Settings > API > Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ Se usar Storage | Settings > API > service_role key |
| `JWT_SECRET` | ✅ SIM | Gerar novo (32+ caracteres) |
| `JWT_REFRESH_SECRET` | ✅ SIM | Gerar novo (32+ caracteres) |
| `ENCRYPTION_KEY` | ✅ SIM | Gerar novo (64 hex chars) |

---

## 🚀 Após a Migração

1. ✅ Execute o script SQL
2. ✅ Configure as variáveis de ambiente
3. ✅ Execute o seed
4. ✅ Crie usuário admin
5. ✅ Teste a conexão
6. ✅ Configure Storage (se necessário)
7. ✅ Atualize URLs no frontend (se necessário)

---

## 💡 Dicas

- Use variáveis de ambiente diferentes para **desenvolvimento** e **produção**
- No **Railway** ou **Vercel**, configure as variáveis no painel do serviço
- Mantenha um backup do `.env` em local seguro (não no Git!)
- Use um gerenciador de secrets como **1Password** ou **LastPass**

