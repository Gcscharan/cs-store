# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Comprehensive LAN Connectivity Issues
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate ALL bug conditions exist
  - **Scoped PBT Approach**: Scope the property to concrete failing cases
  - **Backend Port Issue**: Test that server.listen() is called with port 9000 when PORT environment variable is set to 5001
  - **Backend Logging Issue**: Test that server logs don't include .local hostname
  - **Frontend IP Issue**: Test that EXPO_PUBLIC_API_URL uses raw IP instead of .local hostname
  - **Mobile Connection Issue**: Test that mobile device cannot connect to http://192.168.1.3:5001/health (connection refused)
  - **Wrong Port Connection**: Test that mobile device CAN connect to http://192.168.1.3:9000/health (proves server is on wrong port)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bugs exist)
  - Document counterexamples found: "Server logs show port 9000 even when PORT=5001", "Mobile connection to 5001 fails but 9000 succeeds", "Server doesn't log .local hostname", "Frontend uses raw IP"
  - Mark task complete when test is written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - All Existing Functionality
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-port-related functionality
  - **Backend Preservation**: Test that GET /health returns {"status": "ok"} on unfixed code (observe and record)
  - Test that server binds to 0.0.0.0 network interface on unfixed code (observe and record)
  - Test that all API routes respond correctly on unfixed code (observe and record)
  - Test that Socket.io connections work on unfixed code (observe and record)
  - Test that database operations work on unfixed code (observe and record)
  - **Frontend Preservation**: Test that all API calls work on unfixed code (observe and record)
  - Test that authentication flows work on unfixed code (observe and record)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. Implement comprehensive LAN networking fix

  - [x] 3.1 Fix backend port binding and add .local hostname logging
    - Locate tryStartServer function in backend/src/index.ts (around line 570-587)
    - Import os module at top of file: `import os from 'os';`
    - Add function to get .local hostname: `function getLocalHostname(): string { return os.hostname(); }`
    - Replace hardcoded port 9000 in server.listen() call with dynamic port parameter
    - Change line 587: `server.listen(9000, '0.0.0.0', ...)` to `server.listen(port, '0.0.0.0', ...)`
    - Before server.listen(), get hostname: `const hostname = getLocalHostname();`
    - Update log messages to use template literals with ${port} instead of hardcoded "9000"
    - Add .local hostname logging after server starts:
      ```typescript
      console.log(`🚀 Server running on port ${port}`);
      console.log(`📱 Mobile connection: http://${hostname}.local:${port}`);
      console.log(`🏥 Health check: http://${hostname}.local:${port}/health`);
      logger.info(`🚀 Server running on port ${port}`);
      logger.info(`📱 Mobile connection: http://${hostname}.local:${port}`);
      ```
    - Add safety log before server.listen(): `console.log(\`Using PORT from env: ${port}\`);`
    - Verify PORT variable is correctly defined: `const PORT = process.env.PORT || 5001;`
    - Ensure tryStartServer(PORT) is called with PORT variable (not hardcoded values)
    - Remove ALL other hardcoded port references (9000, 5002, etc.) from the file
    - _Bug_Condition: isBugCondition(input) where (input.serverListenCall.portArgument == 9000 AND input.environmentVariable.PORT != 9000) OR (input.serverLogs.includesLocalHostname == false)_
    - _Expected_Behavior: Server binds to PORT from environment variable, logs .local hostname for easy mobile connection_
    - _Preservation: Network interface binding (0.0.0.0), route handling, middleware, health checks, Socket.io, database connections, and all other server functionality must remain unchanged_
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 3.2 Update frontend to use .local hostname
    - Get Mac hostname by running: `scutil --get LocalHostName`
    - Locate apps/customer-app/.env (or .env.local)
    - Update EXPO_PUBLIC_API_URL to use .local hostname instead of raw IP
    - OLD: `EXPO_PUBLIC_API_URL=http://192.168.1.3:5001/api`
    - NEW: `EXPO_PUBLIC_API_URL=http://YOUR-HOSTNAME.local:5001/api`
    - Replace YOUR-HOSTNAME with actual hostname from scutil command
    - Example: `EXPO_PUBLIC_API_URL=http://Charans-MacBook.local:5001/api`
    - Verify no other files reference the old raw IP address
    - _Bug_Condition: isBugCondition(input) where input.frontendApiUrl.usesRawIP == true_
    - _Expected_Behavior: Frontend uses stable .local hostname that works across any WiFi network_
    - _Preservation: All API calls, authentication flows, and app functionality must remain unchanged_
    - _Requirements: 1.5, 1.6, 2.5, 2.6_

  - [x] 3.3 Create LAN setup documentation
    - Create docs/LAN_SETUP.md file
    - Document how to get Mac hostname: `scutil --get LocalHostName`
    - Document frontend configuration: Update EXPO_PUBLIC_API_URL with .local hostname
    - Document Mac firewall configuration:
      - System Settings → Network → Firewall
      - Either turn OFF or add Node.js to allow list
    - Document router troubleshooting:
      - Disable AP Isolation
      - Disable Client Isolation
      - Disable Guest Mode (if devices on guest network)
    - Document Android mDNS fallback: Use static IP if .local doesn't work
    - Include step-by-step setup instructions
    - Include troubleshooting section for common issues
    - Include explanation of why .local hostname is better than raw IP
    - _Expected_Behavior: Developers can follow clear instructions to set up LAN connectivity_
    - _Requirements: 2.7, 2.8, 2.9, 2.10_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Comprehensive LAN Connectivity
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **Backend Verification**: Verify server binds to PORT=5001 when environment variable is set
    - Verify server logs include .local hostname (e.g., "http://Charans-MacBook.local:5001")
    - Verify mobile device can connect to http://YOUR-HOSTNAME.local:5001/health successfully
    - **Frontend Verification**: Verify EXPO_PUBLIC_API_URL uses .local hostname
    - Verify mobile app connects successfully using .local hostname
    - **Network Stability**: Switch WiFi networks and verify connection remains stable
    - **EXPECTED OUTCOME**: Test PASSES (confirms bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - All Existing Functionality
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **Backend Preservation**: Verify GET /health still returns {"status": "ok"}
    - Verify server still binds to 0.0.0.0 network interface
    - Verify all API routes still respond correctly
    - Verify Socket.io connections still work
    - Verify database operations still work
    - **Frontend Preservation**: Verify all API calls still work with new URL
    - Verify authentication flows still work
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 4. Checkpoint - Ensure all tests pass and manual verification
  - Run all tests (bug condition + preservation)
  - **Backend Verification**:
    - Verify server starts successfully with PORT=5001
    - Verify server logs show "Server running on port 5001" (not 9000)
    - Verify server logs show "📱 Mobile connection: http://YOUR-HOSTNAME.local:5001"
    - Verify mobile device can access http://YOUR-HOSTNAME.local:5001/health
    - Verify health check returns {"status": "ok"}
  - **Frontend Verification**:
    - Verify EXPO_PUBLIC_API_URL uses .local hostname (not raw IP)
    - Verify mobile app connects successfully
    - Verify all API calls work
    - Verify authentication flows work
  - **Network Stability Verification**:
    - Connect to WiFi network A, verify app works
    - Switch to WiFi network B, verify app still works (no .env update needed)
  - **Documentation Verification**:
    - Verify docs/LAN_SETUP.md exists and is complete
    - Follow setup steps from scratch to ensure they work
  - **Firewall/Router Verification** (optional, document if issues found):
    - Test with Mac firewall enabled/disabled
    - Document any router AP Isolation issues encountered
  - Ensure all tests pass, ask the user if questions arise
