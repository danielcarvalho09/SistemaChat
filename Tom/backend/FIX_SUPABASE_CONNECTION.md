# 🔧 Fix: Erro de Conexão Supabase

## ❌ Problema:

```
Can't reach database server at `aws-1-us-east-2.pooler.supabase.com:5432`
```

## 🎯 Causa:

Você estava usando **Session Pooler** (porta 5432) que tem limitações e pode dar timeout.

## ✅ Solução:

Use a **Conexão Direta** (mais estável) ou **Transaction Pooler** (porta 6543).

---

## 🔄 O que foi alterado:

### Antes (Session Pooler - problemático):
```
DATABASE_URL="postgresql://postgres.krrzypdydjoyiueyuuzh:Dcarv09!@aws-1-us-east-2.pooler.supabase.com:5432/postgres"
```

### Depois (Conexão Direta - estável):
```
DATABASE_URL="postgresql://postgres.krrzypdydjoyiueyuuzh:Dcarv09!@db.krrzypdydjoyiueyuuzh.supabase.co:5432/postgres"
```

---

## 📋 Diferenças:

| Tipo | URL | Porta | Uso |
|------|-----|-------|-----|
| **Conexão Direta** | `db.[PROJECT].supabase.co` | 5432 | ✅ Melhor para apps |
| **Transaction Pooler** | `aws-X.pooler.supabase.com` | 6543 | ✅ Serverless |
| **Session Pooler** | `aws-X.pooler.supabase.com` | 5432 | ❌ Limitado |

---

## 🚀 Como Obter a URL Correta:

### No Supabase Dashboard:

1. Vá em **Project Settings** (⚙️)
2. Clique em **Database**
3. Role até **Connection String**
4. Escolha **URI** (não Pooler)
5. Copie a URL que começa com `postgresql://postgres.[PROJECT_REF]...`

### Formato da Conexão Direta:
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
```

**Exemplo:**
```
postgresql://postgres.krrzypdydjoyiueyuuzh:SUA_SENHA@db.krrzypdydjoyiueyuuzh.supabase.co:5432/postgres
```

---

## 🔐 Encontrar sua Senha:

Se esqueceu a senha:

1. Vá em **Project Settings** > **Database**
2. Clique em **Reset database password**
3. Copie a nova senha
4. Atualize no `.env`

---

## ⚡ Alternativa: Transaction Pooler

Se preferir usar pooler (para serverless):

```env
DATABASE_URL="postgresql://postgres.krrzypdydjoyiueyuuzh:Dcarv09!@aws-0-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

**Atenção:** Porta **6543** (não 5432)

---

## 🔄 Reiniciar Backend:

```bash
# O backend deve reiniciar automaticamente (watch mode)
# Se não reiniciar, faça:
pkill -f "tsx watch"
npm run dev
```

---

## ✅ Testar Conexão:

```bash
# Teste a conexão:
node test-connections.js

# Deve mostrar:
# ✅ Conectado com sucesso em: Supabase (Cloud)
```

---

## 🎯 Resumo:

- ❌ **Session Pooler** (porta 5432) → Problemático
- ✅ **Conexão Direta** (db.*.supabase.co:5432) → Recomendado
- ✅ **Transaction Pooler** (porta 6543) → Para serverless

**Já foi atualizado no `.env`! Reinicie o backend.** 🚀
