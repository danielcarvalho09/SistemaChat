# ⚡ Comandos Rápidos - Troubleshooting

## 🔍 Verificar Conexão "Adriano"

### 1. Ver Status no Banco de Dados
```sql
SELECT 
    id,
    name,
    status,
    "authData" IS NOT NULL as tem_credenciais,
    "lastConnected"
FROM "WhatsAppConnection"
WHERE name ILIKE '%adriano%';
```

### 2. Limpar Credenciais (Forçar Novo QR Code)
```sql
UPDATE "WhatsAppConnection" 
SET "authData" = NULL, 
    status = 'disconnected'
WHERE name ILIKE '%adriano%';
```

### 3. Deletar Conexão Completamente
```sql
DELETE FROM "WhatsAppConnection" 
WHERE name ILIKE '%adriano%';
```

---

## 🔄 Reiniciar Sistema

### Backend
```bash
# Parar (Ctrl+C)
# Iniciar
cd backend
npm run dev
```

### Frontend
```bash
# Parar (Ctrl+C)
# Iniciar
cd frontend
npm run dev
```

---

## 📊 Ver Logs em Tempo Real

### Backend - Filtrar apenas Baileys
```bash
# Windows PowerShell
npm run dev | Select-String "Baileys"
```

### Ver Código de Erro Específico
Procure por:
```
[Baileys] 📊 Status Code: [NÚMERO]
```

---

## 🆘 Reset Completo da Conexão

Execute em sequência:

```sql
-- 1. Deletar conexão
DELETE FROM "WhatsAppConnection" WHERE name = 'adriano';

-- 2. Verificar se deletou
SELECT COUNT(*) FROM "WhatsAppConnection" WHERE name = 'adriano';
-- Deve retornar 0
```

Depois:
1. Frontend → Nova Conexão
2. Nome: `adriano-novo`
3. Conectar → Escanear QR Code

---

## 🔧 Comandos de Debug

### Ver Todas as Conexões
```sql
SELECT id, name, status, "lastConnected" 
FROM "WhatsAppConnection" 
ORDER BY "lastConnected" DESC;
```

### Ver Conexões com Credenciais
```sql
SELECT name, status 
FROM "WhatsAppConnection" 
WHERE "authData" IS NOT NULL;
```

### Ver Última Mensagem de Cada Conexão
```sql
SELECT 
    c.name,
    c.status,
    MAX(m."createdAt") as ultima_mensagem
FROM "WhatsAppConnection" c
LEFT JOIN "Message" m ON m."connectionId" = c.id
GROUP BY c.id, c.name, c.status
ORDER BY ultima_mensagem DESC NULLS LAST;
```
