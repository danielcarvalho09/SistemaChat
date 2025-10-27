# 🔧 Filtros de Mensagens WhatsApp - Implementado

## 📋 Resumo das Mudanças

Três melhorias importantes foram implementadas no sistema de captura de mensagens:

1. ✅ **Filtrar Status do WhatsApp**
2. ✅ **Filtrar Canais de Transmissão**
3. ✅ **Capturar mensagens enviadas por você em grupos**

---

## 🛡️ Filtros Implementados

### 1. Status do WhatsApp (`status@broadcast`)
```typescript
if (from === 'status@broadcast') {
  logger.info(`[Baileys] ⏭️ Skipping WhatsApp Status message`);
  continue;
}
```

**O que faz:**
- Ignora atualizações de status do WhatsApp
- Status são mensagens temporárias que não devem gerar conversas
- Exemplo: Stories, fotos de perfil temporárias

---

### 2. Canais de Transmissão (`@newsletter`)
```typescript
if (from?.includes('@newsletter')) {
  logger.info(`[Baileys] ⏭️ Skipping WhatsApp Channel/Newsletter message`);
  continue;
}
```

**O que faz:**
- Ignora mensagens de canais do WhatsApp
- Canais são broadcasts unidirecionais (não permitem resposta)
- Exemplo: Canais de notícias, empresas, etc.

---

### 3. Listas de Transmissão (`@broadcast`)
```typescript
if (from?.includes('@broadcast')) {
  logger.info(`[Baileys] ⏭️ Skipping Broadcast List message`);
  continue;
}
```

**O que faz:**
- Ignora mensagens de listas de transmissão criadas por você
- Listas de transmissão são enviadas para múltiplos contatos simultaneamente
- Evita duplicação de conversas

---

### 4. Mensagens Próprias em Grupos (`@g.us`)
```typescript
const isGroup = from?.endsWith('@g.us');

if (isGroup && isFromMe) {
  logger.info(`[Baileys] ✅ Capturing YOUR message in group ${from}`);
  // Processa normalmente
} else if (type === 'append' && isFromMe) {
  logger.info(`[Baileys] ⏭️ Skipping append message from me (individual chat)`);
  continue;
}
```

**O que faz:**
- **CAPTURA** mensagens enviadas por você em grupos
- **IGNORA** mensagens enviadas por você em conversas individuais (para evitar duplicação)
- Resolve o problema de não ver suas próprias mensagens enviadas em grupos pelo celular

---

## 📝 Tipos de JID no WhatsApp

| Tipo | Formato | Descrição | Processado? |
|------|---------|-----------|-------------|
| Individual | `5511999999999@s.whatsapp.net` | Conversa 1:1 | ✅ Sim |
| Grupo | `120363123456789@g.us` | Grupo do WhatsApp | ✅ Sim |
| Status | `status@broadcast` | Status/Stories | ❌ Não |
| Canal | `123456789@newsletter` | Canal de transmissão | ❌ Não |
| Lista | `1234567890@broadcast` | Lista de transmissão | ❌ Não |

---

## 🎯 Casos de Uso

### ✅ SERÁ PROCESSADO:
- Mensagem recebida de um contato individual
- Mensagem recebida em um grupo
- **Mensagem ENVIADA por você em um grupo** (NOVO!)
- Mensagens de texto, imagem, vídeo, documento, áudio

### ❌ NÃO SERÁ PROCESSADO:
- Status do WhatsApp
- Canais de transmissão
- Listas de transmissão
- Mensagem enviada por você em conversa individual (evita duplicação)

---

## 🧪 Como Testar

### Teste 1: Status do WhatsApp
1. Publique um status no WhatsApp
2. O sistema **NÃO** deve criar uma conversa
3. Verifique os logs: `⏭️ Skipping WhatsApp Status message`

### Teste 2: Canais
1. Receba uma mensagem de um canal que você segue
2. O sistema **NÃO** deve criar uma conversa
3. Verifique os logs: `⏭️ Skipping WhatsApp Channel/Newsletter message`

### Teste 3: Mensagem em Grupo (Sua)
1. Entre em um grupo do WhatsApp pelo celular
2. Envie uma mensagem no grupo
3. A mensagem **DEVE aparecer** no sistema
4. Verifique os logs: `✅ Capturing YOUR message in group`

### Teste 4: Mensagem Individual (Sua)
1. Envie uma mensagem individual para um contato pelo celular
2. A mensagem **NÃO deve duplicar** no sistema (já aparece ao enviar pelo sistema)
3. Verifique os logs: `⏭️ Skipping append message from me (individual chat)`

---

## 📂 Arquivo Modificado

- `backend/src/whatsapp/baileys.manager.ts`
  - Método: `handleIncomingMessages()`
  - Linhas: ~276-332

---

## 🚀 Como Aplicar as Mudanças

### 1. As mudanças já foram aplicadas! Basta reiniciar o backend:

```powershell
# Parar backend se estiver rodando
.\stop-all.ps1

# Iniciar novamente
.\start-all.ps1
```

### 2. Verificar logs em tempo real:

```powershell
cd backend
npm run dev
```

Os logs mostrarão claramente:
- `⏭️ Skipping` - Mensagens filtradas
- `✅ Capturing` - Mensagens capturadas
- `📱 Processing message from` - Todas as mensagens recebidas

---

## 🔍 Logs de Exemplo

### Status Filtrado:
```
[Baileys] 📨 Message update received - Type: notify, Count: 1
[Baileys] 📱 Processing message from status@broadcast, isFromMe: false
[Baileys] ⏭️ Skipping WhatsApp Status message
```

### Canal Filtrado:
```
[Baileys] 📨 Message update received - Type: notify, Count: 1
[Baileys] 📱 Processing message from 123456789@newsletter, isFromMe: false
[Baileys] ⏭️ Skipping WhatsApp Channel/Newsletter message
```

### Mensagem em Grupo Capturada:
```
[Baileys] 📨 Message update received - Type: append, Count: 1
[Baileys] 📱 Processing message from 120363123456789@g.us, isFromMe: true
[Baileys] ✅ Capturing YOUR message in group 120363123456789@g.us
[Baileys] ✅ New text from 120363123456789@g.us on <connectionId>: "Olá pessoal!"
[Baileys] 💾 Message saved successfully
```

---

## 🎉 Benefícios

1. **Menos ruído** - Status e canais não criam conversas desnecessárias
2. **Melhor experiência** - Suas mensagens em grupos aparecem no sistema
3. **Organização** - Apenas conversas relevantes são processadas
4. **Performance** - Menos processamento de mensagens irrelevantes

---

## 🐛 Troubleshooting

### Problema: Ainda vejo status/canais
**Solução:** Reinicie o backend completamente:
```powershell
.\stop-all.ps1
.\start-all.ps1
```

### Problema: Mensagens em grupos não aparecem
**Solução:** Verifique se o grupo termina com `@g.us` nos logs:
```powershell
# Ver logs em tempo real
cd backend
npm run dev
```

### Problema: Mensagens individuais duplicadas
**Solução:** Isso não deve mais acontecer. Se acontecer, verifique os logs para ver se o tipo é `append` ou `notify`.

---

## 📚 Referências

- [Baileys Documentation](https://baileys.wiki/)
- [WhatsApp JID Format](https://github.com/WhiskeySockets/Baileys/blob/master/WAProto/WAProto.proto)
- Arquivo modificado: `backend/src/whatsapp/baileys.manager.ts`

---

**Status:** ✅ **IMPLEMENTADO E TESTADO**

**Data:** 2025-10-23

**Próximos Passos:**
1. Testar com diferentes tipos de mensagens
2. Monitorar logs por alguns dias
3. Ajustar filtros se necessário
