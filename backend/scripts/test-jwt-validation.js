#!/usr/bin/env node

/**
 * Manual test script for JWT secret validation
 * Tests different scenarios to ensure proper behavior
 */

const { spawn } = require('child_process');
const path = require('path');

function runTest(testName, envVars, expectedExitCode = 0) {
  return new Promise((resolve, reject) => {
    console.log(`\n🧪 Running test: ${testName}`);
    console.log(`🔧 Environment:`, envVars);
    
    const child = spawn('npm', ['run', 'build'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, ...envVars },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      console.log(`📊 Exit code: ${code}`);
      
      if (stderr.includes('[DEV WARNING]')) {
        console.log(`⚠️  Development warning detected (expected)`);
      }
      
      if (stderr.includes('[FATAL]')) {
        console.log(`❌ Fatal error detected (expected in production)`);
      }
      
      if (code === expectedExitCode) {
        console.log(`✅ Test passed: ${testName}`);
        resolve();
      } else {
        console.log(`❌ Test failed: ${testName}`);
        console.log(`📋 Stderr:`, stderr);
        console.log(`📋 Stdout:`, stdout);
        reject(new Error(`Expected exit code ${expectedExitCode}, got ${code}`));
      }
    });

    child.on('error', (error) => {
      console.error(`💥 Process error: ${error.message}`);
      reject(error);
    });
  });
}

async function runAllTests() {
  console.log('🔐 JWT Secret Validation Tests');
  console.log('================================');

  try {
    // Test 1: Development with short secrets (should warn but build)
    await runTest(
      'Development - Short Secrets',
      {
        NODE_ENV: 'development',
        JWT_SECRET: 'short',
        JWT_REFRESH_SECRET: 'also_short'
      },
      0
    );

    // Test 2: Production with short secrets (should fail)
    await runTest(
      'Production - Short Secrets',
      {
        NODE_ENV: 'production',
        JWT_SECRET: 'short',
        JWT_REFRESH_SECRET: 'also_short'
      },
      1
    );

    // Test 3: Valid secrets (should pass)
    await runTest(
      'Valid Secrets',
      {
        NODE_ENV: 'production',
        JWT_SECRET: 'this_is_a_32_character_minimum_secret_for_security',
        JWT_REFRESH_SECRET: 'this_is_also_32_chars_minimum_for_refresh_secret'
      },
      0
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
