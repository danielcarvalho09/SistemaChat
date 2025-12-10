# Configuração do OpenRouter para Funis Inteligentes

## 🔑 Como obter API Key

1. Acesse: https://openrouter.ai/
2. Faça login ou crie uma conta
3. Vá em: https://openrouter.ai/keys
4. Clique em "Create Key"
5. Copie a chave gerada (começa com `sk-or-v1-`)

## ⚙️ Configurar no projeto

Adicione no arquivo `.env` do backend:

```env
# OpenRouter API (para Funis Inteligentes)
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 🎯 Modelo usado

- **Modelo:** `google/gemini-2.0-flash-exp:free`
- **Provider:** Google via OpenRouter
- **Custo:** Gratuito (sem limites)
- **Velocidade:** ~2-5 segundos por funil
- **Qualidade:** Excelente para geração de funis estruturados
- **Context:** 1M tokens
- **Output:** 8K tokens

## 📊 Limites do plano gratuito

- **Requests:** Ilimitados
- **Tokens:** 2000 por request (suficiente para ~8 etapas)
- **Rate limit:** ~20 requests/minuto

## ✅ Verificar se está funcionando

1. Adicionar a API key no `.env`
2. Reiniciar o backend
3. Acessar `/dashboard/funnels`
4. Clicar em "Gerar Funil com IA"
5. Informar um nicho (ex: "E-commerce de eletrônicos")
6. Aguardar ~5 segundos

Se funcionar, você verá o funil gerado com etapas personalizadas.

## 🔄 Fallback

Se a API key não estiver configurada ou houver erro:
- Sistema usa template padrão (7 etapas genéricas)
- Nenhum erro é exibido ao usuário
- Logs no backend indicam uso do fallback

## 🐛 Troubleshooting

### Erro: "No OpenRouter API key configured"
- Verificar se `OPENROUTER_API_KEY` está no `.env`
- Reiniciar o backend após adicionar

### Erro: "OpenRouter API error: 401"
- API key inválida ou expirada
- Gerar nova chave no OpenRouter

### Erro: "OpenRouter API error: 429"
- Rate limit excedido
- Aguardar 1 minuto e tentar novamente

### Funil gerado está vazio
- Verificar logs do backend
- Verificar se o JSON retornado pela IA é válido
- Sistema deve usar fallback automaticamente

## 📝 Exemplo de resposta da IA

```json
{
  "description": "Funil otimizado para e-commerce de moda",
  "stages": [
    {
      "title": "Atração",
      "description": "Captar atenção através de anúncios e conteúdo",
      "icon": "target",
      "color": "#3B82F6",
      "order": 0,
      "positionX": 100,
      "positionY": 100
    },
    {
      "title": "Captura",
      "description": "Converter visitantes em leads",
      "icon": "users",
      "color": "#8B5CF6",
      "order": 1,
      "positionX": 350,
      "positionY": 100
    }
  ],
  "connections": [
    { "from": 0, "to": 1, "label": "Converter" }
  ]
}
```

## 🌐 Alternativas de IA

Se preferir usar outro modelo, edite `funnel.service.ts`:

### OpenAI GPT-4
```typescript
model: 'gpt-4o-mini'
endpoint: 'https://api.openai.com/v1/chat/completions'
```

### Anthropic Claude
```typescript
model: 'claude-3-haiku-20240307'
endpoint: 'https://api.anthropic.com/v1/messages'
```

### Google Gemini (direto)
```typescript
model: 'gemini-2.0-flash-exp'
endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-exp:generateContent'
```

## 💰 Custos

### OpenRouter (Gemini 2.0 Flash Free)
- **Custo:** $0.00
- **Limite:** Ilimitado (com rate limit)

### OpenRouter (Outros modelos)
- Varia por modelo
- Consulte: https://openrouter.ai/models

## 📚 Documentação Oficial

- OpenRouter: https://openrouter.ai/docs
- Gemini 2.0: https://ai.google.dev/gemini-api/docs
- ReactFlow: https://reactflow.dev/

