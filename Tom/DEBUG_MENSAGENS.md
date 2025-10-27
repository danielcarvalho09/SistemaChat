# 🔍 Debug - Mensagens não chegando

## 📋 Checklist de Verificação

### 1. **Verificar se a conexão está ativa**
```
✅ Status da conexão deve estar "connected" (verde)
✅ Não deve ter erros no console do backend
✅ QR Code foi escaneado com sucesso
```

### 2. **Logs adicionados para debug**

Agora o sistema tem logs detalhados. Ao enviar uma mensagem do WhatsApp, você deve ver:

```
[Baileys] 📨 Message update received - Type: notify, Count: 1
[Baileys] 📱 Processing message from 5511999999999@s.whatsapp.net, isFromMe: false
[Baileys] ✅ New text from 5511999999999@s.whatsapp.net: "Olá, tudo bem?"
[Baileys] 💾 Message saved successfully
```

### 3. **Possíveis problemas**

#### ❌ **Nenhum log aparece**
**Causa**: O evento `messages.upsert` não está sendo disparado
**Solução**:
1. Reconectar o WhatsApp
2. Verificar se o socket está realmente conectado
3. Reiniciar o backend

#### ❌ **Log aparece mas diz "Skipping message type"**
**Causa**: Tipo de mensagem não é `notify` ou `append`
**Logs esperados**:
```
[Baileys] 📨 Message update received - Type: XXX, Count: 1
[Baileys] ⏭️ Skipping message type: XXX
```
**Solução**: Verificar qual tipo está chegando e adicionar suporte

#### ❌ **Log aparece mas diz "Empty message text"**
**Causa**: Mensagem não tem texto (pode ser reação, status, etc)
**Logs esperados**:
```
[Baileys] ⚠️ Empty message text, skipping. Message object: {...}
```
**Solução**: Normal para alguns tipos de mensagem

#### ❌ **Log aparece mas erro ao salvar**
**Causa**: Erro no MessageService
**Logs esperados**:
```
[Baileys] ❌ Error processing message: [erro detalhado]
```
**Solução**: Verificar o erro específico

---

## 🧪 **TESTE PASSO A PASSO**

### 1. Reiniciar Backend com Logs
```bash
cd backend
npm run dev
```

### 2. Verificar Conexão
- Acesse `http://localhost:5173/admin/connections`
- Verifique se está "connected" (verde)
- Se não, reconecte escaneando o QR Code

### 3. Enviar Mensagem de Teste
- Do seu celular, envie uma mensagem para o número conectado
- **OU** peça para alguém enviar uma mensagem

### 4. Observar Logs do Backend
Você deve ver algo como:
```
[Baileys] 📨 Message update received - Type: notify, Count: 1
[Baileys] 📱 Processing message from 5511999999999@s.whatsapp.net, isFromMe: false
[Baileys] ✅ New text from 5511999999999@s.whatsapp.net: "teste"
[Baileys] 💾 Message saved successfully
```

### 5. Verificar no Frontend
- Acesse `http://localhost:5173/dashboard`
- A conversa deve aparecer na lista
- Clique na conversa para ver a mensagem

---

## 🔧 **Soluções Rápidas**

### Problema: Mensagens não aparecem no frontend
**Possíveis causas**:
1. Socket.IO não está conectado
2. Evento não está sendo emitido
3. Frontend não está escutando o evento

**Verificar**:
```javascript
// No console do navegador (F12)
console.log('Socket connected:', socket.connected);
```

### Problema: Mensagens aparecem mas com delay
**Causa**: Normal, pode levar alguns segundos
**Solução**: Aguardar ou implementar polling

### Problema: Apenas mensagens enviadas aparecem
**Causa**: Evento `messages.upsert` só captura mensagens recebidas após conexão
**Solução**: Normal, mensagens antigas não são sincronizadas

---

## 📊 **Tipos de Mensagem Suportados**

✅ **Texto simples** - `conversation`
✅ **Texto estendido** - `extendedTextMessage`
✅ **Imagem** - `imageMessage`
✅ **Áudio** - `audioMessage`
✅ **Vídeo** - `videoMessage`
✅ **Documento** - `documentMessage`

❌ **Não suportados** (ignorados):
- Reações
- Status/Stories
- Chamadas
- Mensagens de sistema

---

## 🚨 **Se NADA funcionar**

### 1. Limpar tudo e reconectar
```bash
# Backend
cd backend
npm run dev

# Desconectar e reconectar no frontend
```

### 2. Verificar se o número está correto
- O número conectado deve ser diferente do número que envia
- Não pode enviar mensagem para si mesmo

### 3. Testar com outro número
- Peça para alguém enviar uma mensagem
- Ou use outro celular/chip

### 4. Verificar banco de dados
```bash
# No backend, verificar se mensagens estão sendo salvas
npx prisma studio
# Abrir tabela "messages"
```

---

## 📝 **Copiar e Colar para Testar**

**Envie esta mensagem do WhatsApp:**
```
Teste 123 - Mensagem de debug
```

**Logs esperados no backend:**
```
[Baileys] 📨 Message update received - Type: notify, Count: 1
[Baileys] 📱 Processing message from 5511999999999@s.whatsapp.net, isFromMe: false
[Baileys] ✅ New text from 5511999999999@s.whatsapp.net: "Teste 123 - Mensagem de debug"
[Baileys] 💾 Message saved successfully
```

---

## ✅ **Próximos Passos**

1. **Reinicie o backend** para aplicar os novos logs
2. **Envie uma mensagem de teste**
3. **Observe os logs** no terminal do backend
4. **Me envie os logs** que aparecerem para eu ajudar!

---

**Depois de testar, me diga:**
- ✅ Os logs aparecem?
- ✅ Qual tipo de mensagem está chegando?
- ✅ Tem algum erro?
