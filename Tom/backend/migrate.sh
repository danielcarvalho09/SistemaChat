#!/bin/bash
# Script para rodar migrations manualmente no Railway
# Execute: railway run bash migrate.sh

echo "🔄 Running database migrations..."
npx prisma migrate deploy
echo "✅ Migrations completed!"
