import { Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { Layout } from './components/Layout.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { FormsPage, PublicFormPage } from './pages/forms.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { ClientJourneyPage } from './pages/ClientJourneyPage.jsx';
import {
  AccountsPage,
  AppointmentsPage,
  CRMPage,
  ClientsPage,
  ClientPortalPage,
  CoachingPage,
  CommunicationPage,
  IntegrationsPage,
  InventoryPage,
  FinancePage,
  OperationsPage,
  MedicinesPage,
  PackagesPage,
  PaymentsPage,
  ReportsPage,
  SettingsPage,
  StaffPage,
  ServicesPage,
  TreatmentPlansPage,
  UsersPage,
  BranchesPage,
} from './pages/modules.jsx';

export function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/public/forms/:slug" element={<PublicFormPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
          <Route path="/crm" element={<CRMPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/journey" element={<ClientJourneyPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/forms" element={<FormsPage />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/operations" element={<OperationsPage />} />
          <Route path="/medicines" element={<MedicinesPage />} />
          <Route path="/treatments" element={<TreatmentPlansPage />} />
          <Route path="/packages" element={<PackagesPage />} />
          <Route path="/coaching" element={<CoachingPage />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/communication" element={<CommunicationPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/client-portal" element={<ClientPortalPage />} />
          <Route path="/branches" element={<BranchesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
