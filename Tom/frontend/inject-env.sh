#!/bin/bash
# Script para injetar variáveis de ambiente no build

# Se a variável BACKEND_URL existir (Railway), use ela
if [ -n "$BACKEND_URL" ]; then
  export VITE_API_URL="$BACKEND_URL"
  export VITE_WS_URL="$BACKEND_URL"
  echo "✅ Usando BACKEND_URL do Railway"
else
  # Se não, use valores padrão
  echo "⚠️  BACKEND_URL não definida, usando valor padrão"
  export VITE_API_URL="http://localhost:3000"
  export VITE_WS_URL="http://localhost:3000"
fi

echo "✅ Variáveis configuradas:"
echo "VITE_API_URL=$VITE_API_URL"
echo "VITE_WS_URL=$VITE_WS_URL"

# Executar build
npm run build
