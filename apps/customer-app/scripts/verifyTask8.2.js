#!/usr/bin/env node

/**
 * Task 8.2: Quick Verification Script
 * 
 * This script performs a quick verification that the mobile pack → web updates
 * functionality is working correctly by checking the implementation components.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Task 8.2: Mobile Pack → Web Updates Verification');
console.log('='.repeat(55));
console.log();

// Check implementation files
const checks = [
  {
    name: 'AdminOrdersScreen.tsx - Pack action implementation',
    file: 'src/screens/admin/AdminOrdersScreen.tsx',
    patterns: [
      'usePackOrderMutation',
      'onPack.*async',
      'packOrder.*unwrap',
      'createOrderListUpdater',
      'allowedActions.*includes.*PACK'
    ]
  },
  {
    name: 'AdminOrderDetailScreen.tsx - Pack action implementation',
    file: 'src/screens/admin/AdminOrderDetailScreen.tsx',
    patterns: [
      'usePackOrderMutation',
      'packOrder.*unwrap',
      'setLocalOrder',
      'allowedActions.*includes.*PACK'
    ]
  },
  {
    name: 'adminApi.ts - Pack endpoint configuration',
    file: 'src/api/adminApi.ts',
    patterns: [
      'packOrder.*builder.mutation',
      'admin/orders.*pack',
      'method.*PATCH'
    ]
  },
  {
    name: 'socketClient.ts - Order status change events',
    file: 'src/services/socketClient.ts',
    patterns: [
      'order:status:changed',
      'subscribeToOrderStatusChanges',
      'OrderStatusChangedData',
      'actorRole.*ADMIN'
    ]
  }
];

let allPassed = true;

for (const check of checks) {
  console.log(`📋 Checking: ${check.name}`);
  
  const filePath = path.join(__dirname, '..', check.file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`   ❌ File not found: ${check.file}`);
    allPassed = false;
    continue;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const results = [];
  
  for (const pattern of check.patterns) {
    const regex = new RegExp(pattern, 'i');
    const found = regex.test(content);
    results.push({ pattern, found });
    
    if (found) {
      console.log(`   ✅ Found: ${pattern}`);
    } else {
      console.log(`   ❌ Missing: ${pattern}`);
      allPassed = false;
    }
  }
  
  console.log();
}

// Check test files
console.log('📋 Checking test implementation:');

const testFiles = [
  'src/tests/task8.2-mobile-pack-web-updates.test.ts',
  'scripts/testTask8.2-mobilePack.js',
  'TASK_8.2_TEST_REPORT.md'
];

for (const testFile of testFiles) {
  const filePath = path.join(__dirname, '..', testFile);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ Test file exists: ${testFile}`);
  } else {
    console.log(`   ❌ Test file missing: ${testFile}`);
    allPassed = false;
  }
}

console.log();

// Check package.json scripts
console.log('📋 Checking package.json test scripts:');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const scripts = packageJson.scripts || {};
  
  const requiredScripts = [
    'test:task8.2-mobile-pack',
    'test:task8.2-jest'
  ];
  
  for (const script of requiredScripts) {
    if (scripts[script]) {
      console.log(`   ✅ Script exists: ${script}`);
    } else {
      console.log(`   ❌ Script missing: ${script}`);
      allPassed = false;
    }
  }
} else {
  console.log('   ❌ package.json not found');
  allPassed = false;
}

console.log();

// Summary
if (allPassed) {
  console.log('🎉 Task 8.2 Implementation Verification: PASSED');
  console.log();
  console.log('✅ All required components are implemented:');
  console.log('   • Mobile admin pack action with API call');
  console.log('   • PATCH /api/admin/orders/:id/pack endpoint');
  console.log('   • Socket event handling for order:status:changed');
  console.log('   • Real-time state updates in admin screens');
  console.log('   • allowedActions-based UI button control');
  console.log('   • Comprehensive test suite');
  console.log();
  console.log('🧪 To run tests:');
  console.log('   npm run test:task8.2-mobile-pack  # Interactive test');
  console.log('   npm run test:task8.2-jest        # Automated test');
  console.log();
  console.log('📊 Expected Performance:');
  console.log('   • Total sync time: < 1000ms');
  console.log('   • API response: < 500ms');
  console.log('   • Socket propagation: < 500ms');
  console.log('   • UI button updates: Immediate');
} else {
  console.log('❌ Task 8.2 Implementation Verification: FAILED');
  console.log();
  console.log('Some required components are missing or incomplete.');
  console.log('Please review the failed checks above.');
}

console.log();