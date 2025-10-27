-- Script para identificar e corrigir problemas de conexões

-- 1. Verificar conexões ativas no Baileys mas não no banco
SELECT 'Conexões que deveriam existir:' as info;

-- 2. Listar todas as conexões no banco
SELECT 
    id,
    name,
    "phoneNumber",
    status,
    "isActive"
FROM whatsapp_connections
ORDER BY "createdAt" DESC;

-- 3. Verificar conversas com connectionId inválido
SELECT 'Conversas com connectionId inválido:' as info;
SELECT 
    c.id as conversation_id,
    c."connectionId",
    c.status,
    c."createdAt"
FROM conversations c
LEFT JOIN whatsapp_connections wc ON c."connectionId" = wc.id
WHERE wc.id IS NULL
LIMIT 10;

-- 4. Verificar mensagens com connectionId inválido
SELECT 'Mensagens com connectionId inválido:' as info;
SELECT 
    m.id as message_id,
    m."connectionId",
    m."createdAt"
FROM messages m
LEFT JOIN whatsapp_connections wc ON m."connectionId" = wc.id
WHERE wc.id IS NULL
LIMIT 10;
