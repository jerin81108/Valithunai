import { describe as nDescribe, it as nIt, beforeEach as nBeforeEach } from 'node:test';
import assert from 'node:assert/strict';

export const describe = nDescribe;
export const it = nIt;
export const beforeEach = nBeforeEach;

export function expect(actual: any) {
  return {
    toBe(expected: any) {
      assert.strictEqual(actual, expected);
    },
    toEqual(expected: any) {
      assert.deepStrictEqual(actual, expected);
    },
    toBeDefined() {
      assert.notStrictEqual(actual, undefined);
    },
    toBeGreaterThan(expected: any) {
      assert.ok(actual > expected, `Expected ${actual} > ${expected}`);
    },
    toBeGreaterThanOrEqual(expected: any) {
      assert.ok(actual >= expected, `Expected ${actual} >= ${expected}`);
    },
    toBeLessThan(expected: any) {
      assert.ok(actual < expected, `Expected ${actual} < ${expected}`);
    },
    toBeLessThanOrEqual(expected: any) {
      assert.ok(actual <= expected, `Expected ${actual} <= ${expected}`);
    },
    toContain(expected: any) {
      assert.ok(String(actual).includes(expected), `Expected "${actual}" to contain "${expected}"`);
    },
    not: {
      toBe(expected: any) {
        assert.notStrictEqual(actual, expected);
      },
      toThrow() {
        if (typeof actual === 'function') {
          assert.doesNotThrow(actual);
        }
      }
    }
  };
}
