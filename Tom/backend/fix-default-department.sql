-- Script para corrigir o ID do departamento "Atendimento" de 'default-dept-id' para UUID válido

BEGIN;

-- Gerar um novo UUID para o departamento
-- Você pode usar qualquer UUID válido ou deixar o PostgreSQL gerar
DO $$
DECLARE
  new_uuid UUID := gen_random_uuid();
  old_id TEXT := 'default-dept-id';
BEGIN
  -- Atualizar referências em outras tabelas primeiro
  
  -- 1. Atualizar conversas que usam esse departamento
  UPDATE "Conversation" 
  SET "departmentId" = new_uuid::TEXT 
  WHERE "departmentId" = old_id;
  
  -- 2. Atualizar transferências de conversas
  UPDATE "ConversationTransfer" 
  SET "toDepartmentId" = new_uuid::TEXT 
  WHERE "toDepartmentId" = old_id;
  
  -- 3. Atualizar acesso de usuários aos departamentos
  UPDATE "UserDepartmentAccess" 
  SET "departmentId" = new_uuid::TEXT 
  WHERE "departmentId" = old_id;
  
  -- 4. Atualizar conexões de departamentos
  UPDATE "ConnectionDepartment" 
  SET "departmentId" = new_uuid::TEXT 
  WHERE "departmentId" = old_id;
  
  -- 5. Atualizar templates de mensagem
  UPDATE "MessageTemplate" 
  SET "departmentId" = new_uuid::TEXT 
  WHERE "departmentId" = old_id;
  
  -- 6. Por último, atualizar o próprio departamento
  UPDATE "Department" 
  SET "id" = new_uuid::TEXT 
  WHERE "id" = old_id;
  
  RAISE NOTICE 'Departamento atualizado! Novo ID: %', new_uuid;
END $$;

COMMIT;

-- Verificar se funcionou
SELECT id, name, description FROM "Department" WHERE name = 'Atendimento';
