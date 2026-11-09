import { readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { run } from 'node:test';
import { spec } from 'node:test/reporters';

console.log('⚡ Running Vazhithunai Safety Engine Test Suite (< 1 second budget)...');

const testsDir = resolve(process.cwd(), 'dist/tests');
const testFiles = readdirSync(testsDir)
  .filter(f => f.endsWith('.test.js'))
  .map(f => join(testsDir, f));

const startTime = performance.now();

const stream = run({
  files: testFiles,
  concurrency: true
});

let failedCount = 0;
let passedCount = 0;

stream.on('test:fail', () => {
  failedCount++;
});

stream.on('test:pass', () => {
  passedCount++;
});

stream.compose(new spec()).pipe(process.stdout);

await new Promise((res) => stream.on('end', res));

const totalDurationMs = performance.now() - startTime;
console.log(`\n======================================================`);
console.log(`Safety Engine Performance & Correctness Report:`);
console.log(`Tests Passed: ${passedCount}`);
console.log(`Tests Failed: ${failedCount}`);
console.log(`Total Duration: ${totalDurationMs.toFixed(2)} ms (Budget: < 1000 ms)`);
console.log(`======================================================`);

if (failedCount > 0) {
  console.error(`❌ ${failedCount} test(s) failed.`);
  process.exit(1);
}

if (totalDurationMs >= 1000) {
  console.error(`❌ Performance Budget Exceeded! Took ${totalDurationMs.toFixed(2)}ms, target is < 1000ms.`);
  process.exit(1);
}

console.log(`✅ All tests passed within performance budget! (Total: ${totalDurationMs.toFixed(2)}ms)`);
