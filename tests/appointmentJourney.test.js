import test from 'node:test';
import assert from 'node:assert/strict';
import { appointmentVisitId, removeAppointmentFromJourneys } from '../src/data/appointmentJourney.js';

const row = ['Patient', '1234567890', '2026-10-08', '11:00', 'Follow-up', 'Offline', 'Pending'];
const data = { mobile: row[1], date: row[2], time: row[3], type: row[4] };

test('removes matching saved visits and selects the remaining visit without touching another patient', () => {
  const other = { visits: [{ id: 'other', appointmentData: data }] };
  const saved = { Patient: { visits: [
    { id: 'earlier', consultationData: { notes: 'Keep' } },
    { id: 'generated', appointmentData: data },
    { id: appointmentVisitId(row) },
    { id: 'different-time', appointmentData: { ...data, time: '12:00' } },
  ], activeVisitId: 'generated' }, Other: other };
  const result = removeAppointmentFromJourneys(saved, row);
  assert.deepEqual(result.Patient.visits.map((visit) => visit.id), ['earlier', 'different-time']);
  assert.equal(result.Patient.activeVisitId, 'different-time');
  assert.equal(result.Other, other);
  assert.equal(saved.Patient.visits.length, 4);
});

test('clears the scheduled follow-up from its source visit but preserves clinical data', () => {
  const visit = { id: 'source', consultationData: { notes: 'Keep' }, followup: true, followupData: data, followupAt: 'timestamp' };
  const result = removeAppointmentFromJourneys({ Patient: { visits: [visit], activeVisitId: 'source' } }, row);
  assert.deepEqual(result.Patient.visits, [{ id: 'source', consultationData: { notes: 'Keep' } }]);
  assert.equal(result.Patient.activeVisitId, 'source');
});

test('handles legacy records, normalized names and deletion of the last visit', () => {
  assert.deepEqual(removeAppointmentFromJourneys({ ' patient ': { appointmentData: data } }, row), { ' patient ': {} });
  const result = removeAppointmentFromJourneys({ Patient: { visits: [{ id: 'last', appointmentData: data }], activeVisitId: 'last' } }, row);
  assert.deepEqual(result.Patient, { visits: [], activeVisitId: '' });
});
