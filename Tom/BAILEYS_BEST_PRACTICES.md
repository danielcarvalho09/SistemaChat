# Baileys - Melhores Práticas (Baseado na Documentação Oficial)

## 📚 Fontes
- https://baileys.wiki/docs/intro/
- https://github.com/WhiskeySockets/Baileys

## ⚠️ Problemas Identificados na Implementação Atual

### 1. **Auth State em Produção**
❌ **PROBLEMA:** Usando `useMultiFileAuthState` em produção
✅ **SOLUÇÃO:** A documentação é CLARA: "DO NOT USE IN PROD!!!!"
- Consome muito I/O
- Ineficiente
- Apenas para demo/desenvolvimento

### 2. **syncFullHistory**
❌ **ATUAL:** `syncFullHistory: false`
⚠️ **CONSIDERAÇÃO:** 
- `false` = Emula navegador web (mais rápido, menos dados)
- `true` = Emula desktop (histórico completo, mais lento)
- Para produção, `false` é melhor

### 3. **Reconexão após QR Code**
❌ **PROBLEMA:** Após escanear QR Code, WhatsApp **força desconexão**
✅ **ESPERADO:** Isso é NORMAL! Status code: `DisconnectReason.restartRequired`
- Deve criar novo socket após esse disconnect
- Não é erro!

### 4. **Erro 515 (Stream Error)**
❌ **PROBLEMA:** Tentando reconectar automaticamente
✅ **SOLUÇÃO:** Não reconectar em erro 515 - usuário deve tentar manualmente

## ✅ Implementação Correta

### **1. Handling Connection Updates**

```typescript
import { DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';

socket.ev.on('connection.update', async (update) => {
  const { connection, lastDisconnect, qr } = update;
  
  // QR Code gerado
  if (qr) {
    // Enviar QR para frontend
    emitQRCode(connectionId, qr);
  }
  
  // Conexão estabelecida
  if (connection === 'open') {
    logger.info('✅ Connected successfully');
    // Salvar status no banco
  }
  
  // Conexão fechada
  if (connection === 'close') {
    const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
    
    // IMPORTANTE: Após escanear QR, WhatsApp força restart
    if (statusCode === DisconnectReason.restartRequired) {
      logger.info('🔄 Restart required after QR scan - creating new socket');
      // Criar novo socket com as credenciais salvas
      await createClient(connectionId);
      return;
    }
    
    // Logout intencional
    if (statusCode === DisconnectReason.loggedOut) {
      logger.warn('User logged out');
      // Limpar sessão
      return;
    }
    
    // Outros erros
    logger.error(`Connection closed: ${statusCode}`);
  }
});
```

### **2. Configuração Recomendada**

```typescript
const socket = makeWASocket({
  auth: state, // Implementar auth state customizado (SQL/Redis)
  logger: pino({ level: 'silent' }), // Ou 'info' para debug
  browser: Browsers.ubuntu('Chrome'), // Navegador válido
  syncFullHistory: false, // false para produção (mais rápido)
  markOnlineOnConnect: false, // Não marcar online automaticamente
  getMessage: async (key) => {
    // Buscar mensagem do banco de dados
    return await getMessageFromDB(key);
  },
  // NÃO usar fetchLatestWaWebVersion() - pode causar incompatibilidade
  // Deixar versão padrão
});
```

### **3. Salvando Credenciais**

```typescript
// Evento disparado toda vez que credenciais são atualizadas
socket.ev.on('creds.update', async () => {
  // Salvar no banco de dados
  await saveCredsToDatabase(state.creds);
});
```

## 🔧 Correções Necessárias

### **Prioridade ALTA:**

1. ✅ **Implementar auth state customizado** (SQL/Redis)
   - Substituir `useMultiFileAuthState`
   - Salvar em banco de dados

2. ✅ **Tratar `DisconnectReason.restartRequired` corretamente**
   - Após QR scan, criar novo socket
   - Não tratar como erro

3. ✅ **Não reconectar em erro 515**
   - Stream error = problema de rede/WhatsApp
   - Usuário deve tentar manualmente

### **Prioridade MÉDIA:**

4. ⚠️ **Implementar `getMessage` corretamente**
   - Necessário para reenviar mensagens perdidas
   - Necessário para decriptar votos de enquetes

5. ⚠️ **Melhorar logs**
   - Usar pino com nível configurável
   - Stream logs para arquivo/serviço

## 📊 Fluxo Correto de Conexão

```
1. Criar socket com auth state
   ↓
2. Se sem credenciais → Gerar QR Code
   ↓
3. Usuário escaneia QR
   ↓
4. WhatsApp FORÇA disconnect (restartRequired) ← ISSO É NORMAL!
   ↓
5. Criar NOVO socket com credenciais salvas
   ↓
6. Conexão estabelecida (status: 'open')
   ↓
7. Salvar credenciais no evento 'creds.update'
```

## 🚨 Erros Comuns

| Código | Significado | Ação |
|--------|-------------|------|
| 401 | Logout | Limpar sessão, gerar novo QR |
| 408 | Timeout | Problema de rede, tentar novamente |
| 428 | Connection Closed | Socket já fechado, criar novo |
| 515 | Stream Error | Problema de rede, NÃO reconectar auto |
| 440 | Restart Required | NORMAL após QR scan, criar novo socket |

## 📝 Notas Importantes

1. **useMultiFileAuthState é APENAS para desenvolvimento**
2. **Após QR scan, desconexão é ESPERADA**
3. **Não usar fetchLatestWaWebVersion() em produção**
4. **syncFullHistory: false para melhor performance**
5. **Implementar getMessage para funcionalidades completas**

## 🎯 Próximos Passos

1. Implementar auth state em banco de dados (PostgreSQL)
2. Corrigir handling de `restartRequired`
3. Melhorar tratamento de erros
4. Adicionar retry logic inteligente
5. Implementar getMessage do banco
