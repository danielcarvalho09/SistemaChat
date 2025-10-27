# Guia de Migração - Status "Transferida"

## Resumo das Mudanças

Foi implementado um novo status `transferred` para conversas que foram transferidas entre usuários, departamentos ou conexões. Este status requer que a conversa seja aceita antes de ir para "Em Atendimento".

## Mudanças Implementadas

### 1. Backend

#### Schema Prisma (`backend/prisma/schema.prisma`)
- Atualizado comentário do campo `status` para incluir `transferred`

#### Types (`backend/src/models/types.ts`)
- Adicionado `TRANSFERRED = 'transferred'` ao enum `ConversationStatus`

#### Service (`backend/src/services/conversation.service.ts`)
- **Método `transferConversation`**: Agora define status como `transferred` ao invés de `in_progress` ou `waiting`
- **Validação de conexão**: Transferências agora EXIGEM uma conexão válida e conectada, caso contrário lançam erro
- **Método `acceptConversation`**: Atualizado para aceitar conversas com status `transferred` além de `waiting`
- **Método `listConversations`**: Adicionado filtro para que usuários vejam conversas transferidas para eles ou seus departamentos
- **Método `getConversation`**: Atualizado para permitir acesso a conversas com status `transferred`

### 2. Frontend

#### Types (`frontend/src/types/index.ts`)
- Adicionado `'transferred'` ao tipo de status da interface `Conversation`

#### ConversationList (`frontend/src/components/chat/ConversationList.tsx`)
- Adicionado botão de filtro "Transferidas" na barra lateral
- Agora há 3 categorias: Aguardando, Transferidas, Em Atendimento

#### ConversationItem (`frontend/src/components/chat/ConversationItem.tsx`)
- Adicionada cor roxa (`#8B5CF6`) para status `transferred`
- Adicionado label "Transferida" para o status
- Botão "Aceitar" agora aparece tanto para conversas `waiting` quanto `transferred`

## Como Aplicar a Migração

### Passo 1: Criar e Aplicar Migração do Banco de Dados

```powershell
# Navegar para a pasta do backend
cd backend

# Criar migração
npx prisma migrate dev --name add_transferred_status

# Ou se preferir aplicar sem criar nova migração (se já existir)
npx prisma migrate deploy
```

### Passo 2: Atualizar Conversas Existentes (Opcional)

Se você quiser que conversas que já foram transferidas mas ainda estão com status antigo sejam atualizadas:

```sql
-- Executar no banco de dados PostgreSQL
-- Este comando é OPCIONAL e depende da sua necessidade

-- Exemplo: Atualizar conversas que têm histórico de transferência mas não estão com status transferred
UPDATE conversations 
SET status = 'transferred' 
WHERE id IN (
  SELECT DISTINCT conversation_id 
  FROM conversation_transfers 
  WHERE transferred_at > NOW() - INTERVAL '1 day'
) 
AND status = 'waiting';
```

### Passo 3: Reiniciar os Serviços

```powershell
# Parar os serviços
.\stop.ps1

# Iniciar novamente
.\start.ps1
```

## Comportamento Esperado

### Fluxo de Transferência

1. **Usuário transfere conversa** → Status muda para `transferred`
2. **Conexão é trocada automaticamente** → Mensagens futuras serão enviadas do novo número
3. **Conversa aparece na aba "Transferidas"** → Para o usuário/departamento de destino
4. **Usuário aceita a conversa** → Status muda para `in_progress`
5. **Conversa vai para "Em Atendimento"** → Usuário pode responder normalmente

### Validações

- ✅ Transferência só é permitida se houver uma conexão válida para o destino
- ✅ A conexão de destino DEVE estar conectada (online)
- ✅ Se não houver conexão válida, a transferência é bloqueada com erro
- ✅ Todas as mensagens antigas têm seu `connectionId` atualizado
- ✅ Histórico de transferências é mantido na tabela `conversation_transfers`

### Interface do Usuário

- **Aguardando** (Laranja): Conversas novas que ainda não foram aceitas
- **Transferidas** (Roxo): Conversas que foram transferidas e aguardam aceitação
- **Em Atendimento** (Verde): Conversas sendo atendidas ativamente

## Rollback (Se Necessário)

Se precisar reverter as mudanças:

```powershell
cd backend
npx prisma migrate resolve --rolled-back add_transferred_status
```

## Testes Recomendados

1. ✅ Transferir conversa entre usuários de departamentos diferentes
2. ✅ Verificar se a conexão muda corretamente
3. ✅ Tentar transferir para conexão desconectada (deve falhar)
4. ✅ Aceitar conversa transferida
5. ✅ Verificar se mensagens antigas mantêm histórico
6. ✅ Verificar se novas mensagens usam a nova conexão

## Suporte

Em caso de problemas, verifique:
- Logs do backend em `backend/logs/`
- Status das conexões WhatsApp
- Permissões de usuários e departamentos
