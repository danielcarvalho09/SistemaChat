#!/bin/bash

echo "🔄 Applying migrations to PRODUCTION (Supabase)..."
echo ""
echo "⚠️  WARNING: This will modify the PRODUCTION database!"
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

DATABASE_URL="postgresql://postgres.krrzypdydjoyiueyuuzh:Dcarv09!@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true" npx prisma migrate deploy

echo ""
echo "✅ Migrations applied to production!"
echo "🚀 Now you can deploy to Railway"
