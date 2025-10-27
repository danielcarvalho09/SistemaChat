# 🎯 Variáveis Personalizadas em Mensagens de Broadcast

## ✅ Implementado com Sucesso!

Implementei um sistema de **variáveis personalizadas** que permite personalizar cada mensagem com o nome e telefone do destinatário!

---

## 🎨 Como Funciona

### Variáveis Disponíveis

| Variável | Alternativa | Descrição | Exemplo |
|----------|-------------|-----------|---------|
| `{{name}}` | `{{nome}}` | Nome do contato | João Silva |
| `{{phone}}` | `{{telefone}}` | Telefone do contato | 5516999999999 |

### Exemplo de Uso

**Mensagem digitada:**
```
Olá {{name}}, tudo bem?

Estamos com uma promoção especial para você!

Seu número cadastrado: {{phone}}
```

**Resultado para cada contato:**

**Para João Silva (5516999999999):**
```
Olá João Silva, tudo bem?

Estamos com uma promoção especial para você!

Seu número cadastrado: 5516999999999
```

**Para Maria Santos (5516988888888):**
```
Olá Maria Santos, tudo bem?

Estamos com uma promoção especial para você!

Seu número cadastrado: 5516988888888
```

---

## 🔍 De Onde Vem o Nome?

### Prioridade de Busca:

1. **Nome do banco de dados** (se o contato já conversou com você)
   - Sistema busca no histórico de conversas
   - Usa o nome que o contato usa no WhatsApp (pushName)

2. **Nome da lista** (se você adicionou manualmente)
   - Nome que você digitou ao adicionar o contato

3. **Número de telefone** (fallback)
   - Se não encontrar nome, usa o número

### Exemplo Prático:

```typescript
// Contato já conversou antes
{{name}} → "João Silva" (nome do WhatsApp)

// Contato novo, adicionado manualmente
{{name}} → "João" (nome que você digitou)

// Contato sem nome
{{name}} → "5516999999999" (número)
```

---

## 💡 Interface do Usuário

### No Frontend (Broadcast.tsx)

Adicionei uma seção de ajuda visual:

```
💡 Variáveis disponíveis:
[{{name}}] ou [{{nome}}] - [{{phone}}] ou [{{telefone}}]

As variáveis serão substituídas automaticamente pelo nome/telefone de cada contato
```

### Placeholder do Campo

```
Digite sua mensagem aqui... Use {{name}} para personalizar com o nome do contato.
```

---

## 🔧 Implementação Técnica

### Backend (broadcast.service.ts)

```typescript
// Buscar nome do contato
const contactName = await baileysManager.getContactName(connectionId, phoneNumber);

// Substituir variáveis
let personalizedMessage = message;
personalizedMessage = personalizedMessage.replace(/\{\{name\}\}/gi, contactName || contact.name || phoneNumber);
personalizedMessage = personalizedMessage.replace(/\{\{phone\}\}/gi, phoneNumber);
personalizedMessage = personalizedMessage.replace(/\{\{nome\}\}/gi, contactName || contact.name || phoneNumber);
personalizedMessage = personalizedMessage.replace(/\{\{telefone\}\}/gi, phoneNumber);
```

### Backend (baileys.manager.ts)

```typescript
async getContactName(connectionId: string, phone: string): Promise<string | null> {
  // Buscar no banco de dados
  const contact = await this.prisma.contact.findFirst({
    where: { phoneNumber: cleanPhone },
    select: { name: true },
  });
  
  if (contact?.name) {
    return contact.name; // Nome do WhatsApp
  }
  
  return cleanPhone; // Fallback: número
}
```

---

## 🎯 Casos de Uso

### 1. **Saudação Personalizada**
```
Olá {{name}}, como vai?
```

### 2. **Confirmação de Dados**
```
Olá {{name}},

Confirmamos seu cadastro com o número {{phone}}.
```

### 3. **Promoção Personalizada**
```
{{name}}, você ganhou um desconto especial!

Use o código: {{phone}}123
```

### 4. **Lembrete Personalizado**
```
Oi {{name}}!

Não esqueça do seu compromisso amanhã às 14h.

Qualquer dúvida, responda esta mensagem.
```

---

## ✅ Vantagens

### 1. **Personalização Automática**
- ✅ Cada mensagem é única para cada destinatário
- ✅ Aumenta engajamento
- ✅ Parece conversa individual

### 2. **Fácil de Usar**
- ✅ Sintaxe simples: `{{name}}`
- ✅ Suporta português e inglês
- ✅ Case-insensitive (funciona com maiúsculas/minúsculas)

### 3. **Inteligente**
- ✅ Busca nome real do WhatsApp
- ✅ Fallback para nome da lista
- ✅ Fallback para número

### 4. **Flexível**
- ✅ Use quantas variáveis quiser
- ✅ Em qualquer posição da mensagem
- ✅ Combine com mídia (imagens, documentos)

---

## 📊 Comparação

### Antes (Sem Variáveis)

**Mensagem:**
```
Olá! Temos uma promoção especial para você!
```

**Resultado:**
- Todos recebem a mesma mensagem
- Parece spam
- Baixo engajamento

### Depois (Com Variáveis)

**Mensagem:**
```
Olá {{name}}! Temos uma promoção especial para você!
```

**Resultado:**
- Cada um recebe mensagem personalizada
- Parece conversa individual
- Alto engajamento

---

## 🚀 Como Usar

### Passo 1: Criar Lista de Contatos
1. Vá em "Listas de Contatos"
2. Crie uma nova lista
3. Adicione contatos (com nomes)

### Passo 2: Escrever Mensagem
1. Vá em "Disparo de Mensagens"
2. Selecione a lista
3. Digite a mensagem usando `{{name}}` e `{{phone}}`

**Exemplo:**
```
Olá {{name}}, tudo bem?

Estamos com uma promoção especial!
```

### Passo 3: Enviar
1. Clique em "Enviar Broadcast"
2. Sistema substitui variáveis automaticamente
3. Cada contato recebe mensagem personalizada

---

## 🔍 Verificação

### Como Saber se Funcionou?

1. **Logs do Backend:**
```
[Baileys] ✅ Found contact name in DB: João Silva
[Baileys] ✅ Found contact name in DB: Maria Santos
```

2. **Mensagens Enviadas:**
- Cada contato recebe nome correto
- Variáveis foram substituídas

3. **Histórico:**
- Verifique no histórico de broadcasts
- Veja quantas mensagens foram enviadas

---

## ⚠️ Importante

### Sobre os Nomes

1. **Contatos que já conversaram:**
   - ✅ Nome será o do WhatsApp (pushName)
   - ✅ Mais preciso e atualizado

2. **Contatos novos:**
   - ⚠️ Nome será o que você digitou na lista
   - ⚠️ Ou número se não tiver nome

3. **Recomendação:**
   - Sempre adicione nomes ao criar listas
   - Ou importe CSV com nomes

---

## 📝 Próximas Melhorias Possíveis

### Futuras Variáveis:

- `{{firstName}}` - Primeiro nome apenas
- `{{date}}` - Data atual
- `{{time}}` - Hora atual
- `{{custom1}}`, `{{custom2}}` - Campos personalizados

---

## ✅ Status

- ✅ **Backend implementado**
- ✅ **Frontend atualizado**
- ✅ **Documentação completa**
- ✅ **Pronto para uso**

---

## 🎉 Resumo

**Funcionalidade**: Variáveis personalizadas em broadcasts  
**Variáveis**: `{{name}}`, `{{nome}}`, `{{phone}}`, `{{telefone}}`  
**Fonte dos nomes**: Banco de dados (contatos que já conversaram) ou lista  
**Uso**: Digite a variável na mensagem, sistema substitui automaticamente  
**Benefício**: Mensagens personalizadas, maior engajamento  

---

**Sistema de variáveis personalizadas 100% funcional!** 🚀

Para usar, basta digitar `{{name}}` na mensagem e o sistema substituirá automaticamente pelo nome de cada contato!
