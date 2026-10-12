import assert from 'node:assert/strict';
import test from 'node:test';
import { mayAccessKey } from '../server/branchAccess.js';

test('a branch can read and write only its own records', () => {
  const identity = { isAdmin: false, branch: 'Surat Branch' };
  assert.equal(mayAccessKey(identity, 'moms-pathshala:Surat Branch:attendance-sessions:v1'), true);
  assert.equal(mayAccessKey(identity, 'moms-pathshala:Surat Branch:attendance-sessions:v1', true), true);
  assert.equal(mayAccessKey(identity, 'moms-pathshala:Main Branch:attendance-sessions:v1'), false);
  assert.equal(mayAccessKey(identity, 'moms-pathshala:auth-users:v1'), false);
  assert.equal(mayAccessKey(identity, 'ayurflow:ayurflow-clients:rows:v3'), false);
  assert.equal(mayAccessKey(identity, 'moms-pathshala:branches:v1'), true);
  assert.equal(mayAccessKey(identity, 'moms-pathshala:branches:v1', true), false);
});

test('administrator can review all branch records', () => {
  assert.equal(mayAccessKey({ isAdmin: true }, 'moms-pathshala:Surat Branch:attendance-sessions:v1'), true);
  assert.equal(mayAccessKey({ isAdmin: true }, 'moms-pathshala:Main Branch:attendance-sessions:v1', true), true);
});
