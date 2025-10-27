-- Verificar se a conexão existe
SELECT id, name, "phoneNumber", status 
FROM whatsapp_connections 
WHERE id = '98f6d09a-2e3f-4e9f-a5c7-ffaa8d0beecc';

-- Listar todas as conexões
SELECT id, name, "phoneNumber", status, "isActive"
FROM whatsapp_connections
ORDER BY "createdAt" DESC;
