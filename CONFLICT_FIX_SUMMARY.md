# WhatsApp Baileys Conflict Error Fix

## Problem
The system was experiencing recurring **"Stream Errored (conflict)"** errors (status code 440) with WhatsApp connections. This happened because multiple instances were trying to connect with the same WhatsApp account simultaneously.

### Root Causes:
1. **Race Condition**: When a connection closed, the system tried to remove the old client and immediately create a new one
2. **Failed Logout Attempts**: The `logout()` call was failing because the connection was already closed, but the system still tried to call it
3. **No Reconnection Lock**: Multiple reconnection attempts could happen simultaneously
4. **Insufficient Delays**: Reconnection attempts happened too quickly, not giving the previous connection time to fully close

## Solution Implemented

### 1. Added Reconnection Lock Mechanism
- Added `reconnectionLocks: Map<string, boolean>` to prevent concurrent reconnections
- Lock is set when creating/reconnecting a client
- Lock is released after successful creation or on error
- Double-check before any reconnection attempt

### 2. Improved `removeClient()` Function
- Added `doLogout` parameter (default: `true`)
- When `doLogout = false`, skips the logout call entirely
- Used when connection is already closed (e.g., after conflict error)
- Prevents "Connection Closed" errors during cleanup

### 3. Increased Reconnection Delays
Changed from aggressive reconnection strategy to more conservative:
- **1st attempt**: 3 seconds (was 1s) - gives time for previous connection to fully close
- **Attempts 2-5**: 5 seconds (was 2s)
- **Attempts 6-15**: 10 seconds (was 5s)
- **After 15 attempts**: 30 seconds (was 20s)

### 4. Enhanced Lock Checks
- Check `reconnectionLocks` before any reconnection attempt
- Check both `isReconnecting` flag AND `reconnectionLocks` map
- Skip reconnection if already in progress

## Changes Made

### File: `src/whatsapp/baileys.manager.ts`

1. **Added reconnection lock**:
```typescript
private reconnectionLocks: Map<string, boolean> = new Map();
```

2. **Updated `createClient()`**:
   - Check if client creation is already in progress
   - Set lock before creating client
   - Release lock after success or error
   - Pass `doLogout: false` when removing existing client

3. **Updated `handleConnectionUpdate()`**:
   - Pass `doLogout: false` for logout disconnect reason
   - Check reconnection lock before restart
   - Increased restart delay to 3 seconds

4. **Updated `attemptReconnection()`**:
   - Added double-check for reconnection locks
   - Increased delays (3s, 5s, 10s, 30s)
   - Better logging

5. **Updated `removeClient()` signature**:
```typescript
async removeClient(connectionId: string, doLogout: boolean = true)
```

### File: `src/services/whatsapp.service.ts`

Updated all `removeClient()` calls to explicitly pass `doLogout: true`:
- `disconnectConnection()`: `removeClient(connectionId, true)`
- `deleteConnection()`: `removeClient(connectionId, true)`

### Additional Fix: Missing Method

Added missing `isConnectionActive()` method to `BaileysManager`:
```typescript
isConnectionActive(connectionId: string): boolean {
  const client = this.clients.get(connectionId);
  return client ? client.status === 'connected' : false;
}
```
This method is used by `message.service.ts` to verify connection status before sending messages.

## Expected Behavior After Fix

1. **No More Conflict Errors**: Only one connection attempt at a time per account
2. **Clean Disconnections**: No failed logout attempts on already-closed connections
3. **Stable Reconnections**: Proper delays allow previous connections to fully close
4. **Better Logging**: Clear indication when reconnection is skipped due to lock

## Testing Recommendations

1. Monitor logs for "already being created/reconnected, skipping" messages
2. Verify no more "Connection Closed" errors during logout
3. Check that connections successfully reconnect after temporary disconnections
4. Ensure QR code flow still works for new connections

## Deployment Notes

- **No database changes required**
- **No breaking changes to API**
- Rebuild TypeScript: `npm run build`
- Restart backend service
- Monitor logs for first 30 minutes after deployment
