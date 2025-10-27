#!/bin/bash

echo "🚀 Executando migrações e seed..."

# Executar migrações do Prisma
echo "📦 Aplicando migrações do banco de dados..."
npx prisma migrate deploy

# Executar seed
echo "🌱 Executando seed do banco de dados..."
node railway-seed.js

echo "✅ Migrações e seed concluídos!"
