export const navItems = [
  { path: '/', label: 'Dashboard' },
  { path: '/crm', label: 'CRM' },
  { path: '/clients', label: 'Clients' },
  { path: '/appointments', label: 'Appointments' },
  { path: '/operations', label: 'Operations' },
  { path: '/finance', label: 'Finance' },
  { path: '/reports', label: 'Reports' },
  { path: '/settings', label: 'Settings' },
];

export const users = [
  { name: 'Dr. Arjun Nair', role: 'Administrator', email: 'arjun@ayurflow.in', status: 'Active' },
  { name: 'Meera Menon', role: 'Receptionist', email: 'meera@ayurflow.in', status: 'Active' },
  { name: 'Nikhil Das', role: 'CRM Executive', email: 'nikhil@ayurflow.in', status: 'Active' },
  { name: 'Anjali Reddy', role: 'Therapist', email: 'anjali@ayurflow.in', status: 'Pending' },
];

export const integrations = [
  {
    name: 'Google Sheets',
    type: 'Spreadsheet sync',
    status: 'Connected',
    description: 'Automatically export leads, payments, and appointment updates into a live sheet.',
    lastSync: '2 min ago',
    primaryAction: 'Open Sheet Link',
  },
  {
    name: 'WhatsApp Business',
    type: 'Messaging',
    status: 'Available',
    description: 'Send follow-up reminders and missed-appointment alerts to leads and clients.',
    lastSync: 'Ready to connect',
    primaryAction: 'Connect Channel',
  },
  {
    name: 'Zapier / Webhooks',
    type: 'Automation',
    status: 'Available',
    description: 'Push CRM events to other tools like accounting apps, forms, or internal portals.',
    lastSync: 'Webhook endpoint ready',
    primaryAction: 'Copy Webhook URL',
  },
];

export const sheetTabs = ['Leads', 'Clients', 'Appointments', 'Payments', 'Reports'];

export const syncPreviewRows = [
  ['May 24, 2025', 'Priya Nair', 'Lead created', 'Google Sheets'],
  ['May 24, 2025', 'Anjali Menon', 'Payment received', 'Google Sheets'],
  ['May 24, 2025', 'Sneha Nair', 'Appointment updated', 'Google Sheets'],
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

export const services = [
  'Consultation',
  'Follow-up',
  'Weight Loss',
  'Skin Care',
  'Hair Treatment',
  'Panchakarma',
  'Garbhasanskar',
  'Diet Counseling',
  'Therapy Session',
];

export const treatmentPlans = [
  { client: 'Anjali Menon', service: 'Weight Loss', goal: 'Lose 8 kg', duration: '12 weeks', status: 'Active' },
  { client: 'Sneha Nair', service: 'Skin Treatment', goal: 'Reduce pigmentation', duration: '8 weeks', status: 'Active' },
  { client: 'Vikram Pillai', service: 'Garbhasanskar', goal: 'Monthly pregnancy plan', duration: '6 months', status: 'Renewed' },
  { client: 'Ramesh Kumar', service: 'Panchakarma', goal: 'Therapy completion', duration: '14 days', status: 'Paused' },
];

export const packages = [
  { name: 'Weight Loss 3 Months', category: 'Clinic', duration: '3 months', sessions: 12, price: '₹ 28,000' },
  { name: 'Skin Treatment Package', category: 'Clinic', duration: '8 weeks', sessions: 8, price: '₹ 18,500' },
  { name: 'Panchakarma Package', category: 'Clinic', duration: '14 days', sessions: 14, price: '₹ 42,000' },
  { name: 'Beautician Advanced Course', category: 'Coaching', duration: '10 weeks', sessions: 20, price: '₹ 35,000' },
];

export const coachingBatches = [
  { batch: 'Beautician Basic June', course: 'Beautician Coaching', trainer: 'Meera Menon', students: 18, status: 'Active' },
  { batch: 'Weight Loss Coach Hybrid', course: 'Coach Training', trainer: 'Dr. Arjun Nair', students: 12, status: 'Active' },
  { batch: 'Ayurveda Wellness Online', course: 'Wellness Coach', trainer: 'Nikhil Das', students: 24, status: 'Scheduled' },
  { batch: 'Recorded Course Access', course: 'Online Program', trainer: 'Anjali Reddy', students: 39, status: 'Active' },
];

export const staffRoles = [
  { name: 'Dr. Arjun Nair', role: 'Doctor/Consultant', permissions: 'Health records, plans, forms', status: 'Active' },
  { name: 'Meera Menon', role: 'Receptionist', permissions: 'Leads, appointments, payments', status: 'Active' },
  { name: 'Nikhil Das', role: 'CRM Executive', permissions: 'Leads, follow-ups, reports', status: 'Active' },
  { name: 'Anjali Reddy', role: 'Therapist', permissions: 'Therapy notes, room schedule', status: 'Pending' },
];

export const accounts = [
  { item: 'Consultation Fees', type: 'Income', amount: '₹ 24,500', mode: 'UPI', status: 'Collected' },
  { item: 'Package Installments', type: 'Income', amount: '₹ 68,450', mode: 'Mixed', status: 'Pending' },
  { item: 'Medicine Purchase', type: 'Expense', amount: '₹ 12,800', mode: 'Bank', status: 'Paid' },
  { item: 'Marketing Expense', type: 'Expense', amount: '₹ 9,500', mode: 'Card', status: 'Reviewed' },
];

export const inventoryItems = [
  { item: 'Triphala Tablets', category: 'Medicine', quantity: 42, expiry: 'Dec 2026', status: 'In Stock' },
  { item: 'Panchakarma Oil', category: 'Oil/Material', quantity: 8, expiry: 'Aug 2026', status: 'Low Stock' },
  { item: 'Skin Care Kit', category: 'Product', quantity: 16, expiry: 'Jan 2027', status: 'In Stock' },
  { item: 'Course Workbook', category: 'Course Material', quantity: 55, expiry: 'NA', status: 'In Stock' },
];

export const communicationTemplates = [
  { template: 'New Lead Welcome', channel: 'WhatsApp', trigger: 'Lead created', status: 'Active' },
  { template: 'Appointment Reminder', channel: 'WhatsApp/SMS', trigger: '1 day before visit', status: 'Active' },
  { template: 'Payment Pending', channel: 'WhatsApp/Email', trigger: 'Invoice pending', status: 'Active' },
  { template: 'Certificate Email', channel: 'Email', trigger: 'Course completed', status: 'Draft' },
];

export const settingsItems = [
  { setting: 'Clinic Profile', area: 'Branch details', value: 'Vaidhya Wellness Clinic', status: 'Configured' },
  { setting: 'Payment Modes', area: 'Finance', value: 'Cash, UPI, Bank, Card', status: 'Configured' },
  { setting: 'Tax Settings', area: 'Invoice', value: 'GST optional', status: 'Configured' },
  { setting: 'Role Permissions', area: 'Staff', value: 'Role based access', status: 'Needs Review' },
];

export const portalFeatures = [
  { feature: 'Appointment Booking', owner: 'Client', mode: 'Online/Hybrid', status: 'Enabled' },
  { feature: 'Form Filling', owner: 'Client', mode: 'Online', status: 'Enabled' },
  { feature: 'Invoice Download', owner: 'Client', mode: 'Online', status: 'Enabled' },
  { feature: 'Progress Photo Upload', owner: 'Client', mode: 'Treatment', status: 'Planned' },
];
