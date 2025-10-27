-- 🔍 Script para Verificar Estado das Conexões WhatsApp

-- 1. Listar todas as conexões com informações importantes
SELECT 
    id,
    name,
    phoneNumber,
    status,
    CASE 
        WHEN "authData" IS NOT NULL THEN '✅ Sim'
        ELSE '❌ Não'
    END as "Tem Credenciais",
    LENGTH("authData"::text) as "Tamanho authData",
    "lastConnected",
    "createdAt",
    "updatedAt"
FROM "WhatsAppConnection"
ORDER BY "createdAt" DESC;

-- 2. Contar conexões por status
SELECT 
    status,
    COUNT(*) as total
FROM "WhatsAppConnection"
GROUP BY status;

-- 3. Conexões que DEVEM reconectar automaticamente
-- (têm credenciais salvas)
SELECT 
    id,
    name,
    phoneNumber,
    status,
    "lastConnected"
FROM "WhatsAppConnection"
WHERE "authData" IS NOT NULL
ORDER BY "lastConnected" DESC;

-- 4. Conexões que NÃO vão reconectar
-- (não têm credenciais)
SELECT 
    id,
    name,
    phoneNumber,
    status,
    "createdAt"
FROM "WhatsAppConnection"
WHERE "authData" IS NULL;

-- 5. Buscar conexão específica "adriano"
SELECT 
    id,
    name,
    phoneNumber,
    status,
    CASE 
        WHEN "authData" IS NOT NULL THEN '✅ Tem credenciais (vai reconectar)'
        ELSE '❌ SEM credenciais (precisa escanear QR)'
    END as "Status Reconexão",
    "lastConnected",
    "createdAt"
FROM "WhatsAppConnection"
WHERE name ILIKE '%adriano%';

-- 6. Atualizar status de uma conexão manualmente (se necessário)
-- DESCOMENTE para usar:
-- UPDATE "WhatsAppConnection" 
-- SET status = 'disconnected' 
-- WHERE name = 'adriano';

-- 7. Deletar authData de uma conexão (forçar novo QR Code)
-- CUIDADO: Isso vai exigir escanear QR Code novamente!
-- DESCOMENTE para usar:
-- UPDATE "WhatsAppConnection" 
-- SET "authData" = NULL, status = 'disconnected'
-- WHERE name = 'adriano';

-- 8. Verificar última atividade de cada conexão
SELECT 
    c.name as "Conexão",
    c.status as "Status",
    c."lastConnected" as "Última Conexão",
    COUNT(m.id) as "Total Mensagens",
    MAX(m."createdAt") as "Última Mensagem"
FROM "WhatsAppConnection" c
LEFT JOIN "Message" m ON m."connectionId" = c.id
GROUP BY c.id, c.name, c.status, c."lastConnected"
ORDER BY "Última Mensagem" DESC NULLS LAST;
