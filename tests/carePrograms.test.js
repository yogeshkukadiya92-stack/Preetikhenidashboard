import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyCareState, programServices, carePatients, validateEnrollment, validateSession, usedSessions, createCarePayment, enrollmentBalance, careMonthlySummary, readCareState, scheduleCareSessions, validateCareReceiptEdit } from '../src/data/carePrograms.js';
const enrollment = { id:'e1', program:'panchakarma', patientKey:'id:1', patientName:'Patient One', clientId:'1', name:'Therapy course', startDate:'2026-10-01',endDate:'2026-11-30',totalSessions:2,fee:1000,serviceIds:['therapy'],status:'Active',source:'Instagram' };
const session = { id:'s1',program:'panchakarma',enrollmentId:'e1',serviceId:'therapy',date:'2026-10-02',time:'10:00',duration:30,buffer:10,therapist:'Staff',room:'Room 1',status:'Completed',attendance:'Present' };
const state = { ...emptyCareState(),enrollments:[enrollment],sessions:[session] };
test('all clinic-requested Panchakarma services and separate Garbhsanskar catalogue',()=>{
 const p=programServices(emptyCareState(),'panchakarma').map(s=>s.name);
 for(const name of ['Vamana','Virechana','Basti','Nasya','Shirodhara','Raktamokshana','Snehapana','Abhyanga / Massage','Swedana / Steam']) assert.ok(p.includes(name));
 assert.ok(!programServices(emptyCareState(),'garbhsanskar').some(s=>s.name==='Vamana'));
});
test('legacy patients and ID-based deduplication',()=>{
 const p=carePatients([['1','Patient','123','2026-10-01','','','','','Panchakarma','Instagram','','',''],{clientId:'1',name:'Patient',mobile:'123'}]);
 assert.equal(p.length,1); assert.equal(p[0].key,'id:1');
});
test('session overlap includes cleanup and applies across services',()=>{
 assert.match(validateSession({...session,id:'s2',time:'10:35'},state),/already has/);
 assert.equal(validateSession({...session,id:'s2',time:'10:40'},state),'');
 assert.match(validateSession({...session,id:'s2',program:'garbhsanskar'},state),/valid patient course/);
 assert.equal(validateSession({...session,id:'s2',status:'Cancelled',attendance:'Not marked'},state),'');
});
test('attendance, date boundaries and package credits enforced',()=>{
 assert.match(validateSession({...session,attendance:'Absent'},state),/Present/);
 assert.match(validateSession({...session,date:'2026-09-30'},state),/within/);
 const full={...state,enrollments:[{...enrollment,totalSessions:1}]};
 assert.match(validateSession({...session,id:'s2',time:'12:00'},full),/used/);
 assert.equal(validateSession({...session,id:'s2',time:'12:00',consumesCredit:false},full),'');
 assert.equal(usedSessions('e1',[session,{...session,id:'s2',status:'Missed',attendance:'Absent'}]),1);
});
test('separate Cash/GPay instalments reduce a single course balance without overpayment',()=>{
 const first=createCarePayment({enrollment,amount:400,mode:'GPay',date:'2026-10-02',feeType:'Consultation',id:'p1'});
 const second=createCarePayment({enrollment,amount:600,mode:'Cash',date:'2026-10-03',feeType:'Package',id:'p2',existingPayments:[first]});
 assert.deepEqual(enrollmentBalance(enrollment,[first,second]),{received:1000,pending:0});
 assert.throws(()=>createCarePayment({enrollment,amount:601,mode:'Cash',date:'2026-10-03',feeType:'Package',id:'p3',existingPayments:[first]}),/exceed/);
 assert.match(validateEnrollment({...enrollment,fee:300},state,[first]),/lower/);
});
test('monthly reports isolate services, deduplicate patients and retain as-of outstanding balances',()=>{
 const payments=[createCarePayment({enrollment,amount:400,mode:'GPay',date:'2026-10-02',feeType:'Consultation',id:'p1'}),createCarePayment({enrollment,amount:600,mode:'Cash',date:'2026-11-02',feeType:'Package',id:'p2'})];
 const s={...state,enrollments:[enrollment,{...enrollment,id:'e2',name:'Second',fee:200,startDate:'2026-11-01'}],sessions:[session,{...session,id:'s2',date:'2026-10-05'}]};
 const r=careMonthlySummary(s,payments,'2026-10','panchakarma');
 assert.equal(r.patients,1);assert.equal(r.newPatients,1);assert.equal(r.completed,2);assert.equal(r.social,1);assert.equal(r.gpay,400);assert.equal(r.cash,0);assert.equal(r.consultation,400);assert.equal(r.pending,600);
 assert.equal(careMonthlySummary(s,payments,'2026-10','garbhsanskar').collection,0);
 assert.equal(careMonthlySummary(s,payments,'2026-11','panchakarma').oldPatients,1);
});
test('storage keys keep branches independent and handle corrupt saved values',()=>{
 const storage={getItem:key=>key.includes('Branch 1:')?JSON.stringify(state):'{broken'};
 assert.equal(readCareState(storage,'Branch 1').enrollments.length,1);
 assert.deepEqual(readCareState(storage,'Branch 2'),emptyCareState());
});
test('patient identity and saved session history cannot be invalidated by editing a course',()=>{
 assert.match(validateEnrollment({...enrollment,patientKey:'id:other'},state),/reassigned/);
 assert.match(validateEnrollment({...enrollment,serviceIds:['different']},state),/saved sessions/);
 assert.match(validateEnrollment({...enrollment,startDate:'2026-10-10'},state),/saved session dates/);
 assert.match(validateSession({...session,status:'Planned',attendance:'Not marked'}, {...state,enrollments:[{...enrollment,status:'Paused'}]}),/Resume/);
});
test('group classes can share staff and room but the same patient cannot be double-booked',()=>{
 const first={...enrollment,program:'garbhsanskar',serviceIds:['meditation']};
 const second={...first,id:'e2',patientKey:'id:2'};
 const group={...session,program:'garbhsanskar',serviceId:'meditation',batch:'Morning group',status:'Planned',attendance:'Not marked'};
 const s={...state,enrollments:[first,second],sessions:[group]};
 assert.equal(validateSession({...group,id:'s2',enrollmentId:'e2'},s),'');
 assert.match(validateSession({...group,id:'s2',enrollmentId:'e2',batch:'Other group'},s),/already has/);
 assert.match(validateSession({...group,id:'s2'},s),/already has/);
});

test('repeated bookings validate the whole series before any state is saved',()=>{
 let n=0;
 const draft={...session,id:undefined,status:'Planned',attendance:'Not marked',date:'2026-10-03',repeatCount:2,intervalDays:2};
 const result=scheduleCareSessions(draft,{...state,enrollments:[{...enrollment,totalSessions:3}]},()=>`repeat-${++n}`);
 assert.equal(result.sessions.length,3);assert.equal(result.sessions.at(-1).date,'2026-10-05');
 assert.throws(()=>scheduleCareSessions({...draft,repeatCount:3},state,()=>`bad-${++n}`),/already used or scheduled/);
 assert.equal(state.sessions.length,1);
});
test('editing shared payment receipts preserves course ownership and prevents overcollection',()=>{
 const receipt=createCarePayment({enrollment,amount:400,mode:'Cash',date:'2026-10-01',feeType:'Package',id:'receipt'});
 assert.equal(validateCareReceiptEdit(receipt,state,[]),'');
 assert.match(validateCareReceiptEdit({...receipt,client:'Other'},state,[]),/cannot be changed/);
 assert.match(validateCareReceiptEdit({...receipt,paidAmount:'1001'},state,[]),/exceed/);
});
