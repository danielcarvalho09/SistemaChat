-- Limpar credenciais antigas do Baileys para forçar novo QR Code

UPDATE whatsapp_connections 
SET 
  "authData" = NULL,
  "sessionData" = NULL,
  status = 'disconnected',
  "qrCode" = NULL
WHERE status != 'connected';

-- Verificar resultado
SELECT id, name, "phoneNumber", status, 
       CASE WHEN "authData" IS NULL THEN 'SEM CREDENCIAIS' ELSE 'COM CREDENCIAIS' END as auth_status
FROM whatsapp_connections;
