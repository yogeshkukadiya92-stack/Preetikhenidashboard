import test from 'node:test';
import assert from 'node:assert/strict';
import { enrollmentBalance } from '../src/data/carePrograms.js';

test('visit instalments reduce the outstanding service charge after reload', () => {
  const course = { id: 'course', fee: 1500, paymentEntries: [{ amount: 300, date: '2026-11-04' }] };
  assert.deepEqual(enrollmentBalance(course, []), { received: 300, pending: 1200 });
  const saved = JSON.parse(JSON.stringify({ ...course, paymentEntries: [...course.paymentEntries, { amount: 500, date: '2026-11-05' }] }));
  assert.deepEqual(enrollmentBalance(saved, []), { received: 800, pending: 700 });
  saved.paymentEntries.push({ amount: 700, date: '2026-11-06' });
  assert.deepEqual(enrollmentBalance(saved, []), { received: 1500, pending: 0 });
});

test('legacy partial payments are retained alongside new visit payments', () => {
  assert.deepEqual(enrollmentBalance({ fee: 2000, payment: '300 / 500', paymentEntries: [{ amount: 200 }] }, []), { received: 1000, pending: 1000 });
});

test('legacy text copied from linked receipts does not count twice', () => {
  const course = { id: 'course', fee: 1500, payment: '300 / 500', paymentEntries: [{ amount: 200 }] };
  const receipts = [{ careEnrollmentId: 'course', paidAmount: '300' }, { careEnrollmentId: 'course', paidAmount: '500' }, { careEnrollmentId: 'other', paidAmount: '900' }];
  assert.deepEqual(enrollmentBalance(course, receipts), { received: 1000, pending: 500 });
});


test('new Panchkarma entry never includes unrelated unlinked payments', () => {
  const payments = [{ paidAmount: '163000' }, { careEnrollmentId: '', paidAmount: '200' }, { careEnrollmentId: 'other', paidAmount: '500' }];
  assert.deepEqual(enrollmentBalance({ fee: 2000 }, payments), { received: 0, pending: 2000 });
  assert.deepEqual(enrollmentBalance({ id: '', fee: 2000 }, payments), { received: 0, pending: 2000 });
});

test('clearing an incorrect earlier amount persists and recalculates pending', () => {
  const saved = JSON.parse(JSON.stringify({ id: 'course', fee: 2000, payment: '1,63,000', openingPaidAmount: 0, paymentEntries: [{ amount: 500 }] }));
  assert.deepEqual(enrollmentBalance(saved, []), { received: 500, pending: 1500 });
  saved.paymentEntries = [];
  assert.deepEqual(enrollmentBalance(saved, []), { received: 0, pending: 2000 });
  assert.deepEqual(enrollmentBalance(saved, [{ careEnrollmentId: 'course', paidAmount: '300' }]), { received: 300, pending: 1700 });
});
