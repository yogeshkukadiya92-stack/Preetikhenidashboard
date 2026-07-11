export const navItems = [
  { path: '/', label: 'Dashboard', section: 'Overview' },
  { path: '/crm', label: 'CRM', section: 'Clients & CRM' },
  { path: '/clients', label: 'Clients', section: 'Clients & CRM' },
  { path: '/journey', label: 'Client Journey', section: 'Clients & CRM' },
  { path: '/appointments', label: 'Appointments', section: 'Clients & CRM' },
  { path: '/forms', label: 'Forms', section: 'Clients & CRM' },
  { path: '/services', label: 'Services', section: 'Care Programs' },
  { path: '/treatments', label: 'Treatments', section: 'Care Programs' },
  { path: '/packages', label: 'Packages', section: 'Care Programs' },
  { path: '/coaching', label: 'Coaching', section: 'Care Programs' },
  { path: '/staff', label: 'Staff', section: 'Operations' },
  { path: '/operations', label: 'Operations', section: 'Operations' },
  { path: '/medicines', label: 'Medicines', section: 'Operations' },
  { path: '/inventory', label: 'Inventory', section: 'Operations' },
  { path: '/communication', label: 'Communication', section: 'Operations' },
  { path: '/client-portal', label: 'Client Portal', section: 'Operations' },
  { path: '/finance', label: 'Finance', section: 'Finance & Reports' },
  { path: '/payments', label: 'Payments', section: 'Finance & Reports' },
  { path: '/accounts', label: 'Accounts', section: 'Finance & Reports' },
  { path: '/reports', label: 'Reports', section: 'Finance & Reports' },
  { path: '/users', label: 'Users', section: 'Administration' },
  { path: '/integrations', label: 'Integrations', section: 'Administration' },
  { path: '/branches', label: 'Branches', section: 'Administration' },
  { path: '/settings', label: 'Settings', section: 'Administration' },
];

export const users = [];
export const integrations = [
  {
    name: 'Google Sheets',
    type: 'Spreadsheet sync',
    status: 'Available',
    description: 'Export leads, payments, and appointment updates into a live sheet after API setup.',
    lastSync: 'Credentials required',
    primaryAction: 'Open Google Sheets',
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
  { label: "Today's Appointments", value: '0', delta: 'Awaiting records', accent: 'green' },
  { label: 'Open Leads', value: '0', delta: 'Awaiting records', accent: 'gold' },
  { label: 'Pending Payments', value: '₹ 0', delta: 'Awaiting records', accent: 'teal' },
  { label: 'Follow-ups Due', value: '0', delta: 'Awaiting records', accent: 'gold' },
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
