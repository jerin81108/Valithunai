import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';

console.log('🔒 Running Vazhithunai Ban-Network Offline Verification Check...');

const FORBIDDEN_PATTERNS = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bnavigator\.sendBeacon\b/,
  /\bimport\s+.*['"](?:axios|node-fetch|got|superagent)['"]/,
  /\brequire\s*\(['"](?:axios|node-fetch|got|superagent)['"]\)/,
  /\bimport\s+.*['"]node:(?:http|https|net|tls|dgram)['"]/,
  /\brequire\s*\(['"](?:http|https|net|tls|dgram)['"]\)/,
];

// Packages that MUST have zero outbound network calls
const PACKAGES_TO_VERIFY = [
  'packages/safety-engine',
  'packages/audio-engine',
  'packages/haptics',
  'packages/voice',
  'packages/i18n',
  'packages/ui-tokens',
];

function getFilesRecursively(dir) {
  let results = [];
  try {
    const list = readdirSync(dir);
    for (const file of list) {
      const fullPath = join(dir, file);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (file !== 'node_modules' && file !== 'dist' && file !== '.turbo') {
          results = results.concat(getFilesRecursively(fullPath));
        }
      } else {
        const ext = extname(file);
        if (['.ts', '.js', '.mjs', '.tsx', '.jsx'].includes(ext)) {
          results.push(fullPath);
        }
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`Warning checking directory ${dir}: ${err.message}`);
    }
  }
  return results;
}

let violations = 0;
let filesChecked = 0;

for (const pkg of PACKAGES_TO_VERIFY) {
  const targetDir = resolve(process.cwd(), pkg);
  const files = getFilesRecursively(targetDir);

  for (const file of files) {
    filesChecked++;
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip comments
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        continue;
      }

      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(line)) {
          console.error(`❌ VIOLATION: Offline rule breached in ${file}:${i + 1}`);
          console.error(`   Line: ${trimmed}`);
          console.error(`   Pattern: ${pattern}`);
          violations++;
        }
      }
    }
  }
}

console.log(`Scan complete: checked ${filesChecked} files in safety packages.`);
if (violations > 0) {
  console.error(`❌ Network Ban Test FAILED with ${violations} violation(s). Safety packages must be 100% offline!`);
  process.exit(1);
}

console.log('✅ Network Ban Test PASSED. Zero network calls or external fetch dependencies detected.');
