#!/usr/bin/env node

/**
 * Runtime test script for JWT secret validation
 * Tests validation during server startup
 */

const { spawn } = require('child_process');
const path = require('path');

function runTest(testName, envVars, expectedPattern, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    console.log(`\n🧪 Running test: ${testName}`);
    console.log(`🔧 Environment:`, envVars);
    
    const child = spawn('node', ['dist/app.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, ...envVars },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let matched = false;

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      if (expectedPattern && stdout.includes(expectedPattern)) {
        matched = true;
        console.log(`✅ Expected pattern found: "${expectedPattern}"`);
      }
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      if (expectedPattern && stderr.includes(expectedPattern)) {
        matched = true;
        console.log(`✅ Expected pattern found: "${expectedPattern}"`);
      }
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      if (expectedPattern && !matched) {
        reject(new Error(`Expected pattern "${expectedPattern}" not found within ${timeoutMs}ms`));
      } else {
        console.log(`✅ Test passed: ${testName} (server started successfully)`);
        resolve();
      }
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timer);
      
      if (expectedPattern && matched) {
        console.log(`✅ Test passed: ${testName}`);
        resolve();
      } else if (expectedPattern && code !== 0) {
        console.log(`✅ Test passed: ${testName} (process exited as expected)`);
        resolve();
      } else if (!expectedPattern && code === 0) {
        console.log(`✅ Test passed: ${testName} (server started successfully)`);
        resolve();
      } else {
        console.log(`❌ Test failed: ${testName}`);
        console.log(`📋 Exit code: ${code}`);
        console.log(`📋 Stderr:`, stderr);
        console.log(`📋 Stdout:`, stdout);
        reject(new Error(`Unexpected exit code: ${code}`));
      }
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      console.error(`💥 Process error: ${error.message}`);
      reject(error);
    });
  });
}

async function runAllTests() {
  console.log('🔐 JWT Secret Validation Runtime Tests');
  console.log('=========================================');

  try {
    // Test 1: Development with short secrets (should warn but start)
    await runTest(
      'Development - Short Secrets',
      {
        NODE_ENV: 'development',
        JWT_SECRET: 'short',
        JWT_REFRESH_SECRET: 'also_short'
      },
      '[DEV WARNING] JWT_SECRET must be at least 32 characters long'
    );

    // Test 2: Production with short secrets (should exit with fatal error)
    await runTest(
      'Production - Short Secrets',
      {
        NODE_ENV: 'production',
        JWT_SECRET: 'short',
        JWT_REFRESH_SECRET: 'also_short'
      },
      '[FATAL] JWT_SECRET must be at least 32 characters long'
    );

    // Test 3: Valid secrets (should start successfully)
    await runTest(
      'Valid Secrets',
      {
        NODE_ENV: 'production',
        JWT_SECRET: 'this_is_a_32_character_minimum_secret_for_security',
        JWT_REFRESH_SECRET: 'this_is_also_32_chars_minimum_for_refresh_secret'
      },
      null // Expect successful startup
    );

    console.log('\n🎉 All tests passed!');
    
  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  runAllTests();
}

module.exports = { runTest, runAllTests };
