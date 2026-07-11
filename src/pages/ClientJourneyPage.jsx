import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Tag } from '../components/ui.jsx';
import { useBranch } from '../context/BranchContext.jsx';

function loadValue(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch { return fallback; }
}

function clientName(row) {
  return Array.isArray(row) ? row[0] : row?.name ?? row?.Client ?? row?.client ?? '';
}

const STAGES = [
  ['registration', 'Registration'],
  ['appointment', 'Appointment'],
  ['forms', 'Required Forms'],
  ['consultation', 'Doctor Consultation'],
  ['treatment', 'Treatment Plan'],
  ['billing', 'Invoice & Payment'],
  ['followup', 'Follow-up'],
];

export function ClientJourneyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { branchKey, currentBranch } = useBranch();
  const clientsKey = branchKey('ayurflow-clients:rows:v3');
  const appointmentsKey = branchKey('Appointments:rows:v3');
  const paymentsKey = branchKey('ayurflow-payments:rows:v3');
  const operationsKey = branchKey('Operations:tabs:v3');
  const journeysKey = branchKey('client-journeys:v1');
  const [clients, setClients] = useState(() => loadValue(clientsKey, []));
  const [journeys, setJourneys] = useState(() => loadValue(journeysKey, {}));
  const [selectedClient, setSelectedClient] = useState(() => searchParams.get('client') ?? '');
  const [search, setSearch] = useState('');
  const [consultationOpen, setConsultationOpen] = useState(false);
  const [consultation, setConsultation] = useState({ complaint: '', diagnosis: '', notes: '', vitals: '' });
  const appointments = loadValue(appointmentsKey, []);
  const payments = loadValue(paymentsKey, []);
  const operationRows = loadValue(operationsKey, {});

  useEffect(() => {
    const refresh = () => setClients(loadValue(clientsKey, []));
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); };
  }, [clientsKey]);

  useEffect(() => {
    window.localStorage.setItem(journeysKey, JSON.stringify(journeys));
  }, [journeys, journeysKey]);

  const names = useMemo(() => Array.from(new Set(clients.map(clientName).filter(Boolean))), [clients]);
  const visibleNames = names.filter((name) => name.toLowerCase().includes(search.toLowerCase()));
  const journey = journeys[selectedClient] ?? {};
  const hasAppointment = appointments.some((row) => String(row?.[0] ?? row?.Client ?? '').toLowerCase() === selectedClient.toLowerCase());
  const hasPayment = payments.some((row) => String(row?.[0] ?? row?.Client ?? '').toLowerCase() === selectedClient.toLowerCase());
  const hasTreatment = (operationRows.treatments ?? []).some((row) => String(row?.[0] ?? row?.Client ?? '').toLowerCase() === selectedClient.toLowerCase());

  const stageDone = (id) => {
    if (id === 'registration') return Boolean(selectedClient);
    if (id === 'appointment') return hasAppointment || journey.appointment;
    if (id === 'billing') return hasPayment || journey.billing;
    if (id === 'treatment') return hasTreatment || journey.treatment;
    return Boolean(journey[id]);
  };

  const updateJourney = (changes) => {
    if (!selectedClient) return;
    setJourneys((current) => ({
      ...current,
      [selectedClient]: { ...(current[selectedClient] ?? {}), ...changes, updatedAt: new Date().toISOString() },
    }));
  };

  const openConsultation = () => {
    setConsultation(journey.consultationData ?? { complaint: '', diagnosis: '', notes: '', vitals: '' });
    setConsultationOpen(true);
  };

  const saveConsultation = () => {
    if (!consultation.diagnosis.trim() && !consultation.notes.trim()) return;
    updateJourney({ consultation: true, consultationData: consultation, consultedAt: new Date().toISOString() });
    setConsultationOpen(false);
  };

  const nextAction = () => STAGES.find(([id]) => !stageDone(id))?.[0] ?? 'completed';
  const runStage = (stage) => {
    const client = encodeURIComponent(selectedClient);
    if (stage === 'appointment') navigate(`/appointments?action=add&client=${client}`);
    else if (stage === 'forms') navigate('/forms');
    else if (stage === 'consultation') openConsultation();
    else if (stage === 'treatment') navigate(`/operations?tab=treatments&action=add&client=${client}`);
    else if (stage === 'billing') navigate(`/payments?action=add&client=${client}`);
    else if (stage === 'followup') updateJourney({ followup: true, followupAt: new Date().toISOString() });
  };

  return (
    <section className="module-page journey-page">
      <div className="module-hero compact-hero">
        <div><h1>Client Journey</h1><p>Run the complete reception-to-payment workflow from one workspace.</p><p className="subtle">Current branch: {currentBranch}</p></div>
        <div className="module-stats"><div className="mini-stat"><span>Registered</span><strong>{names.length}</strong></div><div className="mini-stat"><span>Active Journeys</span><strong>{Object.keys(journeys).length}</strong></div><div className="mini-stat"><span>Selected Stage</span><strong>{selectedClient ? nextAction() : 'Select client'}</strong></div></div>
      </div>

      <div className="journey-layout">
        <Card title="Reception Desk" subtitle="Search an existing client or register a new walk-in." action={<button className="pill primary-action" type="button" onClick={() => navigate('/clients?action=add')}>+ Register Client</button>}>
          <input className="lead-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search client by name..." />
          <div className="journey-client-list">
            {visibleNames.length ? visibleNames.map((name) => (
              <button className={`journey-client ${selectedClient === name ? 'active' : ''}`} type="button" key={name} onClick={() => setSelectedClient(name)}><strong>{name}</strong><span>{journeys[name] ? 'Journey in progress' : 'Ready for check-in'}</span></button>
            )) : <div className="empty-state compact-empty"><strong>No clients found.</strong><p>Register the client before booking an appointment.</p></div>}
          </div>
        </Card>

        <Card title={selectedClient ? `${selectedClient} Journey` : 'Journey Stages'} subtitle={selectedClient ? 'Complete each stage in order; earlier records remain linked.' : 'Select a client to begin.'}>
          {selectedClient ? (
            <>
              <div className="journey-stages">
                {STAGES.map(([id, label], index) => {
                  const complete = stageDone(id);
                  return <div className={`journey-stage ${complete ? 'complete' : ''}`} key={id}><span className="journey-index">{complete ? '✓' : index + 1}</span><div><strong>{label}</strong><small>{complete ? 'Completed' : 'Pending'}</small></div>{id !== 'registration' && (id === 'forms' ? <div className="card-action-group"><button className="pill" type="button" onClick={() => navigate('/forms')}>Open Forms</button><button className="pill" type="button" onClick={() => updateJourney({ forms: !complete, formsCompletedAt: !complete ? new Date().toISOString() : '' })}>{complete ? 'Undo' : 'Mark Received'}</button></div> : <button className="pill" type="button" onClick={() => runStage(id)}>{complete ? 'Open' : id === 'consultation' ? 'Consult' : id === 'followup' ? 'Complete' : 'Start'}</button>)}</div>;
                })}
              </div>
              {nextAction() !== 'completed' ? <button className="pill primary-action journey-next" type="button" onClick={() => runStage(nextAction())}>Continue to {STAGES.find(([id]) => id === nextAction())?.[1]}</button> : <div className="action-note"><strong>Journey completed.</strong> All required stages are recorded.</div>}
            </>
          ) : <div className="empty-state"><strong>No client selected.</strong><p>Choose a client from Reception Desk to see their workflow.</p></div>}
        </Card>
      </div>

      {consultationOpen && <div className="modal-backdrop" role="presentation" onClick={() => setConsultationOpen(false)}><div className="modal-shell modal-small" role="dialog" aria-modal="true" aria-label="Doctor Consultation" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><h2>Doctor Consultation</h2><p>{selectedClient}</p></div><button className="icon-btn" type="button" onClick={() => setConsultationOpen(false)} aria-label="Close modal">x</button></div><div className="modal-body detail-grid"><label className="field-block"><span>Chief complaint</span><textarea className="lead-input" value={consultation.complaint} onChange={(event) => setConsultation((current) => ({ ...current, complaint: event.target.value }))} /></label><label className="field-block"><span>Vitals</span><input className="lead-input" value={consultation.vitals} onChange={(event) => setConsultation((current) => ({ ...current, vitals: event.target.value }))} placeholder="BP, pulse, weight..." /></label><label className="field-block"><span>Diagnosis</span><textarea className="lead-input" value={consultation.diagnosis} onChange={(event) => setConsultation((current) => ({ ...current, diagnosis: event.target.value }))} /></label><label className="field-block"><span>Doctor notes</span><textarea className="lead-input" value={consultation.notes} onChange={(event) => setConsultation((current) => ({ ...current, notes: event.target.value }))} /></label></div><div className="modal-actions"><button className="pill" type="button" onClick={() => setConsultationOpen(false)}>Cancel</button><button className="pill primary-action" type="button" onClick={saveConsultation}>Complete Consultation</button></div></div></div>}
    </section>
  );
}
