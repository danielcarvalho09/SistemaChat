#!/bin/bash
set -e

echo "🔄 Applying database migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma || echo "⚠️ Migrations failed, continuing anyway..."

echo "🚀 Starting application..."
node dist/server.js
