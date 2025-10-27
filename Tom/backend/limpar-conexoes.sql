-- Limpar TODAS as conexões WhatsApp e dados relacionados

-- 1. Apagar todas as mensagens
DELETE FROM "Message";

-- 2. Apagar todas as conversas
DELETE FROM "Conversation";

-- 3. Apagar todos os contatos
DELETE FROM "Contact";

-- 4. Apagar todas as conexões WhatsApp
DELETE FROM "WhatsAppConnection";

-- Verificar resultado
SELECT 'Conexões restantes: ' || COUNT(*) as resultado FROM "WhatsAppConnection";
SELECT 'Conversas restantes: ' || COUNT(*) as resultado FROM "Conversation";
SELECT 'Mensagens restantes: ' || COUNT(*) as resultado FROM "Message";
SELECT 'Contatos restantes: ' || COUNT(*) as resultado FROM "Contact";
