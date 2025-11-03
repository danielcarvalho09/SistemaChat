# ✅ Feature: Exibição do Push Name (Nome do Perfil WhatsApp)

## 🎯 Objetivo
Exibir o `pushName` (nome do perfil do WhatsApp) dos contatos abaixo do número de telefone nas conversas em aguardando e em atendimento.

---

## 🔧 IMPLEMENTAÇÃO

### 1. Backend - Schema do Banco de Dados ✅

**Arquivo:** `prisma/schema.prisma`

Adicionado campo `pushName` ao modelo `Contact`:

```prisma
model Contact {
  id           String   @id @default(uuid())
  phoneNumber  String   @unique
  name         String?
  pushName     String? // Nome do perfil do WhatsApp (push.name)
  avatar       String?
  email        String?
  tags         String[] // Tags personalizadas
  metadata     Json? // Dados adicionais customizáveis
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relações
  conversations Conversation[]

  @@index([phoneNumber])
  @@map("contacts")
}
```

**Próximo passo:** Executar migration no Railway:
```bash
railway run npx prisma migrate deploy
```

---

### 2. Backend - Captura do Push Name ✅

**Arquivo:** `src/whatsapp/baileys.manager.ts`

Capturando `pushName` das mensagens recebidas:

```typescript
for (const msg of messages) {
  const from = msg.key.remoteJid;
  const isFromMe = msg.key.fromMe || false;
  const externalId = msg.key.id;
  const pushName = msg.pushName || null; // ✅ Capturar pushName do contato

  logger.info(`[Baileys] 📱 Processing message from ${from}, pushName: ${pushName}`);
  
  // Passar pushName para o MessageService
  await messageService.processIncomingMessage(
    connectionId,
    from,
    messageText,
    messageType,
    null,
    isFromMe,
    externalId,
    pushName // ✅ Passar para o service
  );
}
```

---

### 3. Backend - Salvamento do Push Name ✅

**Arquivo:** `src/services/message.service.ts`

Salvando e atualizando `pushName` automaticamente:

```typescript
async processIncomingMessage(
  connectionId: string,
  from: string,
  messageText: string,
  messageType: string = 'text',
  mediaUrl: string | null = null,
  isFromMe: boolean = false,
  externalId?: string,
  pushName?: string | null // ✅ Novo parâmetro
): Promise<void> {
  // ...
  
  if (!contact) {
    // Criar novo contato com pushName
    contact = await this.prisma.contact.create({
      data: {
        phoneNumber,
        name: contactName,
        pushName: pushName || null, // ✅ Salvar pushName
      },
    });
    logger.info(`New contact created: ${phoneNumber} - pushName: ${pushName || 'N/A'}`);
  } else if (pushName && contact.pushName !== pushName) {
    // Atualizar pushName se mudou
    await this.prisma.contact.update({
      where: { id: contact.id },
      data: { pushName },
    });
    logger.info(`📝 Updated pushName for ${phoneNumber}: ${pushName}`);
  }
}
```

**Benefícios:**
- ✅ Captura automática do pushName
- ✅ Atualização automática se o usuário mudar o nome do perfil
- ✅ Logs detalhados para rastreamento

---

### 4. Frontend - Interface TypeScript ✅

**Arquivo:** `src/components/chat/ConversationItem.tsx`

Adicionado `pushName` à interface:

```typescript
interface Conversation {
  id: string;
  contact: {
    name: string;
    phoneNumber: string;
    pushName?: string | null; // ✅ Novo campo
    profilePicture?: string;
  };
  // ...
}
```

---

### 5. Frontend - Exibição Visual ✅

**Arquivo:** `src/components/chat/ConversationItem.tsx`

Exibindo `pushName` abaixo do nome/telefone:

```tsx
<div className="flex flex-col gap-0.5 flex-1">
  <h3 className="font-semibold text-gray-900 truncate">
    {conversation.contact.name && conversation.contact.name !== conversation.contact.phoneNumber 
      ? conversation.contact.name 
      : formatPhoneNumber(conversation.contact.phoneNumber)}
  </h3>
  {conversation.contact.pushName && (
    <p className="text-xs text-gray-500 truncate">
      {conversation.contact.pushName}
    </p>
  )}
</div>
```

**Características:**
- ✅ Fonte pequena (`text-xs`)
- ✅ Cor cinza (`text-gray-500`)
- ✅ Trunca se for muito longo
- ✅ Só exibe se existir

---

## 📊 RESULTADO VISUAL

### Antes:
```
┌─────────────────────────────────┐
│ 👤 (11) 98765-4321             │
│    Última mensagem...           │
│    ⏳ Aguardando                │
└─────────────────────────────────┘
```

### Depois:
```
┌─────────────────────────────────┐
│ 👤 (11) 98765-4321             │
│    João Silva                   │ ← pushName (cinza, pequeno)
│    Última mensagem...           │
│    ⏳ Aguardando                │
└─────────────────────────────────┘
```

---

## 🚀 DEPLOY

### 1. Backend

```bash
# 1. Gerar Prisma Client (já feito)
npx prisma generate

# 2. Build (já feito)
npm run build

# 3. Commit e push
git add .
git commit -m "feat: adicionar pushName aos contatos"
git push

# 4. No Railway, executar migration
railway run npx prisma migrate deploy
```

### 2. Frontend

O frontend já está pronto. Ao fazer deploy, o pushName será exibido automaticamente.

---

## 🔍 COMO FUNCIONA

### Fluxo Automático:

1. **Cliente envia mensagem no WhatsApp**
   ```
   Cliente: "Olá, preciso de ajuda"
   pushName: "João Silva"
   ```

2. **Baileys captura a mensagem**
   ```typescript
   const pushName = msg.pushName; // "João Silva"
   ```

3. **MessageService processa**
   ```typescript
   // Se contato novo: cria com pushName
   // Se contato existe: atualiza pushName se mudou
   ```

4. **Banco de dados atualizado**
   ```sql
   UPDATE contacts 
   SET pushName = 'João Silva' 
   WHERE phoneNumber = '5511987654321'
   ```

5. **Frontend exibe**
   ```tsx
   <h3>(11) 98765-4321</h3>
   <p className="text-xs text-gray-500">João Silva</p>
   ```

---

## 📝 OBSERVAÇÕES IMPORTANTES

### 1. Push Name vs Nome Salvo

- **Push Name:** Nome que o usuário usa no perfil do WhatsApp
- **Nome Salvo:** Nome que você salva manualmente no sistema

**Prioridade de Exibição:**
1. Nome salvo no sistema (se existir)
2. Número de telefone formatado
3. Push name aparece abaixo (se existir)

### 2. Atualização Automática

O `pushName` é atualizado automaticamente sempre que:
- Cliente envia uma nova mensagem
- O nome do perfil dele mudou no WhatsApp

### 3. Grupos

Para grupos, o `pushName` não se aplica (grupos usam `groupMetadata.subject`).

---

## ✅ CHECKLIST DE DEPLOY

- [x] Schema atualizado com campo `pushName`
- [x] Prisma Client gerado
- [x] Baileys capturando `pushName`
- [x] MessageService salvando `pushName`
- [x] Frontend exibindo `pushName`
- [x] Build do backend OK
- [ ] Migration executada no Railway
- [ ] Deploy do backend
- [ ] Deploy do frontend
- [ ] Teste em produção

---

## 🎯 RESULTADO FINAL

**Benefícios:**
- ✅ Identificação mais fácil dos contatos
- ✅ Melhor experiência do atendente
- ✅ Atualização automática
- ✅ Sem necessidade de salvar nome manualmente
- ✅ Visual limpo e profissional

**Sistema pronto para uso! 🚀**
