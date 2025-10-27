-- ==========================================
-- Script de Setup para Supabase
-- ==========================================
-- Este script cria a estrutura completa do banco de dados no Supabase
-- Execute este script no SQL Editor do Supabase se não quiser usar Prisma Migrate

-- IMPORTANTE: O Prisma já gerencia as migrations automaticamente.
-- Use este script apenas se preferir criar manualmente ou para referência.

-- ==========================================
-- EXTENSÕES
-- ==========================================

-- Habilitar extensão para UUIDs (já vem habilitada no Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Habilitar extensão para busca full-text (opcional)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ==========================================
-- VERIFICAR ESTRUTURA EXISTENTE
-- ==========================================

-- Para verificar se as tabelas já existem:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- ==========================================
-- APLICAR MIGRATIONS DO PRISMA
-- ==========================================

-- A forma recomendada é usar o Prisma CLI:
-- 
-- 1. Configure DATABASE_URL no .env com a connection string do Supabase
-- 2. Execute: npx prisma migrate deploy
-- 
-- Isso aplicará todas as migrations em ordem:
-- - 20251021024413_init
-- - 20251022004243_add_connection_departments
-- - 20251022233839_add_transferred_status
-- - 20251023032250_add_auth_data_field
-- - 20251024221654_add_broadcast_system
-- - 20251025050241_add_kanban_system
-- - 20251026225429_conexoes_relacionadas_usuarios

-- ==========================================
-- CRIAR ROLES E PERMISSÕES PADRÃO
-- ==========================================

-- Inserir roles padrão
INSERT INTO roles (id, name, description, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'admin', 'Administrador do sistema', NOW(), NOW()),
  (gen_random_uuid(), 'user', 'Usuário padrão', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Inserir permissões padrão
INSERT INTO permissions (id, name, description, resource, action, created_at)
VALUES
  -- Conexões
  (gen_random_uuid(), 'manage_connections', 'Gerenciar conexões WhatsApp', 'connections', 'manage', NOW()),
  (gen_random_uuid(), 'view_connections', 'Visualizar conexões WhatsApp', 'connections', 'read', NOW()),
  
  -- Conversas
  (gen_random_uuid(), 'view_all_conversations', 'Visualizar todas as conversas', 'conversations', 'read', NOW()),
  (gen_random_uuid(), 'manage_conversations', 'Gerenciar conversas', 'conversations', 'manage', NOW()),
  
  -- Usuários
  (gen_random_uuid(), 'manage_users', 'Gerenciar usuários', 'users', 'manage', NOW()),
  (gen_random_uuid(), 'view_users', 'Visualizar usuários', 'users', 'read', NOW()),
  
  -- Departamentos
  (gen_random_uuid(), 'manage_departments', 'Gerenciar departamentos', 'departments', 'manage', NOW()),
  (gen_random_uuid(), 'view_departments', 'Visualizar departamentos', 'departments', 'read', NOW()),
  
  -- Mensagens
  (gen_random_uuid(), 'send_messages', 'Enviar mensagens', 'messages', 'create', NOW()),
  (gen_random_uuid(), 'view_messages', 'Visualizar mensagens', 'messages', 'read', NOW()),
  
  -- Broadcast
  (gen_random_uuid(), 'manage_broadcasts', 'Gerenciar broadcasts', 'broadcasts', 'manage', NOW()),
  (gen_random_uuid(), 'send_broadcasts', 'Enviar broadcasts', 'broadcasts', 'create', NOW())
ON CONFLICT (resource, action) DO NOTHING;

-- Associar permissões ao role admin
INSERT INTO role_permissions (id, role_id, permission_id, created_at)
SELECT 
  gen_random_uuid(),
  (SELECT id FROM roles WHERE name = 'admin'),
  p.id,
  NOW()
FROM permissions p
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Associar permissões básicas ao role user
INSERT INTO role_permissions (id, role_id, permission_id, created_at)
SELECT 
  gen_random_uuid(),
  (SELECT id FROM roles WHERE name = 'user'),
  p.id,
  NOW()
FROM permissions p
WHERE p.name IN (
  'view_connections',
  'view_conversations',
  'send_messages',
  'view_messages',
  'view_departments'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ==========================================
-- CRIAR DEPARTAMENTO PADRÃO
-- ==========================================

INSERT INTO departments (id, name, description, color, icon, is_active, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'Geral', 'Departamento padrão', '#3B82F6', 'folder', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- ==========================================
-- CRIAR ETAPAS KANBAN PADRÃO
-- ==========================================

INSERT INTO kanban_stages (id, name, description, color, "order", is_default, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'Novo', 'Conversas não atendidas', '#EF4444', 0, true, NOW(), NOW()),
  (gen_random_uuid(), 'Em Atendimento', 'Conversas sendo atendidas', '#F59E0B', 1, false, NOW(), NOW()),
  (gen_random_uuid(), 'Aguardando Cliente', 'Aguardando resposta do cliente', '#8B5CF6', 2, false, NOW(), NOW()),
  (gen_random_uuid(), 'Resolvido', 'Conversas resolvidas', '#10B981', 3, false, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ==========================================
-- CRIAR USUÁRIO ADMIN PADRÃO
-- ==========================================

-- ATENÇÃO: Altere a senha antes de usar em produção!
-- A senha padrão é: Admin@123
-- Hash bcrypt com 12 rounds

DO $$
DECLARE
  admin_user_id UUID;
  admin_role_id UUID;
BEGIN
  -- Inserir usuário admin
  INSERT INTO users (id, email, password, name, status, is_active, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    'admin@sistema.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5eoWy.Hlsu7su', -- Admin@123
    'Administrador',
    'online',
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (email) DO NOTHING
  RETURNING id INTO admin_user_id;

  -- Se o usuário foi criado, associar role admin
  IF admin_user_id IS NOT NULL THEN
    SELECT id INTO admin_role_id FROM roles WHERE name = 'admin';
    
    INSERT INTO user_roles (id, user_id, role_id, created_at)
    VALUES (gen_random_uuid(), admin_user_id, admin_role_id, NOW())
    ON CONFLICT (user_id, role_id) DO NOTHING;
    
    RAISE NOTICE 'Usuário admin criado com sucesso!';
    RAISE NOTICE 'Email: admin@sistema.com';
    RAISE NOTICE 'Senha: Admin@123';
    RAISE NOTICE 'IMPORTANTE: Altere a senha após o primeiro login!';
  ELSE
    RAISE NOTICE 'Usuário admin já existe.';
  END IF;
END $$;

-- ==========================================
-- ÍNDICES ADICIONAIS PARA PERFORMANCE
-- ==========================================

-- Índices para busca de mensagens
CREATE INDEX IF NOT EXISTS idx_messages_content_trgm ON messages USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm ON contacts USING gin (name gin_trgm_ops);

-- Índices compostos para queries comuns
CREATE INDEX IF NOT EXISTS idx_conversations_status_last_message 
  ON conversations (status, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_timestamp 
  ON messages (conversation_id, timestamp DESC);

-- ==========================================
-- FUNÇÕES ÚTEIS
-- ==========================================

-- Função para limpar mensagens antigas (opcional)
CREATE OR REPLACE FUNCTION clean_old_messages(days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM messages 
  WHERE created_at < NOW() - (days_old || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Função para obter estatísticas de conversas
CREATE OR REPLACE FUNCTION get_conversation_stats()
RETURNS TABLE (
  total_conversations BIGINT,
  waiting_conversations BIGINT,
  in_progress_conversations BIGINT,
  resolved_conversations BIGINT,
  total_messages BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE true) as total_conversations,
    COUNT(*) FILTER (WHERE status = 'waiting') as waiting_conversations,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_conversations,
    COUNT(*) FILTER (WHERE status = 'resolved') as resolved_conversations,
    (SELECT COUNT(*) FROM messages) as total_messages
  FROM conversations;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- POLÍTICAS DE SEGURANÇA (RLS)
-- ==========================================

-- ATENÇÃO: O Supabase recomenda usar Row Level Security (RLS)
-- Para este sistema, como a autenticação é feita no backend,
-- você pode desabilitar RLS ou configurar políticas específicas

-- Desabilitar RLS (se autenticação for apenas no backend)
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
-- ... (repita para todas as tabelas)

-- OU configurar políticas RLS (se usar Supabase Auth)
-- Exemplo:
-- ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
-- 
-- CREATE POLICY "Users can view their own conversations"
--   ON conversations FOR SELECT
--   USING (assigned_user_id = auth.uid());

-- ==========================================
-- VERIFICAÇÃO FINAL
-- ==========================================

-- Verificar tabelas criadas
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Verificar roles criados
SELECT * FROM roles;

-- Verificar permissões criadas
SELECT * FROM permissions;

-- Verificar usuário admin
SELECT 
  u.id,
  u.email,
  u.name,
  r.name as role
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE u.email = 'admin@sistema.com';

-- ==========================================
-- CONCLUÍDO!
-- ==========================================

-- Próximos passos:
-- 1. Faça login com: admin@sistema.com / Admin@123
-- 2. Altere a senha do admin
-- 3. Crie outros usuários conforme necessário
-- 4. Configure os departamentos
-- 5. Adicione conexões WhatsApp
