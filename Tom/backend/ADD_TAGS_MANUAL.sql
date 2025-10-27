-- Adicionar campos de monitoramento na tabela conversations (se existir)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations') THEN
        -- Adicionar isMonitored se não existir
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'isMonitored') THEN
            ALTER TABLE "conversations" ADD COLUMN "isMonitored" BOOLEAN NOT NULL DEFAULT false;
        END IF;
        
        -- Adicionar monitoredBy se não existir
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'monitoredBy') THEN
            ALTER TABLE "conversations" ADD COLUMN "monitoredBy" TEXT;
        END IF;
        
        -- Criar índice se não existir
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'conversations_isMonitored_idx') THEN
            CREATE INDEX "conversations_isMonitored_idx" ON "conversations"("isMonitored");
        END IF;
    END IF;
END $$;

-- Criar tabela tags se não existir
CREATE TABLE IF NOT EXISTS "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "createdBy" TEXT,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- Criar tabela conversation_tags se não existir
CREATE TABLE IF NOT EXISTS "conversation_tags" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "addedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversation_tags_pkey" PRIMARY KEY ("id")
);

-- Criar índices e constraints apenas se não existirem
DO $$
BEGIN
    -- Unique constraint para tags
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'tags_name_createdBy_key') THEN
        CREATE UNIQUE INDEX "tags_name_createdBy_key" ON "tags"("name", "createdBy");
    END IF;
    
    -- Índices para tags
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'tags_isGlobal_idx') THEN
        CREATE INDEX "tags_isGlobal_idx" ON "tags"("isGlobal");
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'tags_createdBy_idx') THEN
        CREATE INDEX "tags_createdBy_idx" ON "tags"("createdBy");
    END IF;
    
    -- Unique constraint para conversation_tags
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'conversation_tags_conversationId_tagId_key') THEN
        CREATE UNIQUE INDEX "conversation_tags_conversationId_tagId_key" ON "conversation_tags"("conversationId", "tagId");
    END IF;
    
    -- Índices para conversation_tags
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'conversation_tags_conversationId_idx') THEN
        CREATE INDEX "conversation_tags_conversationId_idx" ON "conversation_tags"("conversationId");
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'conversation_tags_tagId_idx') THEN
        CREATE INDEX "conversation_tags_tagId_idx" ON "conversation_tags"("tagId");
    END IF;
END $$;

-- Adicionar foreign keys apenas se não existirem
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'conversation_tags_conversationId_fkey') THEN
            ALTER TABLE "conversation_tags" ADD CONSTRAINT "conversation_tags_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'conversation_tags_tagId_fkey') THEN
        ALTER TABLE "conversation_tags" ADD CONSTRAINT "conversation_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
