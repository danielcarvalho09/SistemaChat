#!/bin/bash

echo "🚀 Starting application..."
echo "📦 Running database migrations..."
npx prisma migrate deploy
echo "✅ Migrations completed"
node dist/server.js
