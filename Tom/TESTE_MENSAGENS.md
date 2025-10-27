# 🧪 Guia de Teste - Recebimento de Mensagens

## 1. Verificar Status da Conexão

### No Frontend:
1. Acesse a página de **Conexões**
2. Verifique se o status está como **"Conectado"** (verde)
3. Se não estiver, clique em **"Conectar"** e escaneie o QR Code novamente

### No Backend (Logs):
Procure por estas mensagens no terminal do backend:
```
[Baileys] ✅ Connected: [connection-id]
[Baileys] 💓 Keepalive [connection-id] - Last message: X min ago
```

---

## 2. Testar Recebimento de Mensagens

### Passo a Passo:
1. **Envie uma mensagem de teste** de outro WhatsApp para o número conectado
2. **Aguarde 5-10 segundos**
3. **Verifique os logs do backend** - Deve aparecer:
   ```
   [Baileys] 📨 Message update received - Type: notify, Count: 1
   [Baileys] 📱 Processing message from 5511999999999@s.whatsapp.net
   [Baileys] ✅ New text from 5511999999999@s.whatsapp.net
   [Baileys] 💾 Message saved successfully
   ```

4. **Verifique o frontend** - A mensagem deve aparecer na lista de conversas

---

## 3. Problemas Comuns

### ❌ Problema: "Connection not found"
**Solução:** Reconecte o WhatsApp:
1. Desconecte a conexão atual
2. Aguarde 5 segundos
3. Conecte novamente e escaneie o QR Code

### ❌ Problema: "Connection is not connected"
**Solução:** 
1. Verifique se o QR Code foi escaneado corretamente
2. Aguarde o processo de reconexão automática (código 440)
3. Verifique os logs para ver se conectou (`connection === 'open'`)

### ❌ Problema: Mensagens não aparecem no frontend
**Solução:**
1. Abra o **Console do navegador** (F12)
2. Verifique se há erros de WebSocket
3. Recarregue a página (F5)
4. Verifique se o Socket.IO está conectado:
   ```javascript
   // No console do navegador:
   socket.connected // Deve retornar true
   ```

---

## 4. Logs Importantes

### ✅ Logs de Sucesso:
```
[Baileys] QR Code generated for [id]
[Baileys] Connecting: [id]
[Baileys] ✅ Connected: [id]
[Baileys] 📨 Message update received - Type: notify
[Baileys] ✅ New text from [phone]
[Baileys] 💾 Message saved successfully
New message event emitted for conversation [id]
```

### ❌ Logs de Erro:
```
[Baileys] ❌ Connection closed: [id]
[Baileys] 📊 Status Code: [code]
Connection [id] not found
Connection [id] is not connected
```

---

## 5. Checklist de Verificação

- [ ] Backend está rodando sem erros
- [ ] Frontend está rodando sem erros
- [ ] WhatsApp está com status "Conectado"
- [ ] QR Code foi escaneado corretamente
- [ ] Aguardou reconexão automática após QR scan (código 440)
- [ ] Enviou mensagem de teste de outro WhatsApp
- [ ] Verificou logs do backend
- [ ] Verificou console do navegador (F12)
- [ ] Socket.IO está conectado no frontend

---

## 6. Teste de Envio (Opcional)

Para testar se o envio funciona:
1. Selecione uma conversa no frontend
2. Digite uma mensagem
3. Clique em "Enviar"
4. Verifique se a mensagem foi entregue no WhatsApp do destinatário

---

## 7. Reiniciar Sistema (Último Recurso)

Se nada funcionar:
1. **Pare o backend** (Ctrl+C)
2. **Pare o frontend** (Ctrl+C)
3. **Aguarde 10 segundos**
4. **Inicie o backend** (`npm run dev`)
5. **Inicie o frontend** (`npm run dev`)
6. **Reconecte o WhatsApp** (escanear QR Code novamente)
7. **Teste novamente**

---

## 8. Comandos Úteis

### Ver logs do backend em tempo real:
```powershell
cd backend
npm run dev
```

### Ver logs do frontend em tempo real:
```powershell
cd frontend
npm run dev
```

### Verificar se portas estão em uso:
```powershell
# Backend (porta 3000)
netstat -ano | findstr :3000

# Frontend (porta 5173)
netstat -ano | findstr :5173
```

---

## 📞 Suporte

Se o problema persistir após seguir todos os passos:
1. Copie os logs do backend
2. Copie os erros do console do navegador
3. Tire screenshots do problema
4. Documente os passos que você seguiu
