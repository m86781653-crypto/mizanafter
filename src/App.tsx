import { useState } from 'react';
import { ProjectProvider } from '@/context/ProjectContext';
import { Layout } from '@/components/Layout';
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

function App() {
  const [page, setPage] = useState('dashboard');

  const renderPage = () => {
    switch (page) {
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

  return (
    <ProjectProvider>
      <Layout activePage={page} onNavigate={setPage}>
        {renderPage()}
      </Layout>
    </ProjectProvider>
  );
}

export default App;
