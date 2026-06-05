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

export const users = [];
export const integrations = [
  {
    name: 'Google Sheets',
    type: 'Spreadsheet sync',
    status: 'Connected',
    description: 'Automatically export leads, payments, and appointment updates into a live sheet.',
    lastSync: 'Ready',
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
export const syncPreviewRows = [];

export const kpis = [
  { label: "Today's Appointments", value: '0', delta: 'No live data', accent: 'green' },
  { label: 'Open Leads', value: '0', delta: 'No live data', accent: 'gold' },
  { label: 'Pending Payments', value: '₹ 0', delta: 'No live data', accent: 'teal' },
  { label: 'Follow-ups Due', value: '0', delta: 'No live data', accent: 'gold' },
];

export const funnelStages = [];
export const revenueSeries = [];
export const todaySchedule = [];
export const urgentTasks = [];
export const leads = [];
export const payments = [];
export const clients = [];
export const forms = [];
export const formResponses = [];

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

export const treatmentPlans = [];
export const packages = [];
export const coachingBatches = [];
export const staffRoles = [];
export const accounts = [];
export const inventoryItems = [];
export const communicationTemplates = [];
export const settingsItems = [];
export const portalFeatures = [];
