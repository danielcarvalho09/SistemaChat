# 📱 Fluxo Completo: Da Mensagem no WhatsApp até o Setor

## 🎯 Você está certo!

**A mensagem chega em um NÚMERO (conexão WhatsApp), não em um setor.**

Vou explicar o fluxo completo:

---

## 🔄 Fluxo Passo a Passo

### 1️⃣ **Mensagem Chega no WhatsApp**

```
Cliente: "Olá, preciso de ajuda!"
   ↓
Número WhatsApp: (11) 98765-4321
```

### 2️⃣ **Sistema Identifica a Conexão**

```typescript
// Código: baileys.manager.ts (linha ~400)

// Mensagem chega na conexão
connectionId: "abc-123-def"  // ID da conexão no banco

// Qual número recebeu?
phoneNumber: "5511987654321"
```

### 3️⃣ **Sistema Busca: Quem é o Dono da Conexão?**

```typescript
// Código: message.service.ts (linhas 329-342)

const connection = await prisma.whatsAppConnection.findUnique({
  where: { id: connectionId },
  include: {
    user: {
      include: {
        departmentAccess: {
          include: { department: true },
          take: 1, // Pega o PRIMEIRO setor do usuário
        },
      },
    },
  },
});

// Resultado:
// Conexão pertence a: João
// João está nos setores: [Recepção, Vendas]
// Primeiro setor: Recepção
```

### 4️⃣ **Sistema Define o Setor da Conversa**

```typescript
// Código: message.service.ts (linha 344)

const departmentId = connection?.user?.departmentAccess?.[0]?.departmentId || null;

// Conversa vai para: Recepção (primeiro setor de João)
```

### 5️⃣ **Sistema Cria a Conversa**

```typescript
// Código: message.service.ts (linhas 353-363)

conversation = await prisma.conversation.create({
  data: {
    contactId: contact.id,
    connectionId: connectionId,        // Conexão que recebeu
    departmentId: departmentId,        // Setor do dono da conexão
    assignedUserId: null,              // Não atribuída ainda
    status: 'waiting',                 // Aguardando atendimento
    lastMessageAt: new Date(),
  },
});

// Resultado:
// Conversa criada no setor: Recepção
// Status: waiting (aguardando)
// Atribuída a: ninguém (null)
```

### 6️⃣ **Quem Vê Esta Conversa?**

```typescript
// Código: conversation.service.ts (linhas 60-83)

// Conversas AGUARDANDO (waiting) são vistas por:
where.OR = [
  {
    status: 'waiting',
    assignedUserId: null,
    departmentId: { in: departmentIds } // Setores do usuário
  }
]

// Quem vê:
// ✅ João (dono da conexão, está em Recepção)
// ✅ Pedro (está em Recepção)
// ✅ Admin
// ❌ Maria (só está em Vendas)
```

---

## 📊 Exemplo Completo

### Cenário:

```
Empresa tem 3 números WhatsApp:

1. (11) 98765-4321 → Conexão de João (Recepção + Vendas)
2. (11) 98765-5555 → Conexão de Maria (Vendas)
3. (11) 98765-6666 → Conexão de Pedro (Recepção)
```

### Fluxo 1: Cliente manda mensagem para (11) 98765-4321

```
1. Mensagem chega na conexão de João
2. Sistema verifica: Conexão pertence a João
3. Sistema verifica: João está em [Recepção, Vendas]
4. Sistema pega primeiro setor: Recepção
5. Conversa criada em: Recepção (status: waiting)
6. Quem vê:
   ✅ João (Recepção + Vendas)
   ✅ Pedro (Recepção)
   ✅ Admin
   ❌ Maria (só Vendas)
```

### Fluxo 2: Cliente manda mensagem para (11) 98765-5555

```
1. Mensagem chega na conexão de Maria
2. Sistema verifica: Conexão pertence a Maria
3. Sistema verifica: Maria está em [Vendas]
4. Sistema pega primeiro setor: Vendas
5. Conversa criada em: Vendas (status: waiting)
6. Quem vê:
   ✅ Maria (Vendas)
   ✅ João (Recepção + Vendas)
   ✅ Admin
   ❌ Pedro (só Recepção)
```

### Fluxo 3: Pedro aceita a conversa

```
1. Pedro clica em "Aceitar" na conversa
2. Sistema atualiza:
   - assignedUserId: Pedro
   - status: in_progress
3. Quem vê agora:
   ✅ Pedro (dono da conversa)
   ✅ Admin
   ❌ João (não é mais dele)
```

---

## 🎯 Regra Principal

**O setor da conversa é definido pelo PRIMEIRO setor do dono da conexão WhatsApp.**

```typescript
// Se João tem conexão e está em:
departmentAccess: [
  { department: "Recepção" },   // ← Este será usado
  { department: "Vendas" }
]

// Todas as mensagens que chegarem na conexão de João
// vão para o setor: Recepção
```

---

## 💡 Casos Especiais

### Caso 1: Usuário sem Setor

```typescript
// Se conexão pertence a usuário sem setor
departmentId = null

// Conversa criada sem setor
// Quem vê:
// ✅ Admin (vê tudo)
// ❌ Usuários comuns (não veem)
```

### Caso 2: Múltiplas Conexões no Mesmo Setor

```
João (Recepção) → Conexão A
Pedro (Recepção) → Conexão B

Cliente manda para Conexão A:
- Conversa vai para: Recepção
- Veem: João, Pedro, Admin

Cliente manda para Conexão B:
- Conversa vai para: Recepção
- Veem: João, Pedro, Admin
```

### Caso 3: Transferência de Setor

```
1. Conversa criada em: Recepção
2. João transfere para: Vendas
3. Sistema atualiza:
   - departmentId: Vendas
   - status: transferred
4. Quem vê agora:
   ✅ Usuários de Vendas
   ✅ Admin
   ❌ Usuários só de Recepção
```

---

## 🔧 Como Configurar

### 1. Criar Conexão WhatsApp

```
1. Usuário faz login
2. Vai em "Conexões WhatsApp"
3. Clica em "Nova Conexão"
4. Escaneia QR Code
5. Conexão criada e vinculada ao usuário
```

### 2. Definir Setores do Usuário

```sql
-- Via SQL
INSERT INTO user_department_access (user_id, department_id)
VALUES 
  ('joao-id', 'recepcao-id'),  -- Primeiro setor (usado para conversas)
  ('joao-id', 'vendas-id');

-- Via API
PATCH /api/v1/users/joao-id
{
  "departmentIds": ["recepcao-id", "vendas-id"]
}
```

### 3. Ordem dos Setores Importa!

```typescript
// IMPORTANTE: O primeiro setor é usado para novas conversas

// João com setores nesta ordem:
[
  "Recepção",  // ← Conversas vão para aqui
  "Vendas"
]

// Se quiser que vá para Vendas, inverta:
[
  "Vendas",    // ← Conversas vão para aqui
  "Recepção"
]
```

---

## 📋 Resumo

| Etapa | O que acontece |
|-------|----------------|
| 1. Mensagem chega | No número WhatsApp (conexão) |
| 2. Sistema identifica | Quem é o dono da conexão |
| 3. Sistema busca | Setores do dono |
| 4. Sistema define | Primeiro setor = setor da conversa |
| 5. Conversa criada | Status: waiting, Setor: definido |
| 6. Visibilidade | Todos do setor veem |

---

## 🎨 Melhorias Futuras (Opcional)

### 1. Permitir Escolher Setor por Conexão

```typescript
// Ao criar conexão, permitir escolher o setor
POST /api/v1/whatsapp/connections
{
  "name": "Atendimento Vendas",
  "departmentId": "vendas-id"  // ← Setor específico
}

// Mensagens desta conexão sempre vão para Vendas
```

### 2. Regras de Roteamento

```typescript
// Criar regras para rotear automaticamente
{
  "keyword": "vendas",
  "departmentId": "vendas-id"
}

// Se mensagem contém "vendas", vai para setor Vendas
```

### 3. Horário de Atendimento

```typescript
// Setor diferente fora do horário
{
  "businessHours": {
    "departmentId": "vendas-id",
    "afterHours": "plantao-id"
  }
}
```

---

## ✅ Conclusão

**Você está certo!** A mensagem chega no número (conexão), não no setor.

**O sistema:**
1. Identifica qual conexão recebeu
2. Busca o dono da conexão
3. Pega o primeiro setor do dono
4. Cria a conversa nesse setor
5. Todos do setor veem a conversa

**Simples e eficiente!** ✨
