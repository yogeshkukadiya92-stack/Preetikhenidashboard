import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeFormsById } from '../src/data/formSync.js';

test('keeps forms created on different devices without overwriting either list', () => {
  const laptopForm = { id: 'laptop', title: 'Laptop form', updatedAt: '2026-08-27T09:00:00Z' };
  const tabletForm = { id: 'tablet', title: 'Tablet form', updatedAt: '2026-08-27T09:01:00Z' };
  assert.deepEqual(mergeFormsById([laptopForm], [tabletForm]), [tabletForm, laptopForm]);
});

test('uses the newest copy when the same form was edited on two devices', () => {
  const oldCopy = { id: 'shared', title: 'Old title', updatedAt: '2026-08-27T09:00:00Z' };
  const newCopy = { id: 'shared', title: 'New title', updatedAt: '2026-08-27T09:02:00Z' };
  assert.deepEqual(mergeFormsById([oldCopy], [newCopy]), [newCopy]);
});
