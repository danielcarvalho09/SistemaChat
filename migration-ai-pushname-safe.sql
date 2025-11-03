-- Migration SEGURA: add_ai_and_pushname
-- Versão que não dá erro se já existir

-- 1. Criar tabela AIAssistant (se não existir)
CREATE TABLE IF NOT EXISTS "ai_assistants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'gpt-4',
    "instructions" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 500,
    "memoryContext" INTEGER NOT NULL DEFAULT 20,
    "memoryCacheDays" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ai_assistants_pkey" PRIMARY KEY ("id")
);

-- 2. Adicionar campo pushName em contacts (se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contacts' AND column_name = 'pushName'
    ) THEN
        ALTER TABLE "contacts" ADD COLUMN "pushName" TEXT;
    END IF;
END $$;

-- 3. Adicionar campos de IA em whatsapp_connections (se não existirem)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'whatsapp_connections' AND column_name = 'aiEnabled'
    ) THEN
        ALTER TABLE "whatsapp_connections" ADD COLUMN "aiEnabled" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'whatsapp_connections' AND column_name = 'aiAssistantId'
    ) THEN
        ALTER TABLE "whatsapp_connections" ADD COLUMN "aiAssistantId" TEXT;
    END IF;
END $$;

-- 4. Criar índices (se não existirem)
CREATE UNIQUE INDEX IF NOT EXISTS "ai_assistants_name_key" ON "ai_assistants"("name");
CREATE INDEX IF NOT EXISTS "ai_assistants_isActive_idx" ON "ai_assistants"("isActive");
CREATE INDEX IF NOT EXISTS "whatsapp_connections_aiEnabled_idx" ON "whatsapp_connections"("aiEnabled");
CREATE INDEX IF NOT EXISTS "whatsapp_connections_aiAssistantId_idx" ON "whatsapp_connections"("aiAssistantId");

-- 5. Adicionar foreign key (apenas se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'whatsapp_connections_aiAssistantId_fkey'
    ) THEN
        ALTER TABLE "whatsapp_connections" 
        ADD CONSTRAINT "whatsapp_connections_aiAssistantId_fkey" 
        FOREIGN KEY ("aiAssistantId") REFERENCES "ai_assistants"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Concluído!
SELECT 'Migration executada com sucesso!' as status;
