-- Migration: add_ai_and_pushname
-- Adiciona campos de IA e pushName

-- 1. Criar tabela AIAssistant
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

-- 2. Adicionar campo pushName em contacts
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "pushName" TEXT;

-- 3. Adicionar campos de IA em whatsapp_connections
ALTER TABLE "whatsapp_connections" ADD COLUMN IF NOT EXISTS "aiEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "whatsapp_connections" ADD COLUMN IF NOT EXISTS "aiAssistantId" TEXT;

-- 4. Criar índices
CREATE UNIQUE INDEX IF NOT EXISTS "ai_assistants_name_key" ON "ai_assistants"("name");
CREATE INDEX IF NOT EXISTS "ai_assistants_isActive_idx" ON "ai_assistants"("isActive");
CREATE INDEX IF NOT EXISTS "ai_assistants_name_idx" ON "ai_assistants"("name");
CREATE INDEX IF NOT EXISTS "whatsapp_connections_aiEnabled_idx" ON "whatsapp_connections"("aiEnabled");
CREATE INDEX IF NOT EXISTS "whatsapp_connections_aiAssistantId_idx" ON "whatsapp_connections"("aiAssistantId");

-- 5. Adicionar foreign key
ALTER TABLE "whatsapp_connections" 
ADD CONSTRAINT "whatsapp_connections_aiAssistantId_fkey" 
FOREIGN KEY ("aiAssistantId") 
REFERENCES "ai_assistants"("id") 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- Fim da migration
