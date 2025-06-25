const fs = require('fs');
const path = require('path');

// Function to get version based on environment
function generateVersion(environment) {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear());

  // Check if we need to add a letter suffix for multiple deployments today
  const versionFilePath = path.join(__dirname, '..', 'src', 'version.json');
  let versionData = { deployments: {} };

  try {
    if (fs.existsSync(versionFilePath)) {
      versionData = JSON.parse(fs.readFileSync(versionFilePath, 'utf8'));
    }
  } catch (error) {
    console.warn('Could not read version file, creating new one');
  }

  // Initialize deployments object if it doesn't exist
  if (!versionData.deployments) {
    versionData.deployments = {};
  }

  const today = `${day}${month}${year}`;
  const envKey = `${today}-${environment}`;

  // Check how many deployments we've had today for this environment
  if (!versionData.deployments[envKey]) {
    versionData.deployments[envKey] = 0;
  }

  versionData.deployments[envKey]++;

  // Build the date part with letter suffix if needed
  let datePart = `${day}${month}${year}`;
  if (versionData.deployments[envKey] > 1) {
    const letterIndex = versionData.deployments[envKey] - 2; // -2 because 'a' is the second deployment
    const letter = String.fromCharCode(97 + letterIndex); // 97 is 'a'
    datePart += letter;
  }

  // Build final version with environment suffix
  let version = `2.${datePart}`;
  if (environment === 'development') {
    version += '-dev';
  } else if (environment === 'staging') {
    version += '-staging';
  }
  // production doesn't get a suffix

  // Update version data
  versionData.current = version;
  versionData.environment = environment;
  versionData.generatedAt = now.toISOString();

  // Save version data
  fs.writeFileSync(versionFilePath, JSON.stringify(versionData, null, 2));

  console.log(`Generated version: ${version} for environment: ${environment}`);
  return version;
}

// Function to update AppFooter component with new version
function updateAppFooterVersion(version) {
  const footerPath = path.join(
    __dirname,
    '..',
    'src',
    'components',
    'AppFooter.tsx'
  );

  try {
    let footerContent = fs.readFileSync(footerPath, 'utf8');

    // Replace the APP_VERSION constant
    footerContent = footerContent.replace(
      /const APP_VERSION = '[^']*';/,
      `const APP_VERSION = '${version}';`
    );

    fs.writeFileSync(footerPath, footerContent);
    console.log(`Updated AppFooter.tsx with version: ${version}`);
  } catch (error) {
    console.error('Could not update AppFooter.tsx:', error);
  }
}

// Function to update Login component with new version
function updateLoginVersion(version) {
  const loginPath = path.join(
    __dirname,
    '..',
    'src',
    'components',
    'Login.tsx'
  );

  try {
    let loginContent = fs.readFileSync(loginPath, 'utf8');

    // Replace the APP_VERSION constant
    loginContent = loginContent.replace(
      /const APP_VERSION = '[^']*';/,
      `const APP_VERSION = '${version}';`
    );

    fs.writeFileSync(loginPath, loginContent);
    console.log(`Updated Login.tsx with version: ${version}`);
  } catch (error) {
    console.error('Could not update Login.tsx:', error);
  }
}

// Main execution
function main() {
  const environment = process.argv[2] || 'development';
  const validEnvironments = ['development', 'staging', 'production'];

  if (!validEnvironments.includes(environment)) {
    console.error(
      `Invalid environment: ${environment}. Valid options: ${validEnvironments.join(', ')}`
    );
    process.exit(1);
  }

  const version = generateVersion(environment);
  updateAppFooterVersion(version);
  updateLoginVersion(version);

  console.log(
    `✅ Version ${version} generated successfully for ${environment} environment`
  );
}

// Execute if this file is run directly
if (require.main === module) {
  main();
}

module.exports = {
  generateVersion,
  updateAppFooterVersion,
  updateLoginVersion,
};
