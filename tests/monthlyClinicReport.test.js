import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMonthlyClinicReport } from '../src/data/monthlyClinicReport.js';
const data = {
  clients: [
    { clientId: '1', name: 'New patient', mobile: '111', visitDate: '2026-10-02', service: 'Weightloss', reference: 'Instagram' },
    { clientId: '2', name: 'Returning patient', mobile: '222', visitDate: '2026-09-01', service: 'Skin Hair', reference: 'Friend' },
    { clientId: '3', name: 'Cancelled', visitDate: '2026-08-01', service: 'Garbhsanskar' },
  ],
  appointments: [ ['New patient', '111', '2026-10-03', '10:00', 'Weightloss', 'Confirmed'], ['Returning patient', '222', '2026-10-07', '10:00', 'Skin Hair', 'Confirmed'], ['Returning patient', '222', '2026-10-09', '10:00', 'Skin Hair', 'Confirmed'], ['Cancelled', '', '2026-10-03', '', '', 'Cancelled'] ],
  payments: [
    { clientId: '1', client: 'New patient', paidOn: '2026-10-02', amount: '1000', paidAmount: '400', status: 'Partial', feeType: 'Consultation', paymentMode: 'GPay' },
    { client: 'Returning patient', paidOn: '07/10/2026', amount: '500', status: 'Paid', feeType: 'Consultation', paymentMode: 'Cash' },
    { client: 'New patient', paidOn: '2026-10-02', amount: '200', status: 'Paid', paymentMode: 'Cash' },
    { client: 'New patient', paidOn: '2026-10-02', amount: '900', status: 'Pending', paymentMode: 'Cash' },
    { client: 'New patient', paidOn: '2026-09-02', amount: '300', status: 'Paid', feeType: 'Consultation', paymentMode: 'GPay' },
  ],
};
test('monthly patients deduplicate repeat visits, classify first dates, exclude cancellation', () => {
  const r = buildMonthlyClinicReport(data, '2026-10');
  assert.equal(r.patients.length, 2);
  assert.equal(r.patients.find(p => p.id === '1').type, 'New');
  assert.equal(r.patients.find(p => p.id === '2').type, 'Old');
  assert.equal(r.patients.find(p => p.id === '1').sourceGroup, 'Social Media');
  assert.equal(r.collections.reduce((n,p) => n + p.amount, 0), 1100);
  assert.equal(r.collections.filter(p => p.category === 'Consultation').reduce((n,p) => n + p.amount, 0), 900);
});
test('combined source, service, patient and collection mode filters', () => {
  const r = buildMonthlyClinicReport(data, '2026-10', { type: 'New', source: 'Social Media', service: 'Weight Loss', mode: 'GPay' });
  assert.equal(r.patients.length, 1);
  assert.equal(r.collections.length, 1);
  assert.equal(r.collections[0].amount, 400);
  assert.equal(buildMonthlyClinicReport(data, '2026-10', { service: 'Hair' }).patients.length, 1);
});
test('duplicate names are not silently matched to payments', () => {
  const r = buildMonthlyClinicReport({ clients: [{ name:'Same', mobile:'1', visitDate:'2026-10-01' }, {name:'Same',mobile:'2',visitDate:'2026-10-01'}], payments:[{client:'Same',paidOn:'2026-10-01',amount:100,status:'Paid'}] }, '2026-10', {type:'New'});
  assert.equal(r.collections.length, 0);
});
test('care enrolments count each patient once across services and filter service receipts correctly',()=>{
 const r=buildMonthlyClinicReport({clients:[{clientId:'1',name:'Patient',visitDate:'2026-09-01',service:'Panchakarma'}],carePrograms:{enrollments:[{id:'e1',clientId:'1',patientName:'Patient',program:'panchakarma',startDate:'2026-10-01'},{id:'e2',clientId:'1',patientName:'Patient',program:'garbhsanskar',startDate:'2026-10-01'}],sessions:[]},payments:[{clientId:'1',client:'Patient',service:'Panchakarma',paidOn:'2026-10-01',amount:100,status:'Paid'},{clientId:'1',client:'Patient',service:'Garbhsanskar',paidOn:'2026-10-01',amount:200,status:'Paid'}]},'2026-10',{service:'Garbhsanskar'});
 assert.equal(r.patients.length,1);assert.equal(r.patients[0].type,'Old');assert.equal(r.collections.length,1);assert.equal(r.collections[0].amount,200);
});
