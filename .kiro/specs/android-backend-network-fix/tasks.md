# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Physical Android Device Cannot Reach Backend
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists on the unfixed system
  - **Scoped PBT Approach**: Scope the property to the concrete failing cases — HTTP requests from a physical Android device to `http://192.168.1.3:5002/api/*`
  - Run the following diagnostic checks on the UNFIXED system to confirm which root cause is active:
    1. From the Android device browser, navigate to `http://192.168.1.3:5002/api/health` — if it fails while `curl http://192.168.1.3:5002/api/health` from the Mac succeeds, the macOS firewall is the blocker
    2. Run `lsof -i :5002` on the Mac — if output shows `localhost:5002` instead of `*:5002`, the backend is bound to loopback only
    3. Inspect the merged manifest in the built APK (`android/app/build/intermediates/merged_manifests/`) for `usesCleartextTraffic` and `networkSecurityConfig` attributes
  - Write a property-based test asserting: for all HTTP requests where `isBugCondition(request)` is true (origin = physical Android device, target = `192.168.1.3:5002`, protocol = `http`), the response SHALL NOT be `ERR_NETWORK` or HTTP 503
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug exists)
  - Document counterexamples found (e.g., `GET http://192.168.1.3:5002/api/health` from moto_g54_5G → `ERR_NETWORK` instead of `200 OK`)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Physical-Android Environments Unaffected
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED system for non-buggy inputs (requests NOT from a physical Android device):
    1. Observe: `GET http://localhost:5002/api/health` from iOS simulator returns `200 OK`
    2. Observe: `GET http://10.0.2.2:5002/api/health` from Android emulator returns `200 OK`
    3. Observe: `GET http://localhost:5002/api/health` from web browser returns `200 OK`
    4. Observe: orders, auth, and product endpoints return correct data from simulator/emulator/web
  - Write property-based tests asserting: for all requests where `NOT isBugCondition(request)` (iOS simulator, Android emulator, web browser), the response is identical before and after the fix
  - Verify tests PASS on UNFIXED code (confirms baseline behavior to preserve)
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix Android backend network connectivity for physical devices

  - [x] 3.1 Fix macOS firewall to allow inbound connections on port 5002
    - Open System Settings → Network → Firewall → Options
    - Add Node.js to the "Allow incoming connections" list, OR run:
      `sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add $(which node)`
      `sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp $(which node)`
    - Alternatively, disable the firewall for local development
    - Verify with `lsof -i :5002` — output must show `*:5002` (not `localhost:5002`) in the LISTEN state
    - _Bug_Condition: isBugCondition(request) where request.origin == PHYSICAL_ANDROID_DEVICE AND request.targetHost == "192.168.1.3" AND request.targetPort == 5002_
    - _Expected_Behavior: response.status NOT ERR_NETWORK, response.httpStatus IN [200, 201, 400, 401, 404]_
    - _Preservation: iOS simulator, Android emulator, and web browser connectivity must remain unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.2 Verify backend binding at runtime
    - Confirm `backend/src/index.ts` line ~800 reads `server.listen(port, '0.0.0.0', ...)`
    - Run `lsof -i :5002` while the backend is running — confirm the LISTEN entry is bound to `*:5002` not `127.0.0.1:5002`
    - If a Docker override or alternate startup path binds to loopback, update it to bind to `0.0.0.0`
    - No code change expected (already correct per code inspection), but runtime verification is required
    - _Requirements: 2.1_

  - [x] 3.3 Create Network Security Config XML
    - Create file: `apps/customer-app/android/app/src/main/res/xml/network_security_config.xml`
    - Content:
      ```xml
      <?xml version="1.0" encoding="utf-8"?>
      <network-security-config>
          <!-- Allow cleartext HTTP to local development server on LAN -->
          <domain-config cleartextTrafficPermitted="true">
              <domain includeSubdomains="false">192.168.1.3</domain>
          </domain-config>
          <!-- Default: follow system policy (no cleartext for other domains) -->
          <base-config cleartextTrafficPermitted="false" />
      </network-security-config>
      ```
    - This provides an explicit belt-and-suspenders guarantee for cleartext HTTP to the LAN IP
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.4 Reference Network Security Config in AndroidManifest.xml
    - File: `apps/customer-app/android/app/src/main/AndroidManifest.xml`
    - Add `android:networkSecurityConfig="@xml/network_security_config"` to the `<application>` tag
    - Retain the existing `android:usesCleartextTraffic="true"` attribute as a fallback for Android API < 24
    - _Requirements: 2.1_

  - [x] 3.5 Verify app.json android cleartext config
    - File: `apps/customer-app/app.json`
    - Confirm `"usesCleartextTraffic": true` is present under `expo.android`
    - No change expected (already correct per code inspection)
    - _Requirements: 2.1_

  - [x] 3.6 Rebuild Expo dev build
    - A JS-only reload (`r` in Metro) is NOT sufficient — native manifest/XML changes require a full rebuild
    - Run: `cd apps/customer-app && npx expo run:android`
    - Wait for the build to complete and the app to launch on the physical device
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.7 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Physical Android Device Reaches Backend
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1 on the FIXED system
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed — physical Android device can reach `http://192.168.1.3:5002/api/*`)
    - Verify: `GET /api/health` from moto_g54_5G returns `200 OK`
    - Verify: `GET /api/orders` from moto_g54_5G returns orders data without exhausting retries
    - Verify: `POST /api/auth/send-otp` from moto_g54_5G returns a valid response (not 503)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.8 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Physical-Android Environments Unaffected
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2 on the FIXED system
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Verify iOS simulator still connects to backend without errors
    - Verify Android emulator still connects to backend without errors
    - Verify web browser still connects to backend without errors
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass; ask the user if questions arise
  - Confirm physical Android device (moto_g54_5G) can complete a full OTP auth flow end-to-end
  - Confirm iOS simulator and Android emulator show no regressions
