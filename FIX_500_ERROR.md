# 🔧 Fix Erro 500 - Conversas

## ❌ ERRO ATUAL

```
Failed to load resource: the server responded with a status of 500 ()
GET /v1/conversations
```

## 🔍 CAUSA PROVÁVEL

O Prisma Client no servidor **NÃO foi regenerado** após adicionar os novos campos:
- `pushName` no modelo Contact
- `aiEnabled` e `aiAssistantId` no modelo WhatsAppConnection

O código está tentando acessar campos que não existem no Prisma Client atual.

---

## ✅ SOLUÇÃO COMPLETA

### Passo 1: Executar Migration no Railway

```bash
# Conectar ao Railway
railway link

# Executar migration
railway run npx prisma migrate deploy
```

**OU** manualmente no Railway Dashboard:
```bash
# Settings → Variables → Add Variable
DATABASE_URL=postgresql://...

# Depois executar:
npx prisma migrate deploy
```

---

### Passo 2: Gerar Prisma Client no Deploy

O Railway precisa gerar o Prisma Client durante o build.

**Verificar `package.json`:**

```json
{
  "scripts": {
    "postinstall": "prisma generate",
    "build": "tsc",
    "start": "node dist/server.js"
  }
}
```

Se não tiver `postinstall`, adicionar!

---

### Passo 3: Forçar Rebuild

```bash
# Limpar e forçar novo deploy
git commit --allow-empty -m "chore: regenerate prisma client"
git push
```

---

## 🚀 SOLUÇÃO RÁPIDA (Railway CLI)

```bash
# 1. Conectar ao projeto
railway link

# 2. Executar migration
railway run npx prisma migrate deploy

# 3. Reiniciar serviço
railway restart

# 4. Ver logs
railway logs
```

---

## 📊 VERIFICAR SE MIGRATION FOI APLICADA

### No Railway Shell:

```bash
railway run npx prisma db pull
```

Deve mostrar os novos campos:
- Contact.pushName
- WhatsAppConnection.aiEnabled
- WhatsAppConnection.aiAssistantId
- AIAssistant (nova tabela)

---

## 🔍 VERIFICAR LOGS DO ERRO

### Railway Dashboard:
```
Deployments → [Último Deploy] → View Logs
```

Procurar por:
- `Property 'pushName' does not exist`
- `Property 'aiEnabled' does not exist`
- `Property 'aIAssistant' does not exist`

---

## 📝 CRIAR MIGRATION (Se Ainda Não Criou)

### Localmente:

```bash
cd Tom/backend

# Criar migration
npx prisma migrate dev --name add_ai_and_pushname

# Isso cria:
# - Migration SQL
# - Gera Prisma Client
# - Aplica no banco local
```

### Commitar Migration:

```bash
git add prisma/migrations
git commit -m "feat: add AI assistant and pushName fields"
git push
```

---

## ⚙️ CONFIGURAÇÃO NECESSÁRIA

### 1. Adicionar Variável de Ambiente

No Railway Dashboard:
```
Settings → Variables → Add Variable

AI_ENCRYPTION_KEY=your-32-char-secret-key-here!!!
```

### 2. Verificar DATABASE_URL

```
Settings → Variables

DATABASE_URL=postgresql://...
```

Deve estar configurado corretamente.

---

## 🧪 TESTAR LOCALMENTE

Antes de fazer deploy, testar localmente:

```bash
cd Tom/backend

# 1. Gerar Prisma Client
npx prisma generate

# 2. Build
npm run build

# 3. Iniciar servidor
npm start

# 4. Testar endpoint
curl http://localhost:3333/api/v1/conversations \
  -H "Authorization: Bearer SEU_TOKEN"
```

Deve retornar 200, não 500.

---

## 🔧 SCRIPT DE FIX AUTOMÁTICO

**Criar:** `Tom/backend/fix-deploy.sh`

```bash
#!/bin/bash

echo "🔧 Fixing deployment..."

# 1. Gerar Prisma Client
echo "📦 Generating Prisma Client..."
npx prisma generate

# 2. Build
echo "🏗️  Building..."
npm run build

# 3. Verificar se build passou
if [ $? -eq 0 ]; then
  echo "✅ Build successful!"
  
  # 4. Commit e push
  echo "🚀 Deploying..."
  git add .
  git commit -m "fix: regenerate prisma client with new fields"
  git push
  
  echo "✅ Deploy initiated!"
else
  echo "❌ Build failed!"
  exit 1
fi
```

**Executar:**
```bash
chmod +x Tom/backend/fix-deploy.sh
./Tom/backend/fix-deploy.sh
```

---

## 📋 CHECKLIST DE VERIFICAÇÃO

Antes de fazer deploy, verificar:

- [ ] Migration criada localmente (`prisma/migrations/`)
- [ ] `postinstall: "prisma generate"` no `package.json`
- [ ] Build local funciona (`npm run build`)
- [ ] Prisma Client gerado (`node_modules/.prisma/client`)
- [ ] Variável `AI_ENCRYPTION_KEY` configurada no Railway
- [ ] Migration commitada no git

---

## 🎯 AÇÃO IMEDIATA

**Execute na ordem:**

```bash
# 1. Verificar package.json tem postinstall
cat Tom/backend/package.json | grep postinstall

# 2. Se não tiver, adicionar:
# "postinstall": "prisma generate"

# 3. Criar migration
cd Tom/backend
npx prisma migrate dev --name add_ai_and_pushname

# 4. Commit tudo
git add .
git commit -m "feat: add AI system and pushName with migration"
git push

# 5. No Railway, executar migration
railway run npx prisma migrate deploy

# 6. Reiniciar
railway restart
```

---

## 🆘 SE AINDA DER ERRO 500

### Verificar Logs Detalhados:

```bash
railway logs --tail 100
```

Procurar por:
- Stack trace do erro
- Mensagem de erro específica
- Linha do código que falhou

### Rollback Temporário (Última Opção):

Se precisar voltar o sistema funcionando:

```bash
# Reverter último commit
git revert HEAD
git push

# Sistema volta ao estado anterior
```

Depois investigar o erro com calma.

---

## 📞 SUPORTE

Se o erro persistir:
1. Copiar logs completos do Railway
2. Verificar se migration foi aplicada no banco
3. Verificar se Prisma Client foi gerado no build
4. Verificar variáveis de ambiente

---

**Na maioria dos casos, executar `railway run npx prisma migrate deploy` resolve! 🚀**
