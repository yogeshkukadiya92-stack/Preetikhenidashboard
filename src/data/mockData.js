export const navItems = [
  { path: '/', label: 'Dashboard' },
  { path: '/crm', label: 'CRM' },
  { path: '/clients', label: 'Clients' },
  { path: '/forms', label: 'Forms' },
  { path: '/appointments', label: 'Appointments' },
  { path: '/payments', label: 'Payments' },
  { path: '/reports', label: 'Reports' },
];

export const kpis = [
  { label: "Today's Appointments", value: '18', delta: '↑ 12%', accent: 'green' },
  { label: 'Open Leads', value: '42', delta: '↑ 8%', accent: 'gold' },
  { label: 'Pending Payments', value: '₹ 68,450', delta: '↑ 15%', accent: 'teal' },
  { label: 'Follow-ups Due', value: '27', delta: '↑ 10%', accent: 'gold' },
];

export const funnelStages = [
  { label: 'New Leads', value: 210, percent: '100%' },
  { label: 'Contacted', value: 112, percent: '53%' },
  { label: 'Consultation Done', value: 58, percent: '27%' },
  { label: 'Treatment Started', value: 29, percent: '14%' },
  { label: 'Converted', value: 15, percent: '7%' },
];

export const revenueSeries = [
  { label: 'Apr 20–26', revenue: 150, collections: 178 },
  { label: 'Apr 27–May 3', revenue: 130, collections: 160 },
  { label: 'May 4–10', revenue: 124, collections: 144 },
  { label: 'May 11–17', revenue: 116, collections: 146 },
  { label: 'May 18–24', revenue: 70, collections: 118 },
];

export const todaySchedule = [
  { time: '09:00 AM', name: 'Anjali Menon', note: 'Consultation · 30m', status: 'Confirmed', tone: 'ok' },
  { time: '09:45 AM', name: 'Ramesh Kumar', note: 'Follow-up · 30m', status: 'Confirmed', tone: 'ok' },
  { time: '10:30 AM', name: 'Sneha Nair', note: 'Panchakarma · 45m', status: 'In Progress', tone: 'progress' },
  { time: '11:30 AM', name: 'Vikram Pillai', note: 'Consultation · 30m', status: 'Confirmed', tone: 'ok' },
  { time: '12:15 PM', name: 'Meera Krishnan', note: 'Diet Counseling · 30m', status: 'Confirmed', tone: 'ok' },
];

export const urgentTasks = [
  { title: 'Follow up with 8 leads', note: 'Hot leads not contacted', due: 'Due today', tone: 'danger' },
  { title: 'Collect payments', note: '5 payments overdue', due: 'Due today', tone: 'warning' },
  { title: 'Confirm 6 appointments', note: 'Pending confirmation', due: 'Due today', tone: 'info' },
  { title: 'Medicine stock low', note: '12 items below reorder level', due: 'Due in 1 day', tone: 'warning' },
  { title: 'Pending forms', note: '7 forms awaiting submission', due: 'Due in 2 days', tone: 'warning' },
];

export const leads = [
  { name: 'Priya Nair', source: 'Website', status: 'New', score: 35, addedOn: 'May 24, 2025' },
  { name: 'Arun Babu', source: 'Facebook', status: 'Hot', score: 82, addedOn: 'May 24, 2025' },
  { name: 'Nikhil Das', source: 'Referral', status: 'Follow-up due', score: 60, addedOn: 'May 23, 2025' },
  { name: 'Latha Menon', source: 'Walk-in', status: 'New', score: 28, addedOn: 'May 23, 2025' },
  { name: 'Sreekanth P.', source: 'Google Ads', status: 'Contacted', score: 45, addedOn: 'May 22, 2025' },
  { name: 'Farah Shaikh', source: 'Instagram', status: 'Hot', score: 77, addedOn: 'May 22, 2025' },
];

export const payments = [
  { client: 'Anjali Menon', invoice: 'INV-2025-1248', amount: '₹ 7,500', status: 'Paid', paidOn: 'May 24, 2025' },
  { client: 'Ramesh Kumar', invoice: 'INV-2025-1247', amount: '₹ 12,000', status: 'Paid', paidOn: 'May 24, 2025' },
  { client: 'Sneha Nair', invoice: 'INV-2025-1246', amount: '₹ 18,500', status: 'Partial', paidOn: 'May 23, 2025' },
  { client: 'Vikram Pillai', invoice: 'INV-2025-1245', amount: '₹ 9,000', status: 'Pending', paidOn: '—' },
  { client: 'Meera Krishnan', invoice: 'INV-2025-1244', amount: '₹ 6,450', status: 'Pending', paidOn: '—' },
];

export const clients = [
  { name: 'Anjali Menon', age: 34, program: 'Weight Loss', progress: '67%', nextVisit: 'May 26, 2025' },
  { name: 'Ramesh Kumar', age: 51, program: 'Panchakarma', progress: '48%', nextVisit: 'May 25, 2025' },
  { name: 'Sneha Nair', age: 29, program: 'Skin Care', progress: '72%', nextVisit: 'May 25, 2025' },
  { name: 'Vikram Pillai', age: 44, program: 'Garbhasanskar', progress: '31%', nextVisit: 'May 27, 2025' },
];

export const forms = [
  { title: 'Weight Loss Intake', status: 'Draft', updated: 'Today' },
  { title: 'Consultation Admission', status: 'Published', updated: 'Yesterday' },
  { title: 'Panchakarma Assessment', status: 'Published', updated: 'May 21, 2025' },
  { title: 'Garbhasanskar Registration', status: 'Draft', updated: 'May 20, 2025' },
];
