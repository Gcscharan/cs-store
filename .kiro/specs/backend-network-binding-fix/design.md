# Backend Network Binding Fix - Bugfix Design

## Overview

The backend server is not accessible from mobile devices due to MULTIPLE interconnected issues: (1) hardcoded port 9000 instead of using PORT environment variable, (2) IP address instability using raw IP (192.168.1.3) which changes across networks, (3) no hostname-based access configured (should use .local mDNS), (4) potential firewall blocking on Mac, and (5) potential router AP isolation. This comprehensive fix addresses all these issues through: backend port binding fixes with .local hostname logging, frontend EXPO_PUBLIC_API_URL migration to .local hostname, and comprehensive documentation for firewall/router configuration. The solution enables stable LAN connectivity across any WiFi network without deployment.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when the server starts and binds to port 9000 instead of PORT, AND when frontend uses raw IP instead of .local hostname, AND when firewall/router blocks connections
- **Property (P)**: The desired behavior - server binds to PORT with .local hostname logging, frontend uses stable .local hostname, and documentation guides network configuration
- **Preservation**: Existing network interface binding (0.0.0.0), route handling, middleware, health checks, Socket.io, database connections, and all other server functionality that must remain unchanged
- **server.listen()**: The method in `backend/src/index.ts` (line 587) that binds the HTTP server to a port and network interface
- **PORT**: Environment variable that specifies which port the server should listen on (defaults to 5001 in development)
- **tryStartServer()**: The function that wraps server.listen() and handles port binding logic
- **.local hostname**: mDNS hostname (e.g., "Charans-MacBook.local") that provides stable network-independent addressing
- **EXPO_PUBLIC_API_URL**: Environment variable in Expo app that specifies the backend API URL
- **mDNS**: Multicast DNS protocol that enables .local hostname resolution without DNS server
- **AP Isolation**: Router feature that blocks device-to-device communication on same network
- **scutil**: macOS command-line utility to get system configuration including LocalHostName

## Bug Details

### Bug Condition

The bug manifests through MULTIPLE interconnected issues:

**Issue 1: Hardcoded Port**
The `tryStartServer` function at line 587 in `backend/src/index.ts` uses a hardcoded port value (9000) instead of the `port` parameter passed to the function, causing the server to ignore the PORT environment variable.

**Issue 2: IP Address Instability**
The frontend `EXPO_PUBLIC_API_URL` uses raw IP address (192.168.1.3) which changes when switching WiFi networks, breaking the connection.

**Issue 3: Missing .local Hostname**
The server does not log the .local hostname (e.g., "Charans-MacBook.local") on startup, making it difficult for developers to configure stable mobile connections.

**Issue 4: Firewall Blocking**
Mac firewall may block incoming connections on port 5001, preventing mobile devices from connecting even when other issues are fixed.

**Issue 5: Router AP Isolation**
Router may have AP Isolation or Client Isolation enabled, blocking device-to-device communication on the same network.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type NetworkSetupContext
  OUTPUT: boolean
  
  RETURN (input.serverListenCall.portArgument == 9000
         AND input.environmentVariable.PORT != 9000)
         OR (input.frontendApiUrl.usesRawIP == true)
         OR (input.serverLogs.includesLocalHostname == false)
         OR (input.macFirewall.blocksPort5001 == true)
         OR (input.router.hasAPisolation == true)
END FUNCTION
```

### Examples

**Backend Port Issue:**
- **Example 1**: PORT=5001 in .env, server binds to 9000, mobile app tries http://192.168.1.3:5001 → Network Error (port mismatch)
- **Example 2**: PORT=5001 in .env, server logs "Server running on port 9000", mobile device connects to 192.168.1.3:9000 → 503 or connection refused (wrong port)

**IP Instability Issue:**
- **Example 3**: Home WiFi assigns 192.168.1.3, EXPO_PUBLIC_API_URL="http://192.168.1.3:5001/api" works. Switch to coffee shop WiFi with 10.0.0.5 → connection breaks, requires manual .env update
- **Example 4**: Office WiFi uses 172.16.0.10, mobile app still tries 192.168.1.3 → Network Error (wrong IP)

**.local Hostname Solution:**
- **Example 5**: Mac hostname is "Charans-MacBook", EXPO_PUBLIC_API_URL="http://Charans-MacBook.local:5001/api" works on ANY WiFi network without reconfiguration
- **Example 6**: Server logs "http://Charans-MacBook.local:5001" on startup, developer copies this directly to mobile app .env

**Firewall Issue:**
- **Example 7**: Mac firewall enabled, blocks port 5001 → mobile device cannot connect even with correct hostname/port
- **Example 8**: Firewall disabled or Node allowed → mobile device connects successfully

**Router Issue:**
- **Example 9**: Router has AP Isolation enabled → devices cannot see each other even on same network
- **Example 10**: AP Isolation disabled → devices can communicate freely on LAN

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Network interface binding to '0.0.0.0' must continue to work exactly as before
- All HTTP routes, middleware, Socket.io configuration must remain unchanged
- Health check endpoint (/health) must continue to return {"status": "ok"}
- Server startup logging, error handling, and graceful shutdown must remain unchanged (except for added .local hostname logging)
- Production vs development mode logic must remain unchanged
- All background services (Redis, MongoDB, queues, workers) must continue to initialize as before
- All existing API functionality must remain unchanged
- Database operations must continue to work exactly as before

**Scope:**
All server functionality that does NOT involve the port number used in server.listen() or startup logging should be completely unaffected by this fix. This includes:
- HTTP request handling and routing
- Socket.io real-time communication
- Database connections and transactions
- Queue system initialization
- Authentication and authorization
- All business logic and domain services

Frontend changes are additive only - updating EXPO_PUBLIC_API_URL to use .local hostname instead of IP. All existing API calls, authentication flows, and app functionality must remain unchanged.

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

**Backend Issues:**

1. **Hardcoded Port in server.listen()**: Line 587 in `backend/src/index.ts` contains:
   ```typescript
   const serverInstance = server.listen(9000, '0.0.0.0', () => {
   ```
   This hardcodes port 9000 instead of using the `port` parameter passed to `tryStartServer(port: number)`

2. **Ignored Function Parameter**: The `tryStartServer` function accepts a `port` parameter but doesn't use it in the actual server.listen() call, making the parameter useless

3. **Inconsistent Logging**: The startup log message at line 588-589 also hardcodes "port 9000" instead of using the dynamic port value

4. **Environment Variable Ignored**: The PORT variable is correctly read at line 467 (`const PORT = process.env.PORT || 5001`) but never reaches the actual binding call due to the hardcoded value

5. **Missing .local Hostname Logging**: The server does not log the .local hostname (e.g., "http://Charans-MacBook.local:5001") which would enable stable mobile connections

**Frontend Issues:**

6. **Raw IP in EXPO_PUBLIC_API_URL**: The `apps/customer-app/.env` file uses raw IP address (e.g., "http://192.168.1.3:5001/api") which changes across different WiFi networks

7. **No .local Hostname Configuration**: The frontend is not configured to use the stable .local hostname that works across any network

**Network Configuration Issues:**

8. **Mac Firewall**: May be enabled and blocking incoming connections on port 5001

9. **Router AP Isolation**: Router may have AP Isolation, Client Isolation, or Guest Mode enabled, blocking device-to-device communication

## Correctness Properties

Property 1: Bug Condition - Comprehensive LAN Connectivity

_For any_ server startup where the PORT environment variable is set (or defaults to 5001), the fixed server SHALL:
- Bind to that port value instead of hardcoded 9000
- Log both IP address AND .local hostname for easy mobile connection
- Enable mobile devices to connect using stable .local hostname across any WiFi network

_For any_ frontend configuration, the EXPO_PUBLIC_API_URL SHALL:
- Use .local hostname (e.g., "http://Charans-MacBook.local:5001/api") instead of raw IP
- Maintain stable connection across different WiFi networks without manual reconfiguration

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

Property 2: Preservation - All Existing Functionality

_For any_ server functionality that does NOT involve the port binding or startup logging (routes, middleware, Socket.io, database connections, background services), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing functionality.

_For any_ frontend API call, authentication flow, or app functionality, the behavior SHALL remain exactly the same after updating EXPO_PUBLIC_API_URL.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**Backend Changes:**

**File**: `backend/src/index.ts`

**Function**: `tryStartServer()` (lines 570-587)

**Specific Changes**:

1. **Replace hardcoded port in server.listen()**: 
   - Line 587: Change `server.listen(9000, '0.0.0.0', ...)` to `server.listen(port, '0.0.0.0', ...)`
   - This ensures the function parameter is actually used

2. **Add .local hostname detection and logging**:
   - Import `os` module at top of file: `import os from 'os';`
   - Add function to get .local hostname:
     ```typescript
     function getLocalHostname(): string {
       return os.hostname();
     }
     ```
   - Before server.listen(), get hostname: `const hostname = getLocalHostname();`
   - After server starts, log both IP and .local hostname:
     ```typescript
     console.log(`🚀 Server running on port ${port}`);
     console.log(`📱 Mobile connection: http://${hostname}.local:${port}`);
     console.log(`🏥 Health check: http://${hostname}.local:${port}/health`);
     logger.info(`🚀 Server running on port ${port}`);
     logger.info(`� Mobile connection: http://${hostname}.local:${port}`);
     ```

3. **Replace hardcoded port in existing log messages**:
   - Line 588: Change `"�🚀 Server running on port 9000..."` to use template literal with `${port}`
   - Line 589: Change `logger.info(\`🚀 Server running on port 9000\`)` to `logger.info(\`🚀 Server running on port ${port}\`)`

4. **Add safety log before server.listen()**:
   - Add before line 587: `console.log(\`Using PORT from env: ${port}\`);`
   - This provides visibility into which port is being used

5. **Verify PORT variable usage**:
   - Ensure line 467 remains: `const PORT = process.env.PORT || 5001;`
   - Ensure the PORT variable is correctly passed to tryStartServer() calls

6. **Remove any other hardcoded port references**:
   - Search for other occurrences of "9000" or "5002" in the file
   - Replace with PORT variable where appropriate

**Frontend Changes:**

**File**: `apps/customer-app/.env` (or `.env.local`)

**Specific Changes**:

1. **Update EXPO_PUBLIC_API_URL to use .local hostname**:
   - Get Mac hostname: Run `scutil --get LocalHostName` in terminal
   - Replace raw IP with .local hostname:
     ```
     # OLD (breaks across networks):
     EXPO_PUBLIC_API_URL=http://192.168.1.3:5001/api
     
     # NEW (stable across any network):
     EXPO_PUBLIC_API_URL=http://Charans-MacBook.local:5001/api
     ```
   - Replace "Charans-MacBook" with actual hostname from scutil command

**Documentation Changes:**

**File**: Create `docs/LAN_SETUP.md` (or update existing setup docs)

**Content**:

```markdown
# LAN Mobile Development Setup

## Overview
This guide helps you connect your mobile device to the backend server for local development.

## Prerequisites
- Mac and mobile device on same WiFi network
- Backend server running on Mac
- Expo Go app installed on mobile device

## Step 1: Get Your Mac Hostname
Run this command in terminal:
```bash
scutil --get LocalHostName
```
Example output: `Charans-MacBook`

## Step 2: Configure Frontend
Update `apps/customer-app/.env`:
```
EXPO_PUBLIC_API_URL=http://YOUR-HOSTNAME.local:5001/api
```
Replace `YOUR-HOSTNAME` with the output from Step 1.

## Step 3: Configure Mac Firewall
1. Open System Settings → Network → Firewall
2. Either:
   - Turn firewall OFF (easiest for development), OR
   - Click "Options" → Add Node.js → Allow incoming connections

## Step 4: Check Router Settings
If connection still fails, check your router settings:
1. Log into router admin panel (usually 192.168.1.1 or 192.168.0.1)
2. Disable these features if enabled:
   - AP Isolation
   - Client Isolation
   - Guest Mode (if devices are on guest network)

## Step 5: Test Connection
1. Start backend: `cd backend && npm run dev`
2. Note the logged URL: `📱 Mobile connection: http://Charans-MacBook.local:5001`
3. Start Expo: `cd apps/customer-app && npm start`
4. Scan QR code with Expo Go
5. App should connect successfully

## Troubleshooting

### Android mDNS Issues
Some Android devices block .local hostname resolution. Fallback to static IP:
1. Get Mac IP: `ifconfig | grep "inet " | grep -v 127.0.0.1`
2. Use IP in .env: `EXPO_PUBLIC_API_URL=http://192.168.1.3:5001/api`
3. Note: You'll need to update this when switching WiFi networks

### Connection Refused
- Check firewall settings (Step 3)
- Check router settings (Step 4)
- Verify backend is running: `curl http://localhost:5001/health`

### Wrong Port
- Verify backend logs show correct port (5001, not 9000)
- Check .env files have PORT=5001

## Why .local Hostname?
- Works across ANY WiFi network without reconfiguration
- No need to update IP when switching networks
- More stable than raw IP addresses
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code (server binds to wrong port, frontend uses unstable IP), then verify the comprehensive fix works correctly (server binds to PORT with .local hostname logging, frontend uses stable .local hostname) and preserves existing behavior (all other functionality unchanged).

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate ALL bug conditions BEFORE implementing the fix. Confirm that: (1) server binds to port 9000 regardless of PORT, (2) frontend uses raw IP that breaks across networks, (3) server doesn't log .local hostname. If we refute these hypotheses, we will need to re-hypothesize.

**Test Plan**: 

**Backend Port Issue:**
- Set PORT=5001 in backend/.env, start the server, and verify it binds to port 9000 instead of 5001
- Attempt to connect from a mobile device on port 5001 and observe connection failure
- Verify server logs don't include .local hostname

**Frontend IP Instability:**
- Check apps/customer-app/.env for EXPO_PUBLIC_API_URL
- Verify it uses raw IP (e.g., 192.168.1.3) instead of .local hostname
- Simulate network switch by changing WiFi and observe connection break

**Network Configuration:**
- Check Mac firewall status: System Settings → Network → Firewall
- Check router for AP Isolation settings (if accessible)

Run these tests on the UNFIXED code to observe failures and confirm the root causes.

**Test Cases**:
1. **Environment Variable Test**: Set PORT=5001, start server, check logs for "port 9000" (will fail on unfixed code - shows wrong port)
2. **Mobile Connection Test**: Set PORT=5001, start server, attempt curl from mobile device to http://192.168.1.3:5001/health (will fail on unfixed code - connection refused)
3. **Correct Port Test**: Set PORT=5001, start server, attempt curl to http://192.168.1.3:9000/health (will succeed on unfixed code - proves server is on wrong port)
4. **.local Hostname Logging Test**: Start server, check logs for .local hostname (will fail on unfixed code - not logged)
5. **Frontend IP Test**: Check EXPO_PUBLIC_API_URL in apps/customer-app/.env (will show raw IP on unfixed code)
6. **Network Switch Test**: Connect to WiFi A, note IP, switch to WiFi B, observe IP change and connection break (will fail on unfixed code)

**Expected Counterexamples**:
- Server logs show "Server running on port 9000" even when PORT=5001
- Mobile device cannot connect to port 5001 (connection refused)
- Mobile device CAN connect to port 9000 (proves server is on wrong port)
- Server logs don't include .local hostname for easy mobile connection
- Frontend uses raw IP that changes across networks
- Firewall may be blocking port 5001
- Router may have AP Isolation enabled

### Fix Checking

**Goal**: Verify that for all inputs where the bug conditions hold, the fixed system produces the expected behavior.

**Pseudocode:**
```
FOR ALL networkSetup WHERE isBugCondition(networkSetup) DO
  // Backend fix checking
  result := tryStartServer_fixed(PORT)
  ASSERT result.boundPort == PORT
  ASSERT result.logs.includes(".local hostname")
  ASSERT result.mobileConnectionSucceeds == true
  
  // Frontend fix checking
  apiUrl := EXPO_PUBLIC_API_URL_fixed
  ASSERT apiUrl.usesLocalHostname == true
  ASSERT apiUrl.stableAcrossNetworks == true
END FOR
```

**Test Cases**:
1. **Port Binding**: Verify server binds to PORT=5001 (not 9000)
2. **.local Hostname Logging**: Verify server logs include "http://Charans-MacBook.local:5001"
3. **Mobile Connection**: Verify mobile device can connect using .local hostname
4. **Network Stability**: Switch WiFi networks, verify connection remains stable with .local hostname
5. **Frontend Configuration**: Verify EXPO_PUBLIC_API_URL uses .local hostname
6. **Firewall Documentation**: Verify docs include firewall configuration steps
7. **Router Documentation**: Verify docs include router troubleshooting steps

### Preservation Checking

**Goal**: Verify that for all server functionality where the bug condition does NOT hold (non-port-related behavior), the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL serverBehavior WHERE NOT isBugCondition(serverBehavior) DO
  ASSERT originalServer(serverBehavior) = fixedServer(serverBehavior)
END FOR

FOR ALL frontendBehavior WHERE NOT relatedToApiUrl(frontendBehavior) DO
  ASSERT originalFrontend(frontendBehavior) = fixedFrontend(frontendBehavior)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across different server states
- It catches edge cases that manual unit tests might miss (different routes, middleware combinations, Socket.io events)
- It provides strong guarantees that behavior is unchanged for all non-port-related functionality

**Test Plan**: Observe behavior on UNFIXED code first for routes, health checks, Socket.io connections, database operations, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Health Check Preservation**: Observe that GET /health returns {"status": "ok"} on unfixed code, then verify this continues after fix
2. **Route Handling Preservation**: Observe that all API routes work correctly on unfixed code, then verify they continue working after fix
3. **Socket.io Preservation**: Observe that Socket.io connections work on unfixed code, then verify they continue working after fix
4. **Network Interface Preservation**: Observe that server binds to 0.0.0.0 on unfixed code, then verify this continues after fix
5. **Database Preservation**: Observe that database operations work on unfixed code, then verify they continue working after fix
6. **Frontend API Calls Preservation**: Observe that all API calls work on unfixed code, then verify they continue working after fix with new URL

### Unit Tests

**Backend:**
- Test server startup with PORT=5001 and verify it binds to 5001
- Test server startup with PORT=8080 and verify it binds to 8080
- Test server startup without PORT set and verify it defaults to 5001
- Test that server logs display the correct port number
- Test that server logs include .local hostname
- Test that health check endpoint responds on the correct port

**Frontend:**
- Test that EXPO_PUBLIC_API_URL uses .local hostname format
- Test that API calls work with .local hostname
- Test that authentication flows work with .local hostname

### Property-Based Tests

**Backend:**
- Generate random PORT values (1024-65535) and verify server binds to each port correctly
- Generate random server configurations and verify all routes continue working regardless of port
- Test that Socket.io connections work across many different port values
- Verify network interface binding (0.0.0.0) is preserved across all port configurations
- Verify .local hostname is logged for all server startups

**Frontend:**
- Generate random API endpoints and verify they work with .local hostname
- Test that connection remains stable across simulated network switches

### Integration Tests

**Backend:**
- Test full server startup flow with PORT=5001 and verify mobile device can connect
- Test health check from mobile device browser at http://Charans-MacBook.local:5001/health
- Test API endpoint access from mobile app after fix
- Test Socket.io real-time communication from mobile device after fix
- Test that .local hostname in logs matches actual Mac hostname

**Frontend:**
- Test full app startup with .local hostname in EXPO_PUBLIC_API_URL
- Test API calls work from mobile device using .local hostname
- Test authentication flow works with .local hostname
- Test connection stability across WiFi network switches

**Network Configuration:**
- Test with Mac firewall enabled and disabled
- Test with Node.js allowed in firewall
- Document router AP Isolation testing steps (requires router access)

### Manual Testing Checklist

1. **Backend Port Fix**:
   - [ ] Start backend with PORT=5001
   - [ ] Verify logs show "Server running on port 5001" (not 9000)
   - [ ] Verify logs show "📱 Mobile connection: http://YOUR-HOSTNAME.local:5001"
   - [ ] Verify curl http://localhost:5001/health works

2. **Frontend .local Hostname**:
   - [ ] Run `scutil --get LocalHostName` to get Mac hostname
   - [ ] Update EXPO_PUBLIC_API_URL to use .local hostname
   - [ ] Start Expo app on mobile device
   - [ ] Verify app connects successfully

3. **Network Stability**:
   - [ ] Connect to WiFi network A
   - [ ] Verify mobile app works
   - [ ] Switch to WiFi network B
   - [ ] Verify mobile app still works (no .env update needed)

4. **Firewall Configuration**:
   - [ ] Enable Mac firewall
   - [ ] Test mobile connection (may fail)
   - [ ] Add Node.js to firewall allow list
   - [ ] Test mobile connection (should work)

5. **Documentation**:
   - [ ] Verify LAN_SETUP.md exists and is complete
   - [ ] Follow setup steps from scratch
   - [ ] Verify all commands work as documented
