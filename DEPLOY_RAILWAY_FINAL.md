# 🚂 Deploy Railway - Instruções Finais

## ✅ SOLUÇÃO: 2 serviços NO MESMO projeto

---

## 📋 Passo a Passo COMPLETO:

### 1️⃣ **Criar Projeto no Railway**

1. Acesse: https://railway.app
2. Clique em **"New Project"**
3. Escolha **"Empty Project"**
4. Dê um nome: **"SistemaChat"**

---

### 2️⃣ **Adicionar Backend (Primeiro!)**

1. No projeto, clique em **"+ New"**
2. Escolha **"GitHub Repo"**
3. Selecione seu repositório
4. **IMPORTANTE:**
   - Name: `backend`
   - Root Directory: `Tom/backend`
   - Start Command: `npm start`

5. **Não adicione variáveis!** Elas já estão no `.env.production`

6. Clique em **"Deploy"**

7. ⏰ **Aguarde o backend deployar** (1-2 minutos)

8. Copie a URL que aparecer: `https://backend-production-xxx.up.railway.app`

---

### 3️⃣ **Atualizar URL do Backend no Código**

Volte no terminal e execute:

```bash
cd /Users/carvalhost/Documents/GitHub/SistemaChat/Tom/frontend

# Edite .env.production e substitua pelas URLs reais:
nano .env.production
```

Cole isso (com a URL real do seu backend):

```env
VITE_API_URL=https://SEU-BACKEND-XXX.up.railway.app
VITE_WS_URL=wss://SEU-BACKEND-XXX.up.railway.app
```

Salve: `Ctrl+O`, `Enter`, `Ctrl+X`

Commit:
```bash
cd /Users/carvalhost/Documents/GitHub/SistemaChat
git add .
git commit -m "Update frontend env with backend URL"
git push
```

---

### 4️⃣ **Adicionar Frontend**

1. No MESMO projeto Railway, clique em **"+ New"** novamente
2. Escolha **"GitHub Repo"**
3. Selecione o MESMO repositório
4. **IMPORTANTE:**
   - Name: `frontend`
   - Root Directory: `Tom/frontend`
   - Start Command: `npm start`

5. **Não adicione variáveis!** Elas já estão no arquivo.

6. Clique em **"Deploy"**

---

### 5️⃣ **Configurar CORS no Backend**

1. No Railway, vá no serviço **backend**
2. Clique em **Variables**
3. **Edite** a variável `CORS_ORIGIN`:
   ```
   CORS_ORIGIN=https://SEU-FRONTEND-XXX.up.railway.app
   ```
4. Salve (backend vai reiniciar automaticamente)

---

## ✅ PRONTO!

Agora você tem:
- Backend: `https://backend-production-xxx.up.railway.app`
- Frontend: `https://frontend-production-xxx.up.railway.app`

Ambos no MESMO projeto Railway, comunicando perfeitamente! 🎉

---

## 🔧 Se der erro:

### Backend não inicia:
1. Vá em Deployments → Logs
2. Procure por erros do Prisma
3. Solução: No Railway, vá em Variables e adicione:
   ```
   DATABASE_URL=sua-url-do-supabase
   ```

### Frontend não conecta:
1. Verifique se a URL do backend está correta no `.env.production`
2. Verifique se o CORS está configurado com a URL do frontend
3. Abra o Console do navegador (F12) e veja os erros

---

## 🎯 Resumo dos Comandos:

```bash
# 1. Criar backend no Railway (interface web)
# 2. Copiar URL do backend
# 3. Atualizar frontend:

cd /Users/carvalhost/Documents/GitHub/SistemaChat/Tom/frontend
nano .env.production
# Cole a URL real do backend

cd ../..
git add .
git commit -m "Update frontend with backend URL"
git push

# 4. Criar frontend no Railway (interface web)
# 5. Atualizar CORS no backend (interface web)
```

**Pronto!** 🚀
