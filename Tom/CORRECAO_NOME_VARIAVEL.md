# 🔧 Correção: Variável {{name}} Retornando Número

## ❌ Problema

Ao usar `{{name}}` na mensagem, estava retornando o número (ex: `5516997608530`) ao invés do nome.

## 🔍 Causa

A lógica de prioridade estava **invertida**:

### Antes (Errado):
```typescript
const contactName = await baileysManager.getContactName(connectionId, phoneNumber);
// getContactName retorna o número se não encontrar nome no banco
personalizedMessage = personalizedMessage.replace(/\{\{name\}\}/gi, contactName || contact.name || phoneNumber);
// ❌ Priorizava contactName (que era o número) ao invés de contact.name
```

**Fluxo errado:**
1. Busca no banco de dados
2. Não encontra (contato novo)
3. Retorna número como fallback
4. Usa o número ao invés do nome da lista

## ✅ Solução

Inverti a prioridade para usar o **nome da lista primeiro**:

### Depois (Correto):
```typescript
const contactName = await baileysManager.getContactName(connectionId, phoneNumber);
const finalName = contact.name || (contactName !== phoneNumber ? contactName : null) || phoneNumber;
personalizedMessage = personalizedMessage.replace(/\{\{name\}\}/gi, finalName);
```

**Fluxo correto:**
1. ✅ **Primeiro**: Usa `contact.name` (nome que você digitou na lista)
2. ✅ **Segundo**: Usa `contactName` do banco (se já conversou E não for número)
3. ✅ **Terceiro**: Usa `phoneNumber` (fallback final)

## 📊 Prioridade de Busca

| Prioridade | Fonte | Quando Usar | Exemplo |
|------------|-------|-------------|---------|
| 1️⃣ | `contact.name` | Nome da lista | "João Silva" |
| 2️⃣ | `contactName` (banco) | Se já conversou | "João" (pushName) |
| 3️⃣ | `phoneNumber` | Fallback | "5516997608530" |

## 🎯 Exemplos

### Cenário 1: Contato com Nome na Lista
```typescript
contact.name = "João Silva"
contactName = "5516997608530" (não encontrou no banco)

finalName = "João Silva" ✅
```

### Cenário 2: Contato que Já Conversou
```typescript
contact.name = null (não tem nome na lista)
contactName = "João" (encontrou no banco)

finalName = "João" ✅
```

### Cenário 3: Contato Sem Nome
```typescript
contact.name = null
contactName = "5516997608530" (não encontrou)

finalName = "5516997608530" ✅ (fallback)
```

### Cenário 4: Ambos Disponíveis
```typescript
contact.name = "João Silva" (nome completo na lista)
contactName = "João" (apelido no WhatsApp)

finalName = "João Silva" ✅ (prioriza lista)
```

## 🔧 Código Completo

```typescript
// Buscar nome do contato
// Prioridade: 1. Nome da lista, 2. Nome do banco (se já conversou), 3. Número
const contactName = await baileysManager.getContactName(connectionId, phoneNumber);
const finalName = contact.name || (contactName !== phoneNumber ? contactName : null) || phoneNumber;

// Substituir variáveis na mensagem
let personalizedMessage = message;
personalizedMessage = personalizedMessage.replace(/\{\{name\}\}/gi, finalName);
personalizedMessage = personalizedMessage.replace(/\{\{phone\}\}/gi, phoneNumber);
personalizedMessage = personalizedMessage.replace(/\{\{nome\}\}/gi, finalName);
personalizedMessage = personalizedMessage.replace(/\{\{telefone\}\}/gi, phoneNumber);
```

## 💡 Recomendação

### Sempre Adicione Nomes nas Listas!

Ao criar listas de contatos, **sempre preencha o campo nome**:

```
Nome: João Silva
Telefone: 5516997608530
```

**Benefícios:**
- ✅ Mensagens mais personalizadas
- ✅ Não depende do banco de dados
- ✅ Você controla o nome exato que aparece

### Importação CSV

Use CSV com nomes:
```csv
name,phone
João Silva,5516997608530
Maria Santos,5516988888888
Pedro Oliveira,5516977777777
```

## 🚀 Como Testar

### Teste 1: Com Nome na Lista
1. Criar lista
2. Adicionar contato com **nome**:
   - Nome: "João Silva"
   - Telefone: "5516997608530"
3. Enviar broadcast com `{{name}}`
4. **Resultado**: "João Silva" ✅

### Teste 2: Sem Nome na Lista
1. Adicionar contato **sem nome**:
   - Nome: (vazio)
   - Telefone: "5516997608530"
2. Enviar broadcast com `{{name}}`
3. **Resultado**: "5516997608530" (número) ⚠️

### Teste 3: Contato que Já Conversou
1. Contato sem nome na lista
2. Mas já conversou antes (está no banco)
3. Enviar broadcast com `{{name}}`
4. **Resultado**: Nome do WhatsApp ✅

## ✅ Status

- ✅ **Correção aplicada**
- ✅ **Prioridade invertida**
- ✅ **Nome da lista tem prioridade**
- ✅ **Fallback inteligente**

## 📝 Resumo

**Problema**: `{{name}}` retornava número  
**Causa**: Prioridade errada (banco antes da lista)  
**Solução**: Priorizar nome da lista  
**Resultado**: Agora usa o nome que você digitou! ✅

---

**Agora `{{name}}` vai usar o nome da lista primeiro!** 🎉

Lembre-se de sempre adicionar nomes ao criar listas de contatos para melhor personalização.
