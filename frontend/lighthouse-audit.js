#!/usr/bin/env node

/**
 * Lighthouse Audit Script for CPS Store
 * Checks for performance, accessibility, and best practices
 */

const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const path = require('path');

const config = {
  extends: 'lighthouse:default',
  settings: {
    onlyCategories: ['performance', 'accessibility', 'best-practices'],
    throttlingMethod: 'simulate',
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0
    }
  }
};

async function runLighthouseAudit(url) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  const options = {
    logLevel: 'info',
    output: 'json',
    onlyCategories: ['performance', 'accessibility', 'best-practices'],
    port: chrome.port,
  };

  try {
    const runnerResult = await lighthouse(url, options, config);
    
    // Extract scores
    const scores = {
      performance: Math.round(runnerResult.lhr.categories.performance.score * 100),
      accessibility: Math.round(runnerResult.lhr.categories.accessibility.score * 100),
      'best-practices': Math.round(runnerResult.lhr.categories['best-practices'].score * 100)
    };

    // Extract accessibility issues
    const accessibilityIssues = runnerResult.lhr.audits;
    const criticalIssues = Object.values(accessibilityIssues)
      .filter(audit => audit.score !== null && audit.score < 0.9)
      .map(audit => ({
        id: audit.id,
        title: audit.title,
        description: audit.description,
        score: Math.round(audit.score * 100)
      }));

    return {
      scores,
      accessibilityIssues: criticalIssues,
      raw: runnerResult.lhr
    };
  } finally {
    await chrome.kill();
  }
}

async function main() {
  const url = process.argv[2] || 'http://localhost:5173';
  
  console.log(`🔍 Running Lighthouse audit on ${url}...`);
  
  try {
    const results = await runLighthouseAudit(url);
    
    console.log('\n📊 Lighthouse Results:');
    console.log('====================');
    console.log(`Performance: ${results.scores.performance}/100`);
    console.log(`Accessibility: ${results.scores.accessibility}/100`);
    console.log(`Best Practices: ${results.scores['best-practices']}/100`);
    
    console.log('\n🎯 Phase 8 Requirements Check:');
    console.log('==============================');
    
    // Check mobile performance score (should be >= 80)
    const performancePass = results.scores.performance >= 80;
    console.log(`✅ Mobile Performance Score: ${results.scores.performance}/100 ${performancePass ? '✅ PASS' : '❌ FAIL'}`);
    
    // Check accessibility issues (should be <= 5)
    const accessibilityPass = results.accessibilityIssues.length <= 5;
    console.log(`✅ Accessibility Issues: ${results.accessibilityIssues.length} ${accessibilityPass ? '✅ PASS' : '❌ FAIL'}`);
    
    console.log('\n🚨 Accessibility Issues:');
    console.log('========================');
    
    if (results.accessibilityIssues.length === 0) {
      console.log('🎉 No accessibility issues found!');
    } else {
      results.accessibilityIssues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.title}`);
        console.log(`   Score: ${issue.score}/100`);
        console.log(`   Description: ${issue.description}`);
        console.log('');
      });
    }
    
    // Overall result
    const overallPass = performancePass && accessibilityPass;
    console.log(`\n🏆 Overall Result: ${overallPass ? '✅ PASS' : '❌ FAIL'}`);
    
    if (!overallPass) {
      console.log('\n💡 Recommendations:');
      if (!performancePass) {
        console.log('- Optimize images and assets');
        console.log('- Implement code splitting');
        console.log('- Use lazy loading for images');
      }
      if (!accessibilityPass) {
        console.log('- Add proper ARIA labels');
        console.log('- Ensure color contrast meets WCAG standards');
        console.log('- Add keyboard navigation support');
      }
    }
    
    // Save results to file
    const reportPath = path.join(__dirname, 'lighthouse-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
    process.exit(overallPass ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Lighthouse audit failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { runLighthouseAudit };
