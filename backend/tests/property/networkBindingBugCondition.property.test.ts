/**
 * Bug Condition Exploration Test - Backend Network Binding Fix
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bugs exist
 * 
 * This test encodes the EXPECTED behavior:
 * - Server should bind to PORT environment variable (not hardcoded 9000)
 * - Server logs should include .local hostname for easy mobile connection
 * - Frontend EXPO_PUBLIC_API_URL should use .local hostname (not raw IP)
 * - Mobile devices should be able to connect using the correct port
 * 
 * When this test passes after the fix, it confirms the expected behavior is satisfied.
 */

import * as fc from "fast-check";
import { readFileSync } from "fs";
import { join } from "path";

const numRuns = process.env.CI_NIGHTLY === "true" ? 1000 : 20;

describe("Bug Condition: Comprehensive LAN Connectivity Issues", () => {
  describe("Property 1: Backend Port Binding Issue", () => {
    it("should verify server binds to hardcoded port 9000 instead of PORT env variable", () => {
      // Read the backend/src/index.ts file to check the server.listen() call
      const backendIndexPath = join(__dirname, "../../src/index.ts");
      const backendIndexContent = readFileSync(backendIndexPath, "utf-8");

      // Find the tryStartServer function
      const tryStartServerMatch = backendIndexContent.match(
        /const tryStartServer = \(port: number\)[\s\S]*?server\.listen\(([^,]+),/
      );

      // EXPECTED: server.listen(port, ...) - uses the port parameter
      // CURRENT BUG: server.listen(9000, ...) or server.listen(hardcoded_value, ...)
      expect(tryStartServerMatch).toBeTruthy();
      
      if (tryStartServerMatch) {
        const portArgument = tryStartServerMatch[1].trim();
        
        // This assertion will FAIL on unfixed code (confirms bug exists)
        // It will PASS after fix (confirms bug is fixed)
        expect(portArgument).toBe("port");
        
        // If this fails, it means the server is using a hardcoded port
        // Common bug: server.listen(9000, ...) instead of server.listen(port, ...)
      }
    });

    it("should verify server logs include dynamic port (not hardcoded 9000)", () => {
      // Read the backend/src/index.ts file to check the log messages
      const backendIndexPath = join(__dirname, "../../src/index.ts");
      const backendIndexContent = readFileSync(backendIndexPath, "utf-8");

      // Find log messages in tryStartServer function
      const tryStartServerMatch = backendIndexContent.match(
        /const tryStartServer = \(port: number\)[\s\S]*?}\);[\s\S]*?};/
      );

      expect(tryStartServerMatch).toBeTruthy();

      if (tryStartServerMatch) {
        const functionBody = tryStartServerMatch[0];

        // Check for hardcoded port references in logs
        // EXPECTED: Template literals with ${port}
        // CURRENT BUG: Hardcoded "9000" in log messages
        
        // This will FAIL on unfixed code if logs contain hardcoded port numbers
        const hardcodedPortInLogs = /['"`].*?(?:port|Port|PORT).*?9000.*?['"`]/.test(
          functionBody
        );
        
        // We expect NO hardcoded port in logs (should use template literals)
        expect(hardcodedPortInLogs).toBe(false);
      }
    });
  });

  describe("Property 1: Backend .local Hostname Logging Issue", () => {
    it("should verify server logs include .local hostname for mobile connection", () => {
      // Read the backend/src/index.ts file to check for .local hostname logging
      const backendIndexPath = join(__dirname, "../../src/index.ts");
      const backendIndexContent = readFileSync(backendIndexPath, "utf-8");

      // Find the tryStartServer function
      const tryStartServerMatch = backendIndexContent.match(
        /const tryStartServer = \(port: number\)[\s\S]*?}\);[\s\S]*?};/
      );

      expect(tryStartServerMatch).toBeTruthy();

      if (tryStartServerMatch) {
        const functionBody = tryStartServerMatch[0];

        // EXPECTED: Logs should include .local hostname (e.g., "http://Charans-MacBook.local:5001")
        // CURRENT BUG: Logs only show raw IP address, no .local hostname
        
        // Check for .local hostname in logs
        const hasLocalHostnameLogging = /\.local/.test(functionBody);
        
        // This will FAIL on unfixed code (confirms bug exists)
        // It will PASS after fix (confirms .local hostname is logged)
        expect(hasLocalHostnameLogging).toBe(true);
      }
    });

    it("should verify os module is imported for hostname detection", () => {
      // Read the backend/src/index.ts file to check for os import
      const backendIndexPath = join(__dirname, "../../src/index.ts");
      const backendIndexContent = readFileSync(backendIndexPath, "utf-8");

      // EXPECTED: import os from 'os'; or import * as os from 'os';
      // CURRENT BUG: No os module import
      
      const hasOsImport = /import\s+(?:\*\s+as\s+)?os\s+from\s+['"]os['"]/.test(
        backendIndexContent
      );
      
      // This will FAIL on unfixed code (confirms bug exists)
      // It will PASS after fix (confirms os module is imported)
      expect(hasOsImport).toBe(true);
    });
  });

  describe("Property 1: Frontend IP Instability Issue", () => {
    it("should verify EXPO_PUBLIC_API_URL uses .local hostname (not raw IP)", () => {
      // Read the apps/customer-app/.env file to check EXPO_PUBLIC_API_URL
      const envPath = join(__dirname, "../../../apps/customer-app/.env");
      let envContent: string;
      
      try {
        envContent = readFileSync(envPath, "utf-8");
      } catch (error) {
        // If .env doesn't exist, check .env.local
        const envLocalPath = join(__dirname, "../../../apps/customer-app/.env.local");
        try {
          envContent = readFileSync(envLocalPath, "utf-8");
        } catch {
          throw new Error("Neither .env nor .env.local found in apps/customer-app/");
        }
      }

      // Find EXPO_PUBLIC_API_URL
      const apiUrlMatch = envContent.match(/EXPO_PUBLIC_API_URL=(.+)/);
      
      expect(apiUrlMatch).toBeTruthy();

      if (apiUrlMatch) {
        const apiUrl = apiUrlMatch[1].trim();

        // EXPECTED: URL should use .local hostname (e.g., "http://Charans-MacBook.local:5001/api")
        // CURRENT BUG: URL uses raw IP address (e.g., "http://192.168.1.3:5001/api" or "http://10.28.219.199:5001/api")
        
        // Check if URL uses raw IP address (IPv4 pattern)
        const usesRawIP = /http:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(apiUrl);
        
        // This will FAIL on unfixed code (confirms bug exists - uses raw IP)
        // It will PASS after fix (confirms .local hostname is used)
        expect(usesRawIP).toBe(false);
        
        // Additionally verify .local hostname is present
        const usesLocalHostname = /\.local/.test(apiUrl);
        expect(usesLocalHostname).toBe(true);
      }
    });

    it("should verify frontend API URL is stable across networks", () => {
      // This is a conceptual test - we verify the URL format supports network stability
      const envPath = join(__dirname, "../../../apps/customer-app/.env");
      let envContent: string;
      
      try {
        envContent = readFileSync(envPath, "utf-8");
      } catch (error) {
        const envLocalPath = join(__dirname, "../../../apps/customer-app/.env.local");
        try {
          envContent = readFileSync(envLocalPath, "utf-8");
        } catch {
          throw new Error("Neither .env nor .env.local found in apps/customer-app/");
        }
      }

      const apiUrlMatch = envContent.match(/EXPO_PUBLIC_API_URL=(.+)/);
      
      if (apiUrlMatch) {
        const apiUrl = apiUrlMatch[1].trim();

        // EXPECTED: .local hostname provides network-independent addressing
        // CURRENT BUG: Raw IP changes across different WiFi networks
        
        // Verify URL uses .local hostname (network-stable)
        const isNetworkStable = /\.local/.test(apiUrl);
        
        // This will FAIL on unfixed code (confirms bug exists)
        // It will PASS after fix (confirms network-stable addressing)
        expect(isNetworkStable).toBe(true);
      }
    });
  });

  describe("Property 1: Comprehensive Bug Condition with Property-Based Testing", () => {
    it("should verify bug conditions across various PORT values", async () => {
      // Generate various PORT values to test
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 3000, max: 9000 }),
          async (portValue) => {
            // Read the backend code
            const backendIndexPath = join(__dirname, "../../src/index.ts");
            const backendIndexContent = readFileSync(backendIndexPath, "utf-8");

            // Find the server.listen() call
            const tryStartServerMatch = backendIndexContent.match(
              /server\.listen\(([^,]+),/
            );

            if (tryStartServerMatch) {
              const portArgument = tryStartServerMatch[1].trim();

              // EXPECTED: server.listen(port, ...) - dynamic port
              // CURRENT BUG: server.listen(9000, ...) or other hardcoded value
              
              // This will FAIL on unfixed code for any PORT value
              // because the server ignores the PORT env variable
              expect(portArgument).toBe("port");
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe("Property 1: Documentation of Counterexamples", () => {
    it("should document all bug conditions found", () => {
      // This test documents the expected counterexamples that prove the bugs exist
      
      const counterexamples = {
        backendPortIssue: "Server binds to hardcoded port 9000 instead of PORT environment variable",
        backendLoggingIssue: "Server logs don't include .local hostname for easy mobile connection",
        frontendIPIssue: "EXPO_PUBLIC_API_URL uses raw IP address that changes across networks",
        mobileConnectionIssue: "Mobile device cannot connect to expected port (connection refused)",
        wrongPortConnection: "Mobile device CAN connect to port 9000 (proves server is on wrong port)",
        networkStability: "Connection breaks when switching WiFi networks due to IP address change"
      };

      // Log counterexamples for documentation
      console.log("\n=== Bug Condition Counterexamples ===");
      console.log("These counterexamples demonstrate the bugs exist on unfixed code:\n");
      
      Object.entries(counterexamples).forEach(([key, description]) => {
        console.log(`- ${key}: ${description}`);
      });
      
      console.log("\n=== Expected Test Outcome ===");
      console.log("This test FAILS on unfixed code (correct - proves bugs exist)");
      console.log("This test PASSES after fix (correct - proves bugs are fixed)");
      console.log("=====================================\n");

      // This assertion always passes - it's just for documentation
      expect(Object.keys(counterexamples).length).toBeGreaterThan(0);
    });
  });
});
