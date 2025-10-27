-- Script para configurar setores e conexão matriz

-- 1. Marcar conexão existente como Matriz
UPDATE whatsapp_connections 
SET "isMatriz" = true 
WHERE id = 'dfb4ecc9-de67-4f00-96d3-94e22e36c9cc';

-- 2. Criar setores (se não existirem)
INSERT INTO departments (id, name, description, color, icon, "isActive", "createdAt", "updatedAt")
VALUES 
  (gen_random_uuid(), 'Comercial', 'Setor comercial e vendas', '#10B981', 'briefcase', true, NOW(), NOW()),
  (gen_random_uuid(), 'RH', 'Recursos Humanos', '#3B82F6', 'users', true, NOW(), NOW()),
  (gen_random_uuid(), 'Recepção', 'Atendimento geral e recepção', '#F59E0B', 'phone', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- 3. Adicionar Daniel (admin) a todos os setores
-- Primeiro, vamos buscar o ID do Daniel
DO $$ 
DECLARE
    daniel_id TEXT;
    dept_id TEXT;
BEGIN
    -- Buscar ID do Daniel
    SELECT id INTO daniel_id FROM users WHERE email = 'daniel@example.com' LIMIT 1;
    
    IF daniel_id IS NOT NULL THEN
        -- Adicionar Daniel a todos os setores
        FOR dept_id IN SELECT id FROM departments WHERE "isActive" = true
        LOOP
            INSERT INTO user_department_access (id, "userId", "departmentId", "createdAt")
            VALUES (gen_random_uuid(), daniel_id, dept_id, NOW())
            ON CONFLICT ("userId", "departmentId") DO NOTHING;
        END LOOP;
        
        RAISE NOTICE 'Daniel adicionado a todos os setores';
    ELSE
        RAISE NOTICE 'Usuário Daniel não encontrado';
    END IF;
END $$;

-- 4. Verificar resultados
SELECT 
    'Conexões' as tipo,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE "isMatriz" = true) as matriz
FROM whatsapp_connections
UNION ALL
SELECT 
    'Setores' as tipo,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE "isActive" = true) as ativos
FROM departments
UNION ALL
SELECT 
    'Usuários com acesso' as tipo,
    COUNT(DISTINCT "userId") as total,
    COUNT(*) as acessos
FROM user_department_access;
