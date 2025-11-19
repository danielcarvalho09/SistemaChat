-- Script SQL para adicionar coluna senderName na tabela messages
-- Execute este script diretamente no Supabase SQL Editor

-- Adicionar coluna senderName (nullable, para não quebrar dados existentes)
ALTER TABLE "messages" 
ADD COLUMN IF NOT EXISTS "senderName" TEXT;

-- Comentário explicativo
COMMENT ON COLUMN "messages"."senderName" IS 'Nome do remetente (usado em grupos para identificar quem enviou a mensagem)';

-- Verificar se a coluna foi criada corretamente
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name = 'senderName';

