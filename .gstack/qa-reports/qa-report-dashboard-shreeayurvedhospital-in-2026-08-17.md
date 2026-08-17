# QA Report — Mom's Pathshala

- Date: 2026-08-17
- Target: https://dashboard.shreeayurvedhospital.in
- Framework: React + Vite + Express/PostgreSQL
- Scope: Standard full-app QA
- Routes visited: 25/25 authenticated routes
- Primary create flows checked: 17
- Console errors: 0
- Build: Passed after every fix

## Result

Baseline health: **82/100**  
Final health: **92/100**  
Status: **DONE_WITH_CONCERNS**

All authenticated pages load without an error boundary. Navigation, primary add/create dialogs, Patient Journey, global search and the new Pregnancy/Garbhsanskar History flow were checked on the deployed app.

## Fixed issues

### ISSUE-001 — Incorrect signed-in role shown outside Dashboard

- Severity: Medium
- Area: Header / authentication identity
- Repro: Open any non-dashboard page as Administrator. Header displayed `Team Operator`.
- Fix: Header now reads the actual session role.
- Commit: `17f4374`
- Status: Verified on production
- Evidence: `screenshots/issue-001-role-before.png`

### ISSUE-002 — Global search opened duplicate/incorrect module tabs

- Severity: Medium
- Area: Navigation
- Repro: Search `medicine`; app opened `Operations → Inventory` instead of Medicines.
- Fix: Search terms now route directly to the matching live module pages.
- Commit: `575efc4`
- Status: Verified on production (`medicine` → `/medicines`)
- Evidence: `screenshots/issue-002-search-before.png`

### ISSUE-003 — Cloud sync remained paused after login hydration

- Severity: High
- Area: Cloud persistence
- Impact: Changes saved immediately after login could remain local and never enter the cloud queue.
- Fix: Cloud sync resumes as soon as hydration completes or fails.
- Commit: `89d0a13`
- Status: Verified by build and code-path review

### ISSUE-004 — Rapid saves could reach cloud out of order

- Severity: High
- Area: Cloud persistence
- Impact: An older slow PUT could finish after a newer PUT and overwrite the latest state.
- Fix: Updates are serialized independently for each storage key.
- Commit: `d3d2e27`
- Status: Verified by build and code-path review

### ISSUE-005 — Pregnancy history missing from patient print

- Severity: Medium
- Area: Patient Journey / print
- Fix: Added Pregnancy/Garbhsanskar History to print selection, preview and generated clinical summary.
- Commit: `2ae1682`
- Status: Verified on production

## Verified flows

- All sidebar routes render: Dashboard, CRM, Patients, Patient Journey, Appointments, Forms, Services, Treatments, Packages, Coaching, Attendance, Staff, Operations, Medicines, Inventory, Communication, Patient Portal, Finance, Payments, Accounts, Reports, Users, Integrations, Workspace and Settings.
- 17 primary add/create buttons open their intended modal or editor.
- Form creation opens the full builder.
- Global search now resolves Medicine to `/medicines`.
- Patient Journey stage order ends with Required Forms.
- Pregnancy History panel and Add History dialog render all required fields.
- Empty Pregnancy History cannot be saved.
- Pregnancy History appears as an option in Customize Patient Print.
- No browser console errors were observed during the final pass.

## Remaining concerns

### SECURITY-001 — Internal state APIs have no server-side authentication

- Severity: Critical
- Status: Deferred because it requires a server-session migration, not a safe isolated patch.
- Risk: `/api/app-state` and response-management endpoints rely on client-side login only. Direct API requests are not protected by server middleware.
- Recommendation: Add server-issued HttpOnly sessions, authorization middleware and CSRF protection before treating the dashboard as suitable for sensitive medical records.

### INTEGRATION-001 — Integration buttons simulate connection state

- Severity: High
- Status: Deferred pending provider credentials and desired vendors.
- Risk: WhatsApp marks itself connected without OAuth/provider verification. Zapier copies a non-production `ayurflow.local` URL and marks itself connected.
- Recommendation: Keep these controls explicitly disabled as “Setup required” until real provider endpoints and credentials are configured.

### TESTING-001 — No automated test framework

- Severity: Medium
- Status: Deferred to avoid adding dependencies without an explicit framework choice.
- Recommendation: Add Vitest + Testing Library for cloud sync, payment calculations, routing and Patient Journey regression tests.

## Ship readiness

Core operational UI is working and the five scoped fixes are live. The app is not fully security-ready for sensitive patient information until server-side API authentication is implemented.

PR summary: QA checked 25 routes and 17 create flows, fixed 5 issues, and improved health from 82 to 92.
