# Android Backend Network Fix - Bugfix Design

## Overview

A physical Android device (moto_g54_5G) running the customer app via Expo dev build cannot reach
the backend server at `http://192.168.1.3:5002/api`. The device is on the same WiFi subnet
(192.168.1.x) and the URL is correctly set in `apps/customer-app/.env`. Every API call fails with
`ERR_NETWORK` / HTTP 503.

The fix strategy is to systematically eliminate each of the four potential blockers in order of
likelihood: macOS firewall, backend binding address, Android cleartext policy, and Android Network
Security Config. Code inspection already reveals that the backend binds to `0.0.0.0` and the
manifest sets `usesCleartextTraffic="true"`, so those may already be correct — but all four must
be verified and hardened.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — an HTTP request from a physical
  Android device to `http://192.168.1.3:5002/api/*` fails with `ERR_NETWORK` / 503.
- **Property (P)**: The desired behavior — the request reaches the backend and receives a valid
  HTTP response (2xx or expected error code).
- **Preservation**: Existing connectivity from iOS simulator, Android emulator, and web browser
  must remain unchanged after the fix.
- **`server.listen`**: The call in `backend/src/index.ts` (line 800) that binds the HTTP server.
  Currently: `server.listen(port, '0.0.0.0', ...)` — binds to all interfaces (correct).
- **`usesCleartextTraffic`**: Android manifest attribute that allows HTTP (non-HTTPS) traffic.
  Currently set to `true` in both `AndroidManifest.xml` and `app.json` (correct).
- **Network Security Config**: An optional Android XML file (`res/xml/network_security_config.xml`)
  that provides fine-grained control over cleartext and certificate policies per domain.
- **macOS Application Firewall**: The macOS system firewall (`/usr/libexec/ApplicationFirewall`)
  that can block inbound TCP connections to Node.js processes on specific ports.
- **`EXPO_PUBLIC_API_URL`**: Environment variable in `apps/customer-app/.env` set to
  `http://192.168.1.3:5002/api` — the LAN IP of the host machine.

## Bug Details

### Bug Condition

The bug manifests when a physical Android device on the same WiFi subnet attempts any HTTP request
to the backend. The TCP connection either never reaches the host machine (firewall), is refused
(wrong bind address), or is blocked by Android's network security policy (cleartext/NSC).

**Formal Specification:**
```
FUNCTION isBugCondition(request)
  INPUT: request of type HTTPRequest
  OUTPUT: boolean

  RETURN request.origin == PHYSICAL_ANDROID_DEVICE
         AND request.targetHost == "192.168.1.3"
         AND request.targetPort == 5002
         AND request.protocol == "http"
         AND NOT responseReceived(request)
END FUNCTION
```

### Examples

- **Health check**: `GET http://192.168.1.3:5002/api/health` from moto_g54_5G → `ERR_NETWORK`
  (expected: `200 OK { status: "ok" }`)
- **Orders**: `GET http://192.168.1.3:5002/api/orders` from moto_g54_5G → exhausts 4 retries,
  returns 503 (expected: `200 OK` with orders array)
- **OTP**: `POST http://192.168.1.3:5002/api/auth/send-otp` from moto_g54_5G →
  `{"data": "Network error. Please check your connection.", "status": 503}` (expected: `200 OK`)
- **Same request from iOS simulator**: succeeds — confirms backend is running and reachable from
  localhost/loopback, but not from the physical device's IP.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- iOS simulator and Android emulator must continue to connect to the backend without errors.
- Web browser (Expo web) must continue to connect to the backend without errors.
- All API endpoints must continue to return correct data and HTTP status codes for non-Android
  physical device environments.
- Changing `EXPO_PUBLIC_API_URL` must continue to update the URL used for all API requests.

**Scope:**
All requests that do NOT originate from a physical Android device on the LAN should be completely
unaffected by this fix. This includes:
- Requests from iOS simulator (loopback via `localhost`)
- Requests from Android emulator (via `10.0.2.2` alias)
- Requests from web browser on the same machine

## Hypothesized Root Cause

Based on code inspection and the bug description, the causes are ranked by likelihood:

1. **macOS Application Firewall blocking inbound connections on port 5002** *(most likely)*
   - The macOS firewall may be set to block all incoming connections, or specifically block the
     Node.js binary.
   - This would explain why the iOS simulator works (loopback bypasses the firewall) but a
     physical device on the LAN cannot reach port 5002.
   - Fix: Add a firewall rule to allow incoming connections on port 5002, or allow the Node.js
     binary through the firewall.

2. **Backend server binding to `127.0.0.1` instead of `0.0.0.0`** *(already correct — verify)*
   - Code inspection shows `server.listen(port, '0.0.0.0', ...)` in `backend/src/index.ts:800`.
   - This is already correct, but must be verified at runtime (e.g., `lsof -i :5002` should show
     `*:5002` not `localhost:5002`).
   - If a different entry point or Docker override is used, it could still bind to loopback.

3. **Android cleartext (HTTP) traffic policy blocking non-HTTPS requests** *(already correct — verify)*
   - `android:usesCleartextTraffic="true"` is present in both `AndroidManifest.xml` and `app.json`.
   - This should already permit HTTP traffic. However, the Expo dev build may regenerate the
     manifest and the attribute must survive the build process.
   - Verify the compiled APK's merged manifest contains the attribute.

4. **Network Security Config missing or not explicitly allowing cleartext to the local IP** *(low risk)*
   - No `network_security_config.xml` file exists in `android/app/src/main/res/xml/`.
   - Without an NSC file, Android falls back to the `usesCleartextTraffic` manifest attribute,
     which is already `true`. This is likely fine, but adding an explicit NSC file for the
     `192.168.1.x` domain provides a belt-and-suspenders guarantee and is the recommended
     approach for dev builds targeting local IPs.

## Correctness Properties

Property 1: Bug Condition - Physical Android Device Reaches Backend

_For any_ HTTP request originating from a physical Android device on the same WiFi subnet where
`isBugCondition(request)` returns true, the fixed system SHALL successfully establish a TCP
connection to `192.168.1.3:5002` and receive a valid HTTP response (not `ERR_NETWORK` / 503).

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Non-Physical-Android Environments Unaffected

_For any_ request that does NOT originate from a physical Android device (iOS simulator, Android
emulator, web browser), the fixed system SHALL produce exactly the same response as before the
fix, preserving all existing connectivity and API behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming the root cause analysis is correct, the following changes are needed in order:

**Step 1 — macOS Firewall**

*Manual / environment change (not a code change):*
- Open System Settings → Network → Firewall → Options.
- Either disable the firewall for development, or add Node.js / the backend process to the
  "Allow incoming connections" list.
- Alternatively, run: `sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add $(which node)`
  and `sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp $(which node)`.
- Verify with: `lsof -i :5002` — should show a `LISTEN` entry bound to `*:5002`.

**Step 2 — Verify Backend Binding (already correct)**

*File*: `backend/src/index.ts`

*Verification*: Confirm line 800 reads `server.listen(port, '0.0.0.0', ...)`. This is already
correct. No code change needed unless a different startup path (e.g., Docker, `ts-node` direct)
bypasses this and defaults to `127.0.0.1`.

**Step 3 — Add Network Security Config XML**

*File (new)*: `apps/customer-app/android/app/src/main/res/xml/network_security_config.xml`

*Content*:
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

**Step 4 — Reference NSC in AndroidManifest.xml**

*File*: `apps/customer-app/android/app/src/main/AndroidManifest.xml`

*Change*: Add `android:networkSecurityConfig="@xml/network_security_config"` to the `<application>`
tag. The existing `android:usesCleartextTraffic="true"` attribute can remain as a fallback for
older Android versions (API < 24).

**Step 5 — Verify app.json android config**

*File*: `apps/customer-app/app.json`

*Verification*: Confirm `"usesCleartextTraffic": true` is present under `expo.android`. This is
already correct. No change needed.

**Step 6 — Rebuild the Expo dev build**

After any manifest or XML change, the Expo dev build must be rebuilt:
```
cd apps/customer-app
npx expo run:android
```
A JS-only reload (`r` in Metro) is NOT sufficient — native changes require a full rebuild.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate
the bug on the unfixed system, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Confirm which of the four root causes is actually responsible before implementing the
fix. Run these checks on the UNFIXED system.

**Test Plan**: Use network diagnostic tools and manual HTTP requests to isolate the failure layer.

**Test Cases**:
1. **Firewall check**: From the Android device browser, navigate to `http://192.168.1.3:5002/api/health`.
   If it fails but `curl http://192.168.1.3:5002/api/health` from the Mac succeeds, the firewall
   is the blocker. (Will fail on unfixed system if firewall is active.)
2. **Binding check**: Run `lsof -i :5002` on the Mac. If output shows `localhost:5002` instead of
   `*:5002`, the server is bound to loopback only. (May fail on unfixed system.)
3. **Cleartext check**: Install a network inspection proxy (e.g., Charles) on the Mac and route
   Android traffic through it. If the request reaches the proxy but is blocked before the app
   sends it, Android's cleartext policy is the blocker.
4. **NSC check**: Inspect the merged manifest in the built APK
   (`android/app/build/intermediates/merged_manifests/`) for `usesCleartextTraffic` and
   `networkSecurityConfig` attributes.

**Expected Counterexamples**:
- `curl` from Mac succeeds but Android browser fails → firewall is blocking inbound LAN traffic.
- `lsof` shows `localhost:5002` → backend is not reachable from LAN regardless of firewall.
- Merged manifest missing `usesCleartextTraffic="true"` → Android is blocking HTTP at the OS level.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed system produces the
expected behavior.

**Pseudocode:**
```
FOR ALL request WHERE isBugCondition(request) DO
  response := sendRequest_fixed(request)
  ASSERT response.status != ERR_NETWORK
  ASSERT response.status != 503
  ASSERT response.httpStatus IN [200, 201, 400, 401, 404]  // valid HTTP, not network failure
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed system
produces the same result as the original system.

**Pseudocode:**
```
FOR ALL request WHERE NOT isBugCondition(request) DO
  ASSERT response_original(request) == response_fixed(request)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain.
- It catches edge cases that manual unit tests might miss.
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs.

**Test Plan**: Observe behavior on UNFIXED system for iOS simulator and web browser requests,
then write property-based tests capturing that behavior.

**Test Cases**:
1. **iOS Simulator Preservation**: Verify `GET /api/health` from iOS simulator returns `200 OK`
   before and after the fix.
2. **Android Emulator Preservation**: Verify `GET /api/health` from Android emulator (via
   `10.0.2.2:5002`) returns `200 OK` before and after the fix.
3. **Web Browser Preservation**: Verify `GET http://localhost:5002/api/health` from the web
   browser returns `200 OK` before and after the fix.
4. **API Endpoint Preservation**: Verify orders, auth, and product endpoints return the same
   responses from non-Android-physical-device environments before and after the fix.

### Unit Tests

- Test that the backend server starts and listens on `0.0.0.0:5002` (not `127.0.0.1:5002`).
- Test that the health endpoint returns `200 OK` when called from a non-loopback address.
- Test that the Android manifest XML is valid and contains the required attributes after build.

### Property-Based Tests

- Generate random LAN IP addresses in the `192.168.1.x` range and verify the NSC config permits
  cleartext traffic to all of them (if the domain is configured as a subnet).
- Generate random non-LAN requests and verify they are unaffected by the NSC config change.
- Generate random API endpoint paths and verify they all succeed from a simulated LAN client.

### Integration Tests

- Full app boot on physical Android device: verify the health check succeeds within 5 seconds.
- Full OTP flow on physical Android device: verify `POST /api/auth/send-otp` returns a valid
  response (not 503).
- Full orders flow on physical Android device: verify `GET /api/orders` returns data without
  exhausting retries.
- Regression: run the same flows on iOS simulator and Android emulator to confirm no regression.
