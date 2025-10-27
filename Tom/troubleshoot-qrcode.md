# Troubleshooting - QR Code não conecta

## Possíveis Causas e Soluções

### 1. QR Code Expira Muito Rápido
**Causa:** O QR Code do WhatsApp expira em ~20 segundos
**Solução:** Escaneie rapidamente ou gere um novo

### 2. WhatsApp Web já está ativo em outro dispositivo
**Causa:** Limite de 5 dispositivos conectados
**Solução:** 
- Abra WhatsApp no celular
- Vá em "Dispositivos Conectados"
- Remova dispositivos antigos

### 3. Sessão corrompida no disco
**Causa:** Sessão antiga está causando conflito
**Solução:**
```powershell
# Remover todas as sessões
Remove-Item -Path ".\backend\whatsapp-sessions" -Recurse -Force

# Reiniciar backend
npm run dev
```

### 4. WebSocket não está conectado
**Causa:** Frontend não está recebendo o QR Code via Socket.IO
**Solução:** Verifique o console do navegador (F12)

### 5. QR Code não está sendo gerado
**Causa:** Baileys não está gerando o QR
**Solução:** Verificar logs do backend

### 6. Número já está conectado em outra instância
**Causa:** Mesmo número tentando conectar em 2 lugares
**Solução:** Desconecte da outra instância primeiro

## Como Testar

### 1. Verificar logs do backend
Procure por:
```
✓ QR Code generated for [connectionId]
✓ QR Code emitted via Socket.IO for [connectionId]
```

### 2. Verificar console do navegador
Procure por:
```
✓ Socket connected
✓ whatsapp:qr event received
```

### 3. Testar manualmente
1. Limpe as sessões
2. Reinicie o backend
3. Crie nova conexão
4. Escaneie o QR Code IMEDIATAMENTE (< 20s)
5. Aguarde "Conectado"

## Comandos Úteis

```powershell
# Limpar sessões
Remove-Item -Path ".\backend\whatsapp-sessions" -Recurse -Force

# Ver logs do backend em tempo real
# (já está rodando no terminal)

# Verificar conexões no banco
docker exec whatsapp_postgres psql -U postgres -d whatsapp_system -c "SELECT id, name, status FROM whatsapp_connections;"
```

## Dicas

1. ✅ Use o WhatsApp mais recente
2. ✅ Tenha internet estável
3. ✅ Escaneie o QR Code rapidamente
4. ✅ Não feche a página enquanto conecta
5. ✅ Aguarde até aparecer "Conectado"
