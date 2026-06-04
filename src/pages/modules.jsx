import { GenericModulePage } from './GenericModulePage.jsx';
import { clients, forms, leads, payments } from '../data/mockData.js';

export function CRMPage() {
  return (
    <GenericModulePage
      title="CRM"
      description="Track leads, assign follow-ups, and keep every potential client moving through the pipeline."
      stats={[
        { label: 'Open Leads', value: '42' },
        { label: 'Hot Leads', value: '14' },
        { label: 'Follow-ups Today', value: '27' },
      ]}
      columns={['Lead', 'Source', 'Status', 'Score', 'Added On']}
      rows={leads.slice(0, 5).map((lead) => [lead.name, lead.source, lead.status, String(lead.score), lead.addedOn])}
    />
  );
}

export function ClientsPage() {
  return (
    <GenericModulePage
      title="Clients"
      description="View active client profiles, treatment progress, and upcoming visit timelines."
      stats={[
        { label: 'Active Clients', value: '128' },
        { label: 'Treatment Plans', value: '74' },
        { label: 'Next Visits', value: '19' },
      ]}
      columns={['Client', 'Age', 'Program', 'Progress', 'Next Visit']}
      rows={clients.map((client) => [client.name, String(client.age), client.program, client.progress, client.nextVisit])}
    />
  );
}

export function FormsPage() {
  return (
    <GenericModulePage
      title="Forms"
      description="Manage intake forms, consultation admissions, and wellness program registrations."
      stats={[
        { label: 'Published Forms', value: '12' },
        { label: 'Drafts', value: '4' },
        { label: 'Submissions Today', value: '26' },
      ]}
      columns={['Form', 'Status', 'Updated', 'Responses']}
      rows={forms.map((form) => [form.title, form.status, form.updated, '—'])}
    />
  );
}

export function AppointmentsPage() {
  return (
    <GenericModulePage
      title="Appointments"
      description="Coordinate bookings, reschedules, confirmations, and room availability across the day."
      stats={[
        { label: 'Today', value: '18' },
        { label: 'Confirmed', value: '14' },
        { label: 'Pending', value: '4' },
      ]}
      columns={['Time', 'Client', 'Type', 'Status']}
      rows={[
        ['09:00 AM', 'Anjali Menon', 'Consultation', 'Confirmed'],
        ['09:45 AM', 'Ramesh Kumar', 'Follow-up', 'Confirmed'],
        ['10:30 AM', 'Sneha Nair', 'Panchakarma', 'In Progress'],
        ['11:30 AM', 'Vikram Pillai', 'Consultation', 'Confirmed'],
      ]}
    />
  );
}

export function PaymentsPage() {
  return (
    <GenericModulePage
      title="Payments"
      description="Monitor invoices, partial collections, pending dues, and total cash flow in one place."
      stats={[
        { label: 'Collected Today', value: '₹ 19,500' },
        { label: 'Pending', value: '₹ 68,450' },
        { label: 'Invoices', value: '36' },
      ]}
      columns={['Client', 'Invoice', 'Amount', 'Status', 'Paid On']}
      rows={payments.map((payment) => [payment.client, payment.invoice, payment.amount, payment.status, payment.paidOn])}
    />
  );
}

export function ReportsPage() {
  return (
    <GenericModulePage
      title="Reports"
      description="Review lead conversion, payment performance, and operational visibility across your clinic."
      stats={[
        { label: 'Conversion', value: '7%' },
        { label: 'Revenue', value: '₹ 96,420' },
        { label: 'Retention', value: '80%' },
      ]}
      columns={['Report', 'Period', 'Status', 'Owner']}
      rows={[
        ['Lead Report', 'This Week', 'Ready', 'Admin'],
        ['Revenue Report', 'This Week', 'Ready', 'Accounts'],
        ['Appointments Report', 'This Week', 'Ready', 'Reception'],
      ]}
    />
  );
}
