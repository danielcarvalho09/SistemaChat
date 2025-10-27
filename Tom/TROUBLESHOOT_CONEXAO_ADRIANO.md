# 🔧 Troubleshooting - Conexão "Adriano" Desconectando

## 🐛 Problema Identificado

A conexão "adriano" está desconectando imediatamente após clicar em "Conectar".

**Log do Frontend:**
```
❌ WhatsApp desconectado: 7fc2f093-262c-48f3-b05b-daaa112da6c0
```

---

## 🔍 Diagnóstico

### Passo 1: Verificar Logs do Backend

**IMPORTANTE:** Olhe os logs do backend quando clicar em "Conectar". Procure por:

```
[Baileys] ❌ Connection closed: 7fc2f093-262c-48f3-b05b-daaa112da6c0
[Baileys] 📊 Status Code: [NÚMERO]
[Baileys] 📝 Error Message: [MENSAGEM]
```

### Códigos de Erro Comuns:

| Código | Significado | Solução |
|--------|-------------|---------|
| **401** | Logged Out - Desconectado no celular | Escanear QR Code novamente |
| **400** | Bad Session - Sessão inválida | Deletar conexão e criar nova |
| **440** | Restart Required - Normal após QR scan | Aguardar reconexão automática |
| **408** | Timed Out - Timeout de conexão | Verificar internet e tentar novamente |
| **500** | Internal Error - Erro interno | Verificar logs detalhados |
| **undefined** | Sem código - Erro desconhecido | Ver mensagem de erro completa |

---

## 🛠️ Soluções por Cenário

### Cenário 1: Conexão NUNCA foi conectada antes (Primeira vez)

**Sintomas:**
- Clica em "Conectar"
- QR Code aparece
- Escaneia QR Code
- Desconecta imediatamente

**Causa:** Pode ser problema de credenciais ou sessão.

**Solução:**
1. **Deletar a conexão atual:**
   - Frontend → Conexões → Encontre "adriano"
   - Clique em "Deletar"
   - Confirme

2. **Criar nova conexão:**
   - Clique em "Nova Conexão"
   - Nome: `adriano-novo`
   - Número: (mesmo número)
   - Salvar

3. **Conectar:**
   - Clique em "Conectar"
   - Escaneie o QR Code
   - Aguarde 5-10 segundos
   - Deve conectar com sucesso

---

### Cenário 2: Conexão JÁ foi conectada antes (Tem credenciais)

**Sintomas:**
- Conexão já funcionou antes
- Agora não conecta mais
- Desconecta imediatamente

**Causa:** Credenciais expiradas ou WhatsApp desconectado no celular.

**Solução A - Verificar WhatsApp no Celular:**
1. Abrir WhatsApp no celular
2. Ir em **Configurações** (⚙️)
3. **Aparelhos conectados**
4. Procurar por **"WhatsApp Multi-Device"**
5. Se não estiver lá → Precisa reconectar
6. Se estiver lá mas inativo → Remover e reconectar

**Solução B - Limpar Credenciais:**
```sql
-- Execute no banco de dados PostgreSQL
UPDATE "WhatsAppConnection" 
SET "authData" = NULL, 
    status = 'disconnected'
WHERE id = '7fc2f093-262c-48f3-b05b-daaa112da6c0';
```

Depois:
1. Frontend → Conexões → "adriano"
2. Clique em "Conectar"
3. Escaneie novo QR Code
4. Aguarde conexão

---

### Cenário 3: Erro 401 (Logged Out)

**Sintomas:**
```
[Baileys] 📊 Status Code: 401
[Baileys] Logged out: [id]
```

**Causa:** WhatsApp foi desconectado manualmente no celular.

**Solução:**
1. Verificar no celular se o dispositivo foi removido
2. Limpar credenciais (SQL acima)
3. Reconectar e escanear novo QR Code

---

### Cenário 4: Erro 400 (Bad Session)

**Sintomas:**
```
[Baileys] 📊 Status Code: 400
[Baileys] ⏭️ Skipping reconnection: bad session
```

**Causa:** Sessão corrompida ou inválida.

**Solução:**
1. **Deletar a conexão completamente**
2. **Criar nova conexão** com nome diferente
3. **Conectar e escanear QR Code**

---

### Cenário 5: Timeout ou Erro de Rede

**Sintomas:**
```
[Baileys] 📊 Status Code: 408
[Baileys] 📝 Error Message: Connection timed out
```

**Causa:** Problema de internet ou firewall.

**Solução:**
1. Verificar conexão com internet
2. Verificar se firewall está bloqueando
3. Tentar novamente em alguns minutos
4. Verificar se WhatsApp está funcionando no celular

---

## 🔬 Debug Avançado

### 1. Verificar Estado da Conexão no Banco

```sql
SELECT 
    id,
    name,
    phoneNumber,
    status,
    CASE 
        WHEN "authData" IS NOT NULL THEN 'Sim'
        ELSE 'Não'
    END as "Tem Credenciais",
    LENGTH("authData"::text) as "Tamanho authData",
    "lastConnected",
    "createdAt"
FROM "WhatsAppConnection"
WHERE id = '7fc2f093-262c-48f3-b05b-daaa112da6c0';
```

### 2. Ver Logs Completos do Backend

No terminal do backend, procure por:
```
[Baileys] Creating client for connection: 7fc2f093-262c-48f3-b05b-daaa112da6c0
[Baileys] ✅ Loaded existing auth (tem credenciais)
OU
[Baileys] 🆕 Created NEW auth (vai gerar QR Code)
```

### 3. Verificar Eventos WebSocket

No console do navegador (F12):
```javascript
// Ver se está recebendo eventos
socket.on('whatsapp_qr_code', (data) => console.log('QR:', data))
socket.on('whatsapp_connecting', (data) => console.log('Connecting:', data))
socket.on('whatsapp_connected', (data) => console.log('Connected:', data))
socket.on('whatsapp_disconnected', (data) => console.log('Disconnected:', data))
```

---

## 📋 Checklist de Verificação

Antes de tentar reconectar, verifique:

- [ ] Backend está rodando sem erros
- [ ] Frontend está rodando sem erros
- [ ] WhatsApp está funcionando no celular
- [ ] Internet está funcionando
- [ ] Não há firewall bloqueando
- [ ] Verificou logs do backend
- [ ] Verificou console do navegador (F12)
- [ ] Verificou "Aparelhos conectados" no WhatsApp
- [ ] Tentou deletar e recriar a conexão

---

## 🚀 Solução Rápida (Última Opção)

Se NADA funcionar, faça um reset completo:

### 1. Deletar Conexão Atual
```sql
DELETE FROM "WhatsAppConnection" 
WHERE id = '7fc2f093-262c-48f3-b05b-daaa112da6c0';
```

### 2. Reiniciar Backend
```bash
# Pare o backend (Ctrl+C)
# Inicie novamente
npm run dev
```

### 3. Criar Nova Conexão
- Frontend → Nova Conexão
- Nome: `adriano-v2`
- Número: (mesmo número)
- Salvar

### 4. Conectar
- Clique em "Conectar"
- Escaneie QR Code
- Aguarde 10 segundos
- Deve funcionar!

---

## 📞 Informações para Suporte

Se precisar de ajuda, forneça:

1. **Logs do backend** (últimas 50 linhas após clicar em "Conectar")
2. **Console do navegador** (F12 → Console)
3. **Resultado do SQL:**
   ```sql
   SELECT * FROM "WhatsAppConnection" 
   WHERE id = '7fc2f093-262c-48f3-b05b-daaa112da6c0';
   ```
4. **Status no WhatsApp do celular** (Aparelhos conectados)
5. **Já funcionou antes?** Sim ou Não
6. **Quando parou de funcionar?**

---

## 🎯 Próximos Passos

1. **Verifique os logs do backend** quando clicar em "Conectar"
2. **Identifique o código de erro** (401, 400, 408, etc)
3. **Siga a solução** correspondente ao código
4. **Se não funcionar**, delete e recrie a conexão
5. **Documente** o que aconteceu para análise

---

## 💡 Dica Final

A causa mais comum é:
- **Primeira conexão:** Problema de rede ou timeout
- **Reconexão:** Credenciais expiradas ou WhatsApp desconectado no celular

**Solução mais eficaz:** Deletar e recriar a conexão com nome diferente.
