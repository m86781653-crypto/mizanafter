import { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ProjectProvider } from '@/context/ProjectContext';
import { Layout } from '@/components/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { ChangePasswordPage } from '@/pages/ChangePasswordPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { InfrastructurePage } from '@/pages/InfrastructurePage';
import { CustomersPage } from '@/pages/CustomersPage';
import { ReadingsPage } from '@/pages/ReadingsPage';
import { BillingPage } from '@/pages/BillingPage';
import { MaintenancePage } from '@/pages/MaintenancePage';
import { ReportsPage } from '@/pages/ReportsPage';
import { CopilotPage } from '@/pages/CopilotPage';
import { SettingsPage } from '@/pages/SettingsPage';
import type { UserRole } from '@/types';

const allPages = [
  'dashboard', 'projects', 'infrastructure', 'customers', 'readings',
  'billing', 'maintenance', 'reports', 'copilot', 'settings',
] as const;
type PageId = typeof allPages[number];

const roleAccess: Record<UserRole, PageId[]> = {
  platform_admin: [...allPages],
  tenant_manager: [...allPages],
  operations_officer: ['dashboard', 'projects', 'infrastructure', 'customers', 'readings', 'billing', 'maintenance', 'reports', 'copilot', 'settings'],
  meter_reader: ['dashboard', 'readings', 'customers', 'copilot'],
  collection_officer: ['dashboard', 'billing', 'customers', 'copilot'],
  maintenance_officer: ['dashboard', 'maintenance', 'infrastructure', 'copilot'],
  technician: ['dashboard', 'maintenance', 'infrastructure', 'copilot'],
  data_exception_officer: ['dashboard', 'customers', 'readings', 'billing', 'maintenance', 'reports', 'copilot'],
  viewer: ['dashboard', 'reports', 'copilot'],
};

function AuthedApp() {
  const { profile, loading } = useAuth();
  const [page, setPage] = useState<PageId>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-neutral-500">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <LoginPage />;
  }

  // Force password change
  if (profile.must_change_password) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <ChangePasswordPage />
      </div>
    );
  }

  const allowedPages = roleAccess[profile.role] || ['dashboard'];
  const effectivePage = allowedPages.includes(page) ? page : 'dashboard';

  const renderPage = () => {
    switch (effectivePage) {
      case 'dashboard': return <DashboardPage />;
      case 'projects': return <ProjectsPage />;
      case 'infrastructure': return <InfrastructurePage />;
      case 'customers': return <CustomersPage />;
      case 'readings': return <ReadingsPage />;
      case 'billing': return <BillingPage />;
      case 'maintenance': return <MaintenancePage />;
      case 'reports': return <ReportsPage />;
      case 'copilot': return <CopilotPage />;
      case 'settings': return <SettingsPage />;
      default: return <DashboardPage />;
    }
  };

  const handleNavigate = (p: string) => {
    if (allowedPages.includes(p as PageId)) {
      setPage(p as PageId);
    }
  };

  return (
    <ProjectProvider>
      <Layout activePage={effectivePage} onNavigate={handleNavigate} allowedPages={allowedPages}>
        {renderPage()}
      </Layout>
    </ProjectProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AuthedApp />
    </AuthProvider>
  );
}

export default App;
