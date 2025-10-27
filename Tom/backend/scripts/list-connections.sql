-- Script para listar todas as conexões WhatsApp
-- Execute para ver quais conexões existem

SELECT 
    id,
    name,
    "phoneNumber",
    status,
    "isActive",
    "createdAt"
FROM "whatsapp_connections"
ORDER BY "createdAt" DESC;

-- Ver quantas conversas cada conexão tem
SELECT 
    wc.name,
    wc."phoneNumber",
    COUNT(c.id) as total_conversations
FROM "whatsapp_connections" wc
LEFT JOIN "conversations" c ON c."connectionId" = wc.id
GROUP BY wc.id, wc.name, wc."phoneNumber"
ORDER BY total_conversations DESC;

-- Ver quais departamentos usam cada conexão
SELECT 
    wc.name as connection_name,
    d.name as department_name
FROM "whatsapp_connections" wc
LEFT JOIN "connection_departments" cd ON cd."connectionId" = wc.id
LEFT JOIN "departments" d ON d.id = cd."departmentId"
ORDER BY wc.name;
