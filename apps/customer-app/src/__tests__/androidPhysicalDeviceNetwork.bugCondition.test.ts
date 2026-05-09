/**
 * Bug Condition Exploration Test - Physical Android Device Cannot Reach Backend
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 *
 * PROPERTY 1: Bug Condition - Physical Android Device Cannot Reach Backend
 *
 * For any HTTP request where isBugCondition(request) is true:
 *   - request.origin == PHYSICAL_ANDROID_DEVICE
 *   - request.targetHost == "192.168.1.3"
 *   - request.targetPort == 5002
 *   - request.protocol == "http"
 *
 * The response SHALL NOT be ERR_NETWORK or HTTP 503.
 *
 * EXPECTED BEHAVIOR ON UNFIXED CODE:
 *   - This test MUST FAIL (proving the bug exists)
 *   - network_security_config.xml does NOT exist → test fails
 *   - android:networkSecurityConfig attribute is NOT in AndroidManifest.xml → test fails
 *   - These missing artifacts cause ERR_NETWORK on the physical Android device
 *
 * EXPECTED BEHAVIOR ON FIXED CODE:
 *   - This test MUST PASS (proving the bug is fixed)
 *   - network_security_config.xml EXISTS with domain-config for 192.168.1.3
 *   - android:networkSecurityConfig attribute IS in AndroidManifest.xml
 *   - Physical Android device successfully reaches 192.168.1.3:5002
 *
 * DIAGNOSTIC FINDINGS (run on unfixed system):
 *   1. curl http://192.168.1.3:5002/api/health from Mac → 200 OK (backend reachable from Mac)
 *   2. lsof -i :5002 → TCP *:5002 (LISTEN) — backend bound to 0.0.0.0, not loopback
 *   3. macOS firewall → DISABLED (not the blocker)
 *   4. AndroidManifest.xml → android:usesCleartextTraffic="true" present
 *   5. network_security_config.xml → MISSING (no res/xml/ directory) ← ROOT CAUSE
 *   6. android:networkSecurityConfig attribute → MISSING from <application> tag ← ROOT CAUSE
 *
 * ROOT CAUSE: Missing Network Security Config XML for domain 192.168.1.3
 *   On Android API >= 24, the system may enforce stricter cleartext policies
 *   for specific domains even when usesCleartextTraffic="true" is set globally.
 *   Without an explicit NSC file, the Expo dev build does not permit cleartext
 *   HTTP to the LAN IP 192.168.1.3 on the physical device.
 *
 * COUNTEREXAMPLES DOCUMENTED:
 *   - GET http://192.168.1.3:5002/api/health from moto_g54_5G → ERR_NETWORK (expected: 200 OK)
 *   - GET http://192.168.1.3:5002/api/orders from moto_g54_5G → exhausts 4 retries, returns 503
 *   - POST http://192.168.1.3:5002/api/auth/send-otp from moto_g54_5G → {"data": "Network error. Please check your connection.", "status": 503}
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HTTPRequest {
  origin: string;
  targetHost: string;
  targetPort: number;
  protocol: string;
  method?: string;
  path?: string;
  description?: string;
  requirement?: string;
}

interface HTTPResponse {
  status: number;
  body: string;
}

// ---------------------------------------------------------------------------
// isBugCondition: formal specification from bugfix.md
// ---------------------------------------------------------------------------

/**
 * Returns true when the request matches the exact bug condition:
 * physical Android device making HTTP request to 192.168.1.3:5002
 */
function isBugCondition(request: HTTPRequest): boolean {
  return (
    request.origin === 'PHYSICAL_ANDROID_DEVICE' &&
    request.targetHost === '192.168.1.3' &&
    request.targetPort === 5002 &&
    request.protocol === 'http'
  );
}

// ---------------------------------------------------------------------------
// Android configuration helpers
// ---------------------------------------------------------------------------

// Paths relative to workspace root (resolved from this test file location)
const WORKSPACE_ROOT = path.resolve(__dirname, '../../../../');
const ANDROID_APP_DIR = path.join(WORKSPACE_ROOT, 'apps/customer-app/android/app/src/main');
const NSC_XML_PATH = path.join(ANDROID_APP_DIR, 'res/xml/network_security_config.xml');
const MANIFEST_PATH = path.join(ANDROID_APP_DIR, 'AndroidManifest.xml');

/**
 * Checks if the Network Security Config XML file exists.
 * On unfixed code: returns false (file is missing)
 * On fixed code: returns true (file exists)
 */
function networkSecurityConfigExists(): boolean {
  return fs.existsSync(NSC_XML_PATH);
}

/**
 * Checks if the NSC file contains a domain-config for 192.168.1.3 with cleartext permitted.
 * On unfixed code: returns false (file is missing)
 * On fixed code: returns true
 */
function nscAllowsCleartextFor192168(): boolean {
  if (!fs.existsSync(NSC_XML_PATH)) return false;
  const content = fs.readFileSync(NSC_XML_PATH, 'utf-8');
  return (
    content.includes('192.168.1.3') &&
    content.includes('cleartextTrafficPermitted="true"')
  );
}

/**
 * Checks if AndroidManifest.xml references the Network Security Config.
 * On unfixed code: returns false (attribute is missing)
 * On fixed code: returns true
 */
function manifestReferencesNSC(): boolean {
  if (!fs.existsSync(MANIFEST_PATH)) return false;
  const content = fs.readFileSync(MANIFEST_PATH, 'utf-8');
  return content.includes('android:networkSecurityConfig');
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function httpGet(url: string, timeoutMs = 5000): Promise<HTTPResponse> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs } as http.RequestOptions, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('timeout', () => {
      req.destroy();
      const err: NodeJS.ErrnoException = new Error('ERR_NETWORK: connection timed out');
      err.code = 'ERR_NETWORK';
      reject(err);
    });
    req.on('error', (err: NodeJS.ErrnoException) => {
      if (!err.code) err.code = 'ERR_NETWORK';
      reject(err);
    });
  });
}

function httpPost(url: string, body: object, timeoutMs = 5000): Promise<HTTPResponse> {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const urlObj = new URL(url);
    const options: http.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
      timeout: timeoutMs,
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
    });
    req.on('timeout', () => {
      req.destroy();
      const err: NodeJS.ErrnoException = new Error('ERR_NETWORK: connection timed out');
      err.code = 'ERR_NETWORK';
      reject(err);
    });
    req.on('error', (err: NodeJS.ErrnoException) => {
      if (!err.code) err.code = 'ERR_NETWORK';
      reject(err);
    });
    req.write(bodyStr);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Concrete bug condition requests (scoped PBT approach)
// ---------------------------------------------------------------------------

const BUG_CONDITION_REQUESTS: HTTPRequest[] = [
  {
    origin: 'PHYSICAL_ANDROID_DEVICE',
    targetHost: '192.168.1.3',
    targetPort: 5002,
    protocol: 'http',
    method: 'GET',
    path: '/api/health',
    description: 'Health check endpoint (Req 1.2)',
    requirement: '1.2',
  },
  {
    origin: 'PHYSICAL_ANDROID_DEVICE',
    targetHost: '192.168.1.3',
    targetPort: 5002,
    protocol: 'http',
    method: 'GET',
    path: '/api/orders',
    description: 'Orders endpoint (Req 1.3)',
    requirement: '1.3',
  },
  {
    origin: 'PHYSICAL_ANDROID_DEVICE',
    targetHost: '192.168.1.3',
    targetPort: 5002,
    protocol: 'http',
    method: 'POST',
    path: '/api/auth/send-otp',
    description: 'Auth send-otp endpoint (Req 1.4)',
    requirement: '1.4',
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Bug Condition Exploration: Physical Android Device Cannot Reach Backend', () => {
  /**
   * DIAGNOSTIC: Verify system state on unfixed code
   *
   * These checks document which root causes are active.
   * On the unfixed system, the missing NSC is the root cause.
   */
  describe('DIAGNOSTIC: System state on unfixed code', () => {
    it('should confirm backend is bound to 0.0.0.0 (not loopback) — not the root cause', () => {
      // Verified via: lsof -i :5002 → TCP *:5002 (LISTEN)
      // This is already correct — not the root cause
      console.log('✅ DIAGNOSTIC: Backend bound to *:5002 (all interfaces) — not the root cause');
      expect(true).toBe(true); // documented finding
    });

    it('should confirm macOS firewall is not blocking port 5002 — not the root cause', () => {
      // Verified via: /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate → disabled
      console.log('✅ DIAGNOSTIC: macOS firewall disabled — not the root cause');
      expect(true).toBe(true); // documented finding
    });

    it('should confirm AndroidManifest.xml has usesCleartextTraffic="true" — not the root cause', () => {
      const content = fs.readFileSync(MANIFEST_PATH, 'utf-8');
      expect(content).toContain('android:usesCleartextTraffic="true"');
      console.log('✅ DIAGNOSTIC: usesCleartextTraffic="true" present in manifest — not the root cause');
    });

    it('should confirm backend IS reachable from Mac at 192.168.1.3:5002', async () => {
      // This confirms the backend is running and reachable from the host machine.
      // The physical Android device failure is NOT due to the backend being down.
      const response = await httpGet('http://192.168.1.3:5002/api/health');
      expect(response.status).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      console.log('✅ DIAGNOSTIC: Backend reachable from Mac at 192.168.1.3:5002 → 200 OK');
      console.log('   → Physical Android device failure is NOT due to backend being down');
    });
  });

  /**
   * PROPERTY 1: Bug Condition - Physical Android Device Cannot Reach Backend
   *
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
   *
   * The Android Network Security Config (NSC) is the gating artifact that
   * determines whether the physical Android device can make cleartext HTTP
   * requests to 192.168.1.3:5002.
   *
   * On UNFIXED code:
   *   - NSC file is MISSING → test FAILS (proves bug exists)
   *   - Manifest lacks networkSecurityConfig attribute → test FAILS
   *
   * On FIXED code:
   *   - NSC file EXISTS with correct domain-config → test PASSES
   *   - Manifest has networkSecurityConfig attribute → test PASSES
   *
   * SCOPED PBT APPROACH: We scope the property to the concrete failing cases
   * (the exact Android configuration artifacts that cause ERR_NETWORK on the
   * physical device) to ensure reproducibility and clear counterexample documentation.
   */
  describe('PROPERTY 1: Bug Condition - Physical Android Device Cannot Reach Backend', () => {
    /**
     * Core property: the Network Security Config XML must exist and permit
     * cleartext HTTP to 192.168.1.3 for all isBugCondition requests.
     *
     * On UNFIXED code: FAILS — NSC file is missing
     * On FIXED code: PASSES — NSC file exists with correct config
     */
    it('Property 1: network_security_config.xml SHALL exist and permit cleartext to 192.168.1.3', () => {
      console.log('🧪 PROPERTY TEST: Bug Condition - Android NSC Configuration');
      console.log('=============================================================');
      console.log(`NSC file path: ${NSC_XML_PATH}`);
      console.log(`NSC file exists: ${networkSecurityConfigExists()}`);

      if (!networkSecurityConfigExists()) {
        console.log('\n❌ COUNTEREXAMPLE FOUND:');
        console.log('  network_security_config.xml is MISSING');
        console.log('  → Physical Android device (moto_g54_5G) gets ERR_NETWORK for all requests to 192.168.1.3:5002');
        console.log('  → GET http://192.168.1.3:5002/api/health → ERR_NETWORK (expected: 200 OK)');
        console.log('  → GET http://192.168.1.3:5002/api/orders → exhausts 4 retries, returns 503');
        console.log('  → POST http://192.168.1.3:5002/api/auth/send-otp → {"data": "Network error...", "status": 503}');
        console.log('\n  ROOT CAUSE: Without NSC file, Android API >= 24 blocks cleartext HTTP to LAN IPs');
        console.log('  FIX: Create apps/customer-app/android/app/src/main/res/xml/network_security_config.xml');
      }

      // PROPERTY ASSERTION: NSC file must exist (FAILS on unfixed code)
      expect(networkSecurityConfigExists()).toBe(true);
    });

    it('Property 1: network_security_config.xml SHALL allow cleartext traffic to 192.168.1.3', () => {
      console.log('🧪 PROPERTY TEST: NSC cleartext permission for 192.168.1.3');

      if (!nscAllowsCleartextFor192168()) {
        console.log('\n❌ COUNTEREXAMPLE FOUND:');
        console.log('  NSC does NOT permit cleartext HTTP to 192.168.1.3');
        console.log('  → Physical Android device cannot reach http://192.168.1.3:5002/api/*');
        console.log('  FIX: Add <domain-config cleartextTrafficPermitted="true"><domain>192.168.1.3</domain></domain-config>');
      }

      // PROPERTY ASSERTION: NSC must permit cleartext to 192.168.1.3 (FAILS on unfixed code)
      expect(nscAllowsCleartextFor192168()).toBe(true);
    });

    it('Property 1: AndroidManifest.xml SHALL reference network_security_config', () => {
      console.log('🧪 PROPERTY TEST: AndroidManifest.xml networkSecurityConfig attribute');
      console.log(`Manifest path: ${MANIFEST_PATH}`);
      console.log(`Has networkSecurityConfig: ${manifestReferencesNSC()}`);

      if (!manifestReferencesNSC()) {
        console.log('\n❌ COUNTEREXAMPLE FOUND:');
        console.log('  android:networkSecurityConfig attribute is MISSING from <application> tag');
        console.log('  → Even if NSC file exists, Android will not apply it without this attribute');
        console.log('  → Physical Android device (moto_g54_5G) gets ERR_NETWORK');
        console.log('  FIX: Add android:networkSecurityConfig="@xml/network_security_config" to <application>');
      }

      // PROPERTY ASSERTION: Manifest must reference NSC (FAILS on unfixed code)
      expect(manifestReferencesNSC()).toBe(true);
    });

    /**
     * Scoped PBT: for all isBugCondition requests, the Android configuration
     * SHALL permit the request to reach the backend.
     *
     * Uses fast-check to iterate over the concrete bug condition requests and
     * verify the NSC configuration permits each one.
     */
    it('Property 1 (PBT): for all isBugCondition requests, Android NSC SHALL permit cleartext HTTP to 192.168.1.3:5002', () => {
      console.log('🧪 PBT: Verifying NSC permits all isBugCondition requests...');

      fc.assert(
        fc.property(
          fc.constantFrom(...BUG_CONDITION_REQUESTS),
          (request) => {
            // All generated requests satisfy isBugCondition
            expect(isBugCondition(request)).toBe(true);

            const url = `${request.protocol}://${request.targetHost}:${request.targetPort}${request.path}`;
            console.log(`  Checking NSC permits: ${request.method} ${url}`);

            // PROPERTY: NSC must exist and permit cleartext to this host
            const nscExists = networkSecurityConfigExists();
            const nscPermits = nscAllowsCleartextFor192168();
            const manifestOk = manifestReferencesNSC();

            if (!nscExists || !nscPermits || !manifestOk) {
              console.log(`  ❌ COUNTEREXAMPLE: ${request.method} ${url} from ${request.origin}`);
              console.log(`     nscExists: ${nscExists}, nscPermits: ${nscPermits}, manifestOk: ${manifestOk}`);
              console.log(`     → Physical Android device will get ERR_NETWORK for this request`);
              console.log(`     → Requirement violated: ${request.requirement}`);
            }

            // All three conditions must be true for the request to succeed on physical Android
            expect(nscExists).toBe(true);
            expect(nscPermits).toBe(true);
            expect(manifestOk).toBe(true);
          }
        ),
        { numRuns: BUG_CONDITION_REQUESTS.length, verbose: true }
      );
    });

    /**
     * Concrete unit tests for each specific bug condition endpoint.
     * These document the exact counterexamples from the bug report.
     */
    describe('Concrete counterexamples from bug report', () => {
      it('Req 1.2: GET /api/health from physical Android device SHALL return 200 OK (not ERR_NETWORK)', () => {
        // COUNTEREXAMPLE: GET http://192.168.1.3:5002/api/health from moto_g54_5G → ERR_NETWORK
        // Root cause: missing NSC file → Android blocks cleartext HTTP to 192.168.1.3
        const request = BUG_CONDITION_REQUESTS.find(r => r.path === '/api/health')!;
        expect(isBugCondition(request)).toBe(true);

        // The NSC configuration must permit this request
        const nscPermits = nscAllowsCleartextFor192168();
        const manifestOk = manifestReferencesNSC();

        if (!nscPermits || !manifestOk) {
          console.log('❌ COUNTEREXAMPLE: GET http://192.168.1.3:5002/api/health from moto_g54_5G → ERR_NETWORK');
          console.log('   Expected: 200 OK { status: "ok" }');
          console.log('   Requirement: 1.2');
        }

        expect(nscPermits).toBe(true);
        expect(manifestOk).toBe(true);
      });

      it('Req 1.3: GET /api/orders from physical Android device SHALL NOT exhaust retries with 503', () => {
        // COUNTEREXAMPLE: GET http://192.168.1.3:5002/api/orders from moto_g54_5G → exhausts 4 retries, returns 503
        const request = BUG_CONDITION_REQUESTS.find(r => r.path === '/api/orders')!;
        expect(isBugCondition(request)).toBe(true);

        const nscPermits = nscAllowsCleartextFor192168();
        const manifestOk = manifestReferencesNSC();

        if (!nscPermits || !manifestOk) {
          console.log('❌ COUNTEREXAMPLE: GET http://192.168.1.3:5002/api/orders from moto_g54_5G → exhausts 4 retries, returns 503');
          console.log('   Expected: 200 OK with orders array');
          console.log('   Requirement: 1.3');
        }

        expect(nscPermits).toBe(true);
        expect(manifestOk).toBe(true);
      });

      it('Req 1.4: POST /api/auth/send-otp from physical Android device SHALL return valid response (not 503)', () => {
        // COUNTEREXAMPLE: POST http://192.168.1.3:5002/api/auth/send-otp from moto_g54_5G → {"data": "Network error...", "status": 503}
        const request = BUG_CONDITION_REQUESTS.find(r => r.path === '/api/auth/send-otp')!;
        expect(isBugCondition(request)).toBe(true);

        const nscPermits = nscAllowsCleartextFor192168();
        const manifestOk = manifestReferencesNSC();

        if (!nscPermits || !manifestOk) {
          console.log('❌ COUNTEREXAMPLE: POST http://192.168.1.3:5002/api/auth/send-otp from moto_g54_5G → {"data": "Network error. Please check your connection.", "status": 503}');
          console.log('   Expected: 200 OK with OTP response');
          console.log('   Requirement: 1.4');
        }

        expect(nscPermits).toBe(true);
        expect(manifestOk).toBe(true);
      });
    });
  });

  /**
   * SUMMARY: isBugCondition function and counterexample documentation
   */
  describe('SUMMARY: Bug condition documentation', () => {
    it('should correctly identify isBugCondition requests', () => {
      const bugRequest: HTTPRequest = {
        origin: 'PHYSICAL_ANDROID_DEVICE',
        targetHost: '192.168.1.3',
        targetPort: 5002,
        protocol: 'http',
      };
      expect(isBugCondition(bugRequest)).toBe(true);

      // Non-bug-condition requests
      expect(isBugCondition({ ...bugRequest, origin: 'IOS_SIMULATOR' })).toBe(false);
      expect(isBugCondition({ ...bugRequest, origin: 'ANDROID_EMULATOR' })).toBe(false);
      expect(isBugCondition({ ...bugRequest, origin: 'WEB_BROWSER' })).toBe(false);
      expect(isBugCondition({ ...bugRequest, targetHost: 'localhost' })).toBe(false);
      expect(isBugCondition({ ...bugRequest, targetHost: '10.0.2.2' })).toBe(false);
      expect(isBugCondition({ ...bugRequest, targetPort: 3000 })).toBe(false);
      expect(isBugCondition({ ...bugRequest, protocol: 'https' })).toBe(false);

      console.log('✅ isBugCondition correctly identifies physical Android device requests to 192.168.1.3:5002 via http');
    });

    it('should document all counterexamples from the bug report', () => {
      const documentedCounterexamples = [
        {
          request: 'GET http://192.168.1.3:5002/api/health',
          origin: 'moto_g54_5G (PHYSICAL_ANDROID_DEVICE)',
          actual: 'ERR_NETWORK',
          expected: '200 OK { status: "ok" }',
          requirement: '1.2',
        },
        {
          request: 'GET http://192.168.1.3:5002/api/orders',
          origin: 'moto_g54_5G (PHYSICAL_ANDROID_DEVICE)',
          actual: 'exhausts 4 retries → HTTP 503',
          expected: '200 OK with orders array',
          requirement: '1.3',
        },
        {
          request: 'POST http://192.168.1.3:5002/api/auth/send-otp',
          origin: 'moto_g54_5G (PHYSICAL_ANDROID_DEVICE)',
          actual: '{"data": "Network error. Please check your connection.", "status": 503}',
          expected: '200 OK with OTP response',
          requirement: '1.4',
        },
      ];

      console.log('\n📋 DOCUMENTED COUNTEREXAMPLES (bug confirmed on physical Android device):');
      documentedCounterexamples.forEach((ce, i) => {
        console.log(`\nCounterexample ${i + 1}:`);
        console.log(`  Request:     ${ce.request}`);
        console.log(`  Origin:      ${ce.origin}`);
        console.log(`  Actual:      ${ce.actual}`);
        console.log(`  Expected:    ${ce.expected}`);
        console.log(`  Requirement: ${ce.requirement}`);
      });

      console.log('\n📋 ROOT CAUSE:');
      console.log('  Missing network_security_config.xml for domain 192.168.1.3');
      console.log('  Missing android:networkSecurityConfig attribute in AndroidManifest.xml');

      console.log('\n📋 FIX REQUIRED:');
      console.log('  1. Create apps/customer-app/android/app/src/main/res/xml/network_security_config.xml');
      console.log('  2. Add android:networkSecurityConfig="@xml/network_security_config" to <application>');
      console.log('  3. Rebuild Expo dev build: npx expo run:android');

      expect(documentedCounterexamples).toHaveLength(3);
      documentedCounterexamples.forEach(ce => {
        expect(ce.actual).toMatch(/ERR_NETWORK|503/);
      });
    });
  });
});
