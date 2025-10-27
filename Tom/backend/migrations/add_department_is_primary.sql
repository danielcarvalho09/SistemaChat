-- ==========================================
-- Migration: Setor Principal + Fix Kanban
-- Execute no Supabase SQL Editor
-- ==========================================

-- 1. Adicionar coluna isPrimary em departments
ALTER TABLE departments 
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false NOT NULL;

-- Comentário explicativo
COMMENT ON COLUMN departments.is_primary IS 'Setor principal/exclusivo - usuários só podem estar neste setor';

-- 2. Criar etapa padrão do Kanban se não existir
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM kanban_stages WHERE "isDefault" = true) THEN
    INSERT INTO kanban_stages (id, name, description, color, "order", "isDefault", "createdAt", "updatedAt")
    VALUES (
      gen_random_uuid(),
      'Novo',
      'Conversas novas',
      '#10B981',
      0,
      true,
      NOW(),
      NOW()
    );
    RAISE NOTICE 'Etapa padrão "Novo" criada';
  ELSE
    RAISE NOTICE 'Etapa padrão já existe';
  END IF;
END $$;

-- 3. Atribuir etapa padrão às conversas sem kanbanStageId
UPDATE conversations 
SET "kanbanStageId" = (SELECT id FROM kanban_stages WHERE "isDefault" = true LIMIT 1)
WHERE "kanbanStageId" IS NULL;

-- 4. Verificar resultados
SELECT 
  'Departments' as tabela,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_primary = true) as principais
FROM departments
UNION ALL
SELECT 
  'Kanban Stages' as tabela,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE "isDefault" = true) as padroes
FROM kanban_stages
UNION ALL
SELECT 
  'Conversations sem stage' as tabela,
  COUNT(*) as total,
  0 as principais
FROM conversations
WHERE "kanbanStageId" IS NULL;
