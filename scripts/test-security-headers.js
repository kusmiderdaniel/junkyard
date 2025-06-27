#!/usr/bin/env node

/**
 * Security Headers Testing Script
 * Tests that all required security headers are properly implemented
 */

const fs = require('fs');
const path = require('path');

console.log('🔒 Security Headers Testing Script\n');

// Test 1: Check HTML file for CSP headers
function testHTMLHeaders() {
  console.log('📄 Testing HTML meta tags...');

  const htmlPath = path.join(__dirname, '../public/index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  const requiredHeaders = [
    'Content-Security-Policy',
    'X-Frame-Options',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'Permissions-Policy',
  ];

  let passed = 0;
  requiredHeaders.forEach(header => {
    if (htmlContent.includes(header)) {
      console.log(`   ✅ ${header} found`);
      passed++;
    } else {
      console.log(`   ❌ ${header} missing`);
    }
  });

  console.log(
    `   📊 ${passed}/${requiredHeaders.length} headers implemented\n`
  );
  return passed === requiredHeaders.length;
}

// Test 2: Check server configuration files
function testServerConfigs() {
  console.log('🖥️  Testing server configuration files...');

  const configs = [
    { file: '../public/_headers', name: 'Netlify/Vercel headers' },
    { file: '../public/.htaccess', name: 'Apache configuration' },
  ];

  let configsFound = 0;
  configs.forEach(config => {
    const configPath = path.join(__dirname, config.file);
    if (fs.existsSync(configPath)) {
      console.log(`   ✅ ${config.name} exists`);
      configsFound++;
    } else {
      console.log(`   ❌ ${config.name} missing`);
    }
  });

  console.log(`   📊 ${configsFound}/${configs.length} configurations found\n`);
  return configsFound > 0;
}

// Test 3: Check ErrorBoundary security
function testErrorBoundarySecurity() {
  console.log('🛡️  Testing ErrorBoundary security...');

  const errorBoundaryPath = path.join(
    __dirname,
    '../src/components/ErrorBoundary.tsx'
  );
  const content = fs.readFileSync(errorBoundaryPath, 'utf8');

  let securityIssues = 0;

  // Check for insecure localStorage access
  if (content.includes("localStorage.getItem('userId')")) {
    console.log('   ❌ Insecure localStorage access found');
    securityIssues++;
  } else {
    console.log('   ✅ No insecure localStorage access');
  }

  // Check for secure user ID method
  if (content.includes('getCurrentUserIdSecure')) {
    console.log('   ✅ Secure user ID method implemented');
  } else {
    console.log('   ❌ Secure user ID method missing');
    securityIssues++;
  }

  console.log(
    `   📊 ${securityIssues === 0 ? 'Secure' : `${securityIssues} issues found`}\n`
  );
  return securityIssues === 0;
}

// Test 4: Check CSP policy strength
function testCSPStrength() {
  console.log('🔐 Testing CSP policy strength...');

  const htmlPath = path.join(__dirname, '../public/index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  const cspMatch = htmlContent.match(
    /Content-Security-Policy[^>]+content="([^"]+)"/
  );
  if (!cspMatch) {
    console.log('   ❌ CSP policy not found');
    return false;
  }

  const cspPolicy = cspMatch[1];
  const securityChecks = [
    { check: "object-src 'none'", name: 'Blocks plugins' },
    { check: "frame-ancestors 'none'", name: 'Prevents clickjacking' },
    { check: "base-uri 'self'", name: 'Prevents base tag injection' },
    { check: "form-action 'self'", name: 'Restricts form submissions' },
  ];

  let secureDirectives = 0;
  securityChecks.forEach(({ check, name }) => {
    if (cspPolicy.includes(check)) {
      console.log(`   ✅ ${name}`);
      secureDirectives++;
    } else {
      console.log(`   ❌ ${name} missing`);
    }
  });

  console.log(
    `   📊 ${secureDirectives}/${securityChecks.length} security directives implemented\n`
  );
  return secureDirectives === securityChecks.length;
}

// Test 5: Check documentation
function testDocumentation() {
  console.log('📚 Testing security documentation...');

  const docsPath = path.join(
    __dirname,
    '../docs/security/CSP_IMPLEMENTATION.md'
  );
  if (fs.existsSync(docsPath)) {
    console.log('   ✅ CSP implementation guide exists');
    console.log('   📖 Review the guide for deployment instructions\n');
    return true;
  } else {
    console.log('   ❌ Security documentation missing\n');
    return false;
  }
}

// Run all tests
function runSecurityTests() {
  const tests = [
    { name: 'HTML Headers', test: testHTMLHeaders },
    { name: 'Server Configs', test: testServerConfigs },
    { name: 'ErrorBoundary Security', test: testErrorBoundarySecurity },
    { name: 'CSP Strength', test: testCSPStrength },
    { name: 'Documentation', test: testDocumentation },
  ];

  const results = tests.map(({ name, test }) => ({
    name,
    passed: test(),
  }));

  console.log('📋 Security Test Results:');
  console.log('========================');

  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;

  results.forEach(({ name, passed }) => {
    console.log(`${passed ? '✅' : '❌'} ${name}`);
  });

  console.log(`\n🎯 Overall Score: ${passedTests}/${totalTests} tests passed`);

  if (passedTests === totalTests) {
    console.log('🎉 All security tests passed! Your application is secure.');
  } else {
    console.log(
      '⚠️  Some security tests failed. Please review the issues above.'
    );
  }

  return passedTests === totalTests;
}

// Additional security recommendations
function showSecurityRecommendations() {
  console.log('\n💡 Additional Security Recommendations:');
  console.log('=====================================');
  console.log('1. 🌐 Enable HTTPS in production');
  console.log('2. 🔄 Implement CSP reporting endpoint');
  console.log('3. 📊 Monitor security headers with security scanners');
  console.log('4. 🔍 Regular security audits with npm audit');
  console.log('5. 🛡️  Consider implementing nonces for stricter CSP');
  console.log('6. 📝 Keep security documentation updated');
}

// Main execution
if (require.main === module) {
  const allTestsPassed = runSecurityTests();
  showSecurityRecommendations();

  process.exit(allTestsPassed ? 0 : 1);
}

module.exports = {
  runSecurityTests,
  testHTMLHeaders,
  testServerConfigs,
  testErrorBoundarySecurity,
  testCSPStrength,
  testDocumentation,
};
