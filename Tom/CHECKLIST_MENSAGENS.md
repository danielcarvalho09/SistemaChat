# ✅ Checklist - Mensagens não aparecem

## 🔍 **VERIFICAÇÕES RÁPIDAS**

### 1. Backend está rodando?
```bash
# Deve estar rodando na porta 3000
# Verifique se não tem erros no terminal
```
- [ ] Backend rodando sem erros
- [ ] Porta 3000 acessível

### 2. Frontend está rodando?
```bash
# Deve estar rodando na porta 5173
# Verifique se não tem erros no console (F12)
```
- [ ] Frontend rodando sem erros
- [ ] Porta 5173 acessível

### 3. WhatsApp está conectado?
```
Acesse: http://localhost:5173/admin/connections
```
- [ ] Status: **"connected"** (verde)
- [ ] Não tem mensagem de erro
- [ ] QR Code foi escaneado

### 4. Socket.IO está conectado?
```javascript
// Abra o console do navegador (F12) e digite:
console.log('Socket:', socket?.connected);
```
- [ ] Deve retornar: `true`

---

## 🧪 **TESTE PASSO A PASSO**

### Passo 1: Verificar Logs do Backend
1. Abra o terminal do backend
2. Procure por logs como:
   ```
   [Baileys] 📨 Message update received - Type: notify, Count: 1
   [Baileys] 📱 Processing message from 5511999999999@s.whatsapp.net
   [Baileys] ✅ New text from ...
   [Baileys] 💾 Message saved successfully
   ```

**Se NÃO aparecer nenhum log:**
- ❌ Mensagem não está chegando no backend
- Reconecte o WhatsApp

**Se aparecer log mas com erro:**
- ❌ Erro ao processar/salvar
- Me envie o erro completo

### Passo 2: Verificar Banco de Dados
```bash
cd backend
npx prisma studio
```
1. Abra a tabela **"messages"**
2. Verifique se a mensagem foi salva
3. Anote o `conversationId`

**Se mensagem NÃO está no banco:**
- ❌ Erro ao salvar
- Verificar logs de erro

**Se mensagem ESTÁ no banco:**
- ✅ Backend funcionando
- ❌ Problema no frontend

### Passo 3: Verificar Frontend
Abra o console do navegador (F12) e procure por:
```
Socket.IO event: new_message
Socket.IO event: conversation_updated
```

**Se NÃO aparecer eventos:**
- ❌ Socket.IO não está emitindo
- Verificar backend

**Se aparecer eventos:**
- ✅ Socket.IO funcionando
- ❌ Frontend não está atualizando

---

## 🐛 **PROBLEMAS COMUNS**

### Problema 1: Mensagem não chega no backend
**Sintomas:**
- Nenhum log no terminal
- Mensagem não aparece no Prisma Studio

**Causas possíveis:**
1. WhatsApp desconectado
2. Evento `messages.upsert` não está sendo disparado
3. Número errado (enviando para si mesmo)

**Soluções:**
```bash
# 1. Reconectar WhatsApp
Acesse: /admin/connections
Clique em "Desconectar" e depois "Conectar"
Escaneie o QR Code novamente

# 2. Reiniciar backend
Ctrl+C no terminal
npm run dev

# 3. Verificar número
- Não envie mensagem para o próprio número conectado
- Use outro celular/chip para testar
```

### Problema 2: Mensagem chega mas não salva
**Sintomas:**
- Log aparece: `[Baileys] 📨 Message update received`
- Mas depois erro: `[Baileys] ❌ Error processing message`

**Causas possíveis:**
1. Erro no MessageService
2. Erro no banco de dados
3. Conexão não encontrada

**Soluções:**
```bash
# Verificar erro específico nos logs
# Me envie o erro completo para eu ajudar
```

### Problema 3: Mensagem salva mas não aparece no frontend
**Sintomas:**
- Mensagem está no banco (Prisma Studio)
- Não aparece na interface

**Causas possíveis:**
1. Socket.IO não está emitindo
2. Frontend não está escutando
3. Conversa está em filtro errado

**Soluções:**
```bash
# 1. Verificar Socket.IO
# No console do navegador (F12):
socket.on('new_message', (data) => console.log('Nova mensagem:', data));

# 2. Recarregar conversas manualmente
Clique no botão de recarregar (↻) na sidebar

# 3. Verificar filtro
Certifique-se que está em "Todas" ou no filtro correto
```

### Problema 4: Apenas mensagens enviadas aparecem
**Sintomas:**
- Mensagens que você envia aparecem
- Mensagens recebidas não aparecem

**Causas possíveis:**
1. Evento `messages.upsert` só captura novas mensagens
2. Mensagens antigas não são sincronizadas

**Soluções:**
```bash
# Normal! Apenas mensagens APÓS conectar aparecem
# Mensagens antigas não são sincronizadas automaticamente
```

---

## 🔧 **COMANDOS ÚTEIS**

### Ver logs do backend em tempo real
```bash
cd backend
npm run dev
# Observe os logs enquanto envia mensagem
```

### Verificar banco de dados
```bash
cd backend
npx prisma studio
# Abrir tabela "messages"
```

### Limpar cache do navegador
```
F12 → Application → Clear storage → Clear site data
F5 para recarregar
```

### Reconectar WhatsApp
```
1. /admin/connections
2. Desconectar
3. Conectar
4. Escanear QR Code
```

---

## 📊 **LOGS ESPERADOS (NORMAL)**

Quando você envia uma mensagem, deve ver:

```
[Baileys] 📨 Message update received - Type: notify, Count: 1
[Baileys] 📱 Processing message from 5511999999999@s.whatsapp.net, isFromMe: false
[Baileys] ✅ New text from 5511999999999@s.whatsapp.net: "Olá"
[Baileys] 💾 Message saved successfully
[info]: Socket.IO emitting: new_message
[info]: Socket.IO emitting: conversation_updated
```

---

## 🚨 **SE NADA FUNCIONAR**

### Último recurso: Reiniciar tudo
```bash
# 1. Parar backend (Ctrl+C)
# 2. Parar frontend (Ctrl+C)

# 3. Limpar e reiniciar backend
cd backend
npx prisma generate
npm run dev

# 4. Limpar e reiniciar frontend (novo terminal)
cd frontend
npm run dev

# 5. Reconectar WhatsApp
http://localhost:5173/admin/connections
```

---

## 📝 **INFORMAÇÕES PARA DEBUG**

Quando pedir ajuda, me envie:

1. **Logs do backend** (últimas 20 linhas)
2. **Erros do console** (F12 no navegador)
3. **Status da conexão** (connected/disconnected)
4. **Mensagem está no banco?** (Prisma Studio)
5. **Tipo de mensagem** (texto, imagem, etc)

---

## ✅ **TESTE FINAL**

1. [ ] Backend rodando sem erros
2. [ ] Frontend rodando sem erros
3. [ ] WhatsApp conectado (verde)
4. [ ] Socket.IO conectado (console)
5. [ ] Filtro em "Todas"
6. [ ] Enviar mensagem de teste
7. [ ] Ver logs do backend
8. [ ] Verificar se aparece na interface

**Se todos os passos estiverem OK e ainda não funcionar, me chame!** 🚀
