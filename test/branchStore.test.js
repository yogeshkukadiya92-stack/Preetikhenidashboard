import test from 'node:test';
import assert from 'node:assert/strict';
import { readCurrentBranch } from '../src/data/branchStore.js';

for (const value of ['Main Branch', JSON.stringify('Main Branch'), JSON.stringify(JSON.stringify('Main Branch'))]) {
  test(`opens existing patient namespace after hydration: ${value}`, () => {
    assert.equal(readCurrentBranch({ getItem: () => value }, ['Main Branch']), 'Main Branch');
  });
}
test('falls back to an existing branch for a removed selection', () => {
  assert.equal(readCurrentBranch({ getItem: () => 'Removed' }, ['Main Branch']), 'Main Branch');
});
test('preserves a valid secondary branch selection', () => {
  assert.equal(readCurrentBranch({ getItem: () => JSON.stringify('Clinic 2') }, ['Main Branch', 'Clinic 2']), 'Clinic 2');
});
