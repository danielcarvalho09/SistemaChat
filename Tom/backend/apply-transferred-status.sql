-- Migração manual para adicionar suporte ao status 'transferred'
-- Execute este script diretamente no PostgreSQL se quiser evitar reset

-- Não há mudanças estruturais necessárias no banco
-- O campo 'status' já é VARCHAR e aceita qualquer valor
-- Apenas precisamos garantir que a aplicação reconheça o novo status

-- Verificar se há conversas que precisam ser marcadas como transferred
-- (Opcional - apenas se você quiser atualizar conversas existentes)
-- UPDATE conversations 
-- SET status = 'transferred' 
-- WHERE id IN (
--   SELECT DISTINCT conversation_id 
--   FROM conversation_transfers 
--   WHERE transferred_at > NOW() - INTERVAL '1 day'
-- ) 
-- AND status = 'waiting';

SELECT 'Status transferred adicionado com sucesso!' as message;
