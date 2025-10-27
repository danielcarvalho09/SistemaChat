# Troubleshooting: User Creation Error (500)

## Problem
When trying to create a user, you get a 500 error: "Failed to load resource: the server responded with a status of 500"

## Root Cause
The system roles (admin/user) are not configured in the database. This happens when:
1. The `create-roles-only.js` script didn't run on startup
2. The script failed silently
3. Database migrations weren't applied

## Solution

### Step 1: Check if roles exist
Visit this endpoint in your browser or use curl:
```
https://your-backend-url.railway.app/health/roles
```

You should see:
```json
{
  "status": "configured",
  "hasAdmin": true,
  "hasUser": true,
  "roles": [
    { "id": "...", "name": "admin", "description": "..." },
    { "id": "...", "name": "user", "description": "..." }
  ]
}
```

If you see `"status": "missing_roles"`, proceed to Step 2.

### Step 2: Run the roles creation script

#### Option A: Via Railway CLI (Recommended)
```bash
railway run node create-roles-only.js
```

#### Option B: Via Railway Dashboard
1. Go to your Railway project
2. Click on your backend service
3. Go to "Settings" → "Deploy"
4. Trigger a new deployment (the script runs on startup)

#### Option C: Manually via Railway Shell
1. Go to Railway Dashboard
2. Click on your backend service
3. Click "Shell" tab
4. Run: `node create-roles-only.js`

### Step 3: Verify roles were created
Check the endpoint again:
```
https://your-backend-url.railway.app/health/roles
```

Should now show `"status": "configured"`

### Step 4: Try creating user again
Go back to your frontend and try creating a user. It should work now.

## Prevention

The `create-roles-only.js` script is configured to run automatically on every deployment via the start command:
```
node create-roles-only.js && node dist/server.js
```

If it's not running, check:
1. Railway logs for any errors during startup
2. DATABASE_URL environment variable is set correctly
3. Database is accessible from Railway

## Improved Error Messages

The system now provides better error messages:

**Before:**
```
Internal server error
```

**After:**
```json
{
  "success": false,
  "message": "System roles not configured. Please contact administrator.",
  "details": "The required roles (admin/user) are not set up in the database.",
  "action": "Administrator should run: node create-roles-only.js"
}
```

## Additional Diagnostics

### Check all health endpoints:
- `/health` - Basic health check
- `/health/detailed` - Database, Redis, memory status
- `/health/roles` - Roles configuration status
- `/health/readiness` - Ready to receive traffic
- `/health/liveness` - Application is alive

### Check Railway logs:
```bash
railway logs
```

Look for:
- "✅ Role 'admin' OK"
- "✅ Role 'user' OK"
- Any database connection errors
- Any Prisma migration errors

## Common Issues

### Issue: Script runs but roles not created
**Cause:** Database migrations not applied
**Solution:** 
```bash
railway run npx prisma migrate deploy
railway run node create-roles-only.js
```

### Issue: "Connection refused" error
**Cause:** DATABASE_URL not set or incorrect
**Solution:** Check environment variables in Railway dashboard

### Issue: Script succeeds but still getting 500 error
**Cause:** Cached error or different database
**Solution:** 
1. Check you're using the correct backend URL
2. Clear browser cache
3. Verify DATABASE_URL in Railway matches your database
