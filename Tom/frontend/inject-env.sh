#!/bin/bash
# Script para injetar variáveis de ambiente no build

# Se a variável BACKEND_URL existir (Railway), use ela
if [ -n "$BACKEND_URL" ]; then
  export VITE_API_URL="$BACKEND_URL"
  export VITE_WS_URL="${BACKEND_URL/https/wss}"
fi

# Se não, use valores padrão
if [ -z "$VITE_API_URL" ]; then
  echo "⚠️  BACKEND_URL não definida, usando valor padrão"
  export VITE_API_URL="http://localhost:3000"
  export VITE_WS_URL="ws://localhost:3000"
fi

echo "✅ Variáveis configuradas:"
echo "VITE_API_URL=$VITE_API_URL"
echo "VITE_WS_URL=$VITE_WS_URL"

# Executar build
npm run build
