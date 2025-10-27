# 👥 Como Funciona: Usuário em Múltiplos Setores

## 🎯 Cenário

**Usuário João está em 2 setores:**
- Recepção
- Vendas

**Pergunta**: Quais conversas João vê?

---

## ✅ Resposta: João vê TODAS as conversas dos 2 setores!

### Regras de Visibilidade:

```typescript
// Código atual: src/services/conversation.service.ts (linhas 52-83)

// 1. Buscar TODOS os setores do usuário
const userDepartments = await prisma.userDepartmentAccess.findMany({
  where: { userId: joaoId },
  select: { departmentId: true },
});
// Resultado: ['recepcao-id', 'vendas-id']

// 2. João vê conversas que atendem QUALQUER uma dessas condições:
where.OR = [
  // A) Conversas atribuídas diretamente a ele
  { assignedUserId: joaoId },
  
  // B) Conversas AGUARDANDO de qualquer um dos seus setores
  {
    status: 'waiting',
    assignedUserId: null,
    departmentId: { in: ['recepcao-id', 'vendas-id'] }
  },
  
  // C) Conversas TRANSFERIDAS para ele ou seus setores
  {
    status: 'transferred',
    OR: [
      { assignedUserId: joaoId },
      { departmentId: { in: ['recepcao-id', 'vendas-id'] } }
    ]
  }
]
```

---

## 📊 Exemplos Práticos

### Exemplo 1: Conversa Aguardando na Recepção

```
Conversa #1:
- Status: waiting
- Departamento: Recepção
- Atribuída a: ninguém

João vê? ✅ SIM (ele está na Recepção)
Maria (só Vendas) vê? ❌ NÃO
```

### Exemplo 2: Conversa Aguardando em Vendas

```
Conversa #2:
- Status: waiting
- Departamento: Vendas
- Atribuída a: ninguém

João vê? ✅ SIM (ele está em Vendas)
Pedro (só Recepção) vê? ❌ NÃO
```

### Exemplo 3: Conversa Atribuída

```
Conversa #3:
- Status: active
- Departamento: Recepção
- Atribuída a: João

João vê? ✅ SIM (atribuída a ele)
Maria (Recepção) vê? ❌ NÃO (não é dela)
Admin vê? ✅ SIM (admin vê tudo)
```

### Exemplo 4: Conversa Transferida para Setor

```
Conversa #4:
- Status: transferred
- Departamento: Vendas
- Atribuída a: ninguém

João vê? ✅ SIM (ele está em Vendas)
Qualquer um de Vendas vê? ✅ SIM
Pedro (Recepção) vê? ❌ NÃO
```

---

## 🎨 Interface do Usuário

### João (Recepção + Vendas) vê:

```
┌─────────────────────────────────────┐
│ Filtros:                            │
│ [Todos] [Recepção] [Vendas]         │
└─────────────────────────────────────┘

Conversas:
├─ 📞 Cliente A (Recepção) - Aguardando
├─ 💰 Cliente B (Vendas) - Aguardando
├─ 📞 Cliente C (Recepção) - Atribuída a João
└─ 💰 Cliente D (Vendas) - Transferida
```

### Maria (só Vendas) vê:

```
┌─────────────────────────────────────┐
│ Filtros:                            │
│ [Todos] [Vendas]                    │
└─────────────────────────────────────┘

Conversas:
├─ 💰 Cliente B (Vendas) - Aguardando
└─ 💰 Cliente D (Vendas) - Transferida
```

---

## 🔄 Fluxo Completo

### 1. Nova Mensagem Chega

```
WhatsApp → Backend → Criar Conversa
- Status: waiting
- Departamento: Recepção (padrão ou regra)
- Atribuída a: null
```

### 2. Quem Vê?

```
✅ João (Recepção + Vendas)
✅ Pedro (Recepção)
✅ Admin
❌ Maria (só Vendas)
```

### 3. João Aceita a Conversa

```
Conversa atualizada:
- Status: active
- Atribuída a: João
```

### 4. Quem Vê Agora?

```
✅ João (dono da conversa)
✅ Admin
❌ Pedro (não é mais dele)
❌ Maria (não é dela)
```

### 5. João Transfere para Vendas

```
Conversa atualizada:
- Status: transferred
- Departamento: Vendas
- Atribuída a: null
```

### 6. Quem Vê Agora?

```
✅ João (ainda vê porque está em Vendas)
✅ Maria (agora vê porque está em Vendas)
✅ Admin
❌ Pedro (não está em Vendas)
```

---

## 💡 Vantagens do Sistema Atual

### 1. **Flexibilidade Total**
- Usuário pode estar em quantos setores quiser
- Vê todas as conversas de todos os seus setores

### 2. **Sem Duplicação**
- Cada conversa aparece UMA vez
- Mesmo que usuário esteja em vários setores

### 3. **Privacidade**
- Conversas atribuídas são privadas
- Só o dono e admin veem

### 4. **Colaboração**
- Conversas aguardando são visíveis para todo o setor
- Qualquer um pode aceitar

---

## 🎯 Casos de Uso Reais

### Caso 1: Gerente de Múltiplos Setores

```
Gerente Carlos:
- Setores: Recepção, Vendas, Suporte

Vê:
✅ Todas conversas aguardando de Recepção
✅ Todas conversas aguardando de Vendas
✅ Todas conversas aguardando de Suporte
✅ Conversas atribuídas a ele
✅ Conversas transferidas para seus setores
```

### Caso 2: Atendente Especializado

```
Atendente Ana:
- Setores: Vendas, Suporte Técnico

Vê:
✅ Conversas de vendas
✅ Conversas de suporte técnico
❌ Conversas de outros setores
```

### Caso 3: Admin

```
Admin:
- Setores: (não importa)

Vê:
✅ TODAS as conversas
✅ De TODOS os setores
✅ De TODAS as conexões
```

---

## 📋 Resumo das Regras

| Tipo de Conversa | Quem Vê |
|------------------|---------|
| **Aguardando** (waiting) | Todos do setor + Admin |
| **Ativa** (active) | Dono + Admin |
| **Transferida** (transferred) | Todos do setor destino + Admin |
| **Resolvida** (resolved) | Dono + Admin |
| **Fechada** (closed) | Dono + Admin |

---

## 🔧 Configuração

### Como adicionar usuário a múltiplos setores:

```sql
-- Via SQL
INSERT INTO user_department_access (user_id, department_id)
VALUES 
  ('joao-id', 'recepcao-id'),
  ('joao-id', 'vendas-id');

-- Via API (criar usuário)
POST /api/v1/users
{
  "name": "João",
  "email": "joao@empresa.com",
  "departmentIds": ["recepcao-id", "vendas-id"]
}

-- Via API (atualizar usuário)
PATCH /api/v1/users/joao-id
{
  "departmentIds": ["recepcao-id", "vendas-id", "suporte-id"]
}
```

---

## 🎨 Melhorias Futuras (Opcional)

### 1. Filtro por Setor no Frontend

```typescript
// Permitir filtrar conversas por setor específico
const [selectedDepartment, setSelectedDepartment] = useState('all');

// Buscar conversas
const conversations = await api.get('/conversations', {
  params: {
    departmentId: selectedDepartment === 'all' ? undefined : selectedDepartment
  }
});
```

### 2. Badge de Setor

```tsx
// Mostrar badge colorido do setor em cada conversa
<ConversationItem>
  <Badge color={department.color}>
    {department.name}
  </Badge>
</ConversationItem>
```

### 3. Notificações por Setor

```typescript
// Notificar apenas usuários do setor específico
socket.to(`department:${departmentId}`).emit('new_conversation', data);
```

---

## ✅ Conclusão

**Resposta direta à sua pergunta:**

> "Se um usuário está em 2 setores, ele vê conversas dos 2 setores!"

**Exemplo:**
- João está em Recepção e Vendas
- João vê TODAS as conversas aguardando de Recepção
- João vê TODAS as conversas aguardando de Vendas
- João vê conversas atribuídas a ele de qualquer setor
- João pode aceitar conversas de qualquer um dos seus setores

**Sem duplicação, sem conflitos, tudo organizado!** ✨
