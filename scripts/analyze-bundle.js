#!/usr/bin/env node

/**
 * Bundle Size Analysis Script
 * Analyzes the build output and reports on bundle sizes and optimizations
 */

const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, '..', 'build', 'static', 'js');
const SIZE_LIMIT_MB = 1; // Warning threshold in MB

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function analyzeBundle() {
  console.log('🔍 Bundle Size Analysis\n');

  if (!fs.existsSync(BUILD_DIR)) {
    console.error('❌ Build directory not found. Run "npm run build" first.');
    process.exit(1);
  }

  const jsFiles = fs
    .readdirSync(BUILD_DIR)
    .filter(file => file.endsWith('.js') && !file.endsWith('.map'))
    .map(file => {
      const filePath = path.join(BUILD_DIR, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        size: stats.size,
        sizeFormatted: formatBytes(stats.size),
      };
    })
    .sort((a, b) => b.size - a.size);

  const totalSize = jsFiles.reduce((sum, file) => sum + file.size, 0);
  const mainFile = jsFiles.find(f => f.name.includes('main.')) || jsFiles[0];

  console.log('📊 JavaScript Bundle Analysis:');
  console.log('═'.repeat(50));

  jsFiles.forEach((file, index) => {
    const isLarge = file.size > SIZE_LIMIT_MB * 1024 * 1024;
    const icon = index === 0 ? '🎯' : isLarge ? '⚠️ ' : '✅';
    const percentage = ((file.size / totalSize) * 100).toFixed(1);

    console.log(`${icon} ${file.name}`);
    console.log(`   Size: ${file.sizeFormatted} (${percentage}%)`);

    if (isLarge && !file.name.includes('main.')) {
      console.log(`   ⚠️  Large chunk detected - consider code splitting`);
    }
    console.log('');
  });

  console.log('📈 Summary:');
  console.log('─'.repeat(30));
  console.log(`Total JavaScript: ${formatBytes(totalSize)}`);
  console.log(`Number of chunks: ${jsFiles.length}`);
  console.log(`Main bundle: ${mainFile.sizeFormatted}`);

  if (mainFile.size > SIZE_LIMIT_MB * 1024 * 1024) {
    console.log(
      '⚠️  Main bundle is large - consider lazy loading more components'
    );
  } else {
    console.log('✅ Main bundle size is optimal');
  }

  // Check for potential optimizations
  console.log('\n🔧 Optimization Suggestions:');
  console.log('─'.repeat(40));

  const largeChunks = jsFiles.filter(
    f => f.size > SIZE_LIMIT_MB * 1024 * 1024 && !f.name.includes('main.')
  );
  if (largeChunks.length > 0) {
    console.log('📦 Large chunks found:');
    largeChunks.forEach(chunk => {
      console.log(`   • ${chunk.name} (${chunk.sizeFormatted})`);
    });
    console.log('   Consider further code splitting for these chunks.');
  }

  if (jsFiles.length < 5) {
    console.log(
      '🔄 Few chunks detected. Consider implementing more lazy loading.'
    );
  } else {
    console.log('✅ Good chunk distribution detected.');
  }

  // Performance recommendations
  console.log('\n⚡ Performance Recommendations:');
  console.log('─'.repeat(45));
  console.log('• Enable gzip compression on your server');
  console.log('• Consider using Brotli compression for better results');
  console.log('• Implement preload directives for critical chunks');
  console.log('• Monitor Core Web Vitals in production');

  console.log('\n✨ Bundle analysis complete!');
}

if (require.main === module) {
  analyzeBundle();
}

module.exports = { analyzeBundle };
