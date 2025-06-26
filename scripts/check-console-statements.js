#!/usr/bin/env node

/**
 * Console Statement Checker
 * Scans the codebase for remaining console.* statements that need replacement
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');
const CONSOLE_REGEX =
  /console\.(log|warn|error|info|debug|group|groupEnd|time|timeEnd)/g;

function scanDirectory(dir) {
  const results = [];

  function scan(currentDir) {
    const items = fs.readdirSync(currentDir);

    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scan(fullPath);
      } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
        // Skip logger file itself
        if (item === 'logger.ts' || item === 'consoleReplacer.ts') {
          continue;
        }

        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          const matches = line.match(CONSOLE_REGEX);
          if (matches) {
            const relativePath = path.relative(SRC_DIR, fullPath);
            results.push({
              file: relativePath,
              line: index + 1,
              content: line.trim(),
              matches: matches,
            });
          }
        });
      }
    }
  }

  scan(dir);
  return results;
}

function main() {
  console.log('🔍 Scanning for remaining console statements...\n');

  const results = scanDirectory(SRC_DIR);

  if (results.length === 0) {
    console.log(
      '✅ No console statements found! All logging has been properly replaced.'
    );
    return;
  }

  console.log(
    `❌ Found ${results.length} console statements that need replacement:\n`
  );

  // Group by file
  const groupedResults = {};
  results.forEach(result => {
    if (!groupedResults[result.file]) {
      groupedResults[result.file] = [];
    }
    groupedResults[result.file].push(result);
  });

  // Display results
  Object.keys(groupedResults)
    .sort()
    .forEach(file => {
      console.log(`📄 ${file}`);
      groupedResults[file].forEach(result => {
        console.log(`   Line ${result.line}: ${result.content}`);
      });
      console.log('');
    });

  console.log('🛠️  To fix these:');
  console.log("1. Import logger: import { logger } from '../utils/logger';");
  console.log(
    '2. Replace console.log with: logger.info(message, { component: "Name", operation: "op" })'
  );
  console.log(
    '3. Replace console.warn with: logger.warn(message, error, { component: "Name", operation: "op" })'
  );
  console.log(
    '4. Replace console.error with: logger.error(message, error, { component: "Name", operation: "op" })'
  );
  console.log('\n📚 See docs/CONSOLE_LOGGING_FIX.md for detailed instructions');
}

if (require.main === module) {
  main();
}
