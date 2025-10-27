# Mudanças Pendentes - Refatoração de Conexões

## Status da Refatoração

### ✅ Concluído
1. Schema do Prisma atualizado - conexões agora relacionadas com usuários
2. Migration aplicada no banco de dados
3. ConversationService atualizado com nova lógica de transferência
4. UserService atualizado para gerenciar conexões dos usuários
5. Frontend Users.tsx atualizado com UI para gerenciar conexões
6. Authorization middleware atualizado

### ⚠️ Pendente

#### message.service.ts
- **Linha 131**: Remover `connections` do include de Department
- **Linha 142**: Verificação de `departmentAccess` pode estar incorreta (verificar contexto)
- **Linha 328**: Corrigir import de BaileysManager
- **Linha 376**: Remover referência a `connectionDepartment`

#### whatsapp.service.ts
- **Linhas 44, 150, 156, 257**: Remover todas as referências a `connectionDepartment`
- **Linhas 67, 95**: Remover `departments` do include de connections
- **Linhas 78-79**: Remover manipulação de departments

## Estratégia Recomendada

Para message.service.ts e whatsapp.service.ts, como as conexões agora pertencem aos usuários:

1. **Remover completamente** todas as lógicas que tentam associar conexões com departamentos
2. **Simplificar** a lógica para que as conexões sejam buscadas apenas por `userId`
3. **Remover includes** de `departments` nos queries de conexões

## Código Sugerido

### Para queries de conexões:
```typescript
// ANTES (ERRADO):
const connection = await prisma.whatsAppConnection.findUnique({
  where: { id: connectionId },
  include: {
    departments: { include: { department: true } }
  }
});

// DEPOIS (CORRETO):
const connection = await prisma.whatsAppConnection.findUnique({
  where: { id: connectionId },
  include: {
    user: true  // Se precisar do usuário
  }
});
```

### Para buscar conexões de um usuário:
```typescript
const userConnections = await prisma.whatsAppConnection.findMany({
  where: { userId: userId }
});
```
