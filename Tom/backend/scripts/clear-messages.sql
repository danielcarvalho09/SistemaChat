-- Script para limpar todas as mensagens e conversas
-- USE COM CUIDADO! Isso vai deletar TODOS os dados de conversas e mensagens

-- 1. Desabilitar verificações de chave estrangeira temporariamente
SET session_replication_role = 'replica';

-- 2. Limpar transferências de conversas
DELETE FROM "conversation_transfers";

-- 3. Limpar mensagens
DELETE FROM "messages";

-- 4. Limpar conversas
DELETE FROM "conversations";

-- 5. Limpar contatos (opcional - descomente se quiser limpar contatos também)
-- DELETE FROM "contacts";

-- 6. Reabilitar verificações de chave estrangeira
SET session_replication_role = 'origin';

-- 7. Resetar sequências (se houver)
-- ALTER SEQUENCE messages_id_seq RESTART WITH 1;
-- ALTER SEQUENCE conversations_id_seq RESTART WITH 1;

-- Verificar resultado
SELECT 
  (SELECT COUNT(*) FROM "messages") as total_messages,
  (SELECT COUNT(*) FROM "conversations") as total_conversations,
  (SELECT COUNT(*) FROM "conversation_transfers") as total_transfers;
