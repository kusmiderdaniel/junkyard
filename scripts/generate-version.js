const fs = require('fs');
const path = require('path');

// Function to generate unified version format: 2.DDMMYYYYa
function generateVersion() {
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

  // Check how many deployments we've had today (unified across all environments)
  if (!versionData.deployments[today]) {
    versionData.deployments[today] = 0;
  }

  versionData.deployments[today]++;

  // Build the date part with letter suffix if needed
  let datePart = `${day}${month}${year}`;
  if (versionData.deployments[today] > 1) {
    const letterIndex = versionData.deployments[today] - 2; // -2 because 'a' is the second deployment
    const letter = String.fromCharCode(97 + letterIndex); // 97 is 'a'
    datePart += letter;
  }

  // Build final version in unified format: 2.DDMMYYYYa
  const version = `2.${datePart}`;

  // Update version data
  versionData.current = version;
  versionData.generatedAt = now.toISOString();

  // Save version data
  fs.writeFileSync(versionFilePath, JSON.stringify(versionData, null, 2));

  console.log(`Generated unified version: ${version}`);
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
  const version = generateVersion();
  // Note: AppFooter and Login now read version dynamically from version.json
  // so we don't need to update them directly anymore

  console.log(`✅ Unified version ${version} generated successfully`);
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
