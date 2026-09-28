import { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ProjectProvider } from '@/context/ProjectContext';
import { Layout } from '@/components/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
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
import { LossAnalysisPage } from '@/pages/LossAnalysisPage';
import { CostsPage } from '@/pages/CostsPage';
import { UsersPage } from '@/pages/UsersPage';
import type { UserRole } from '@/types';

const allPages = ['dashboard','projects','infrastructure','customers','readings','billing','maintenance','reports','loss-analysis','costs','users','copilot','settings'] as const;
type PageId = typeof allPages[number];

const roleAccess: Record<UserRole, PageId[]> = {
  platform_admin: [...allPages],
  central_governance: ['dashboard','projects','reports','loss-analysis','costs','users','settings'],
  project_manager: ['dashboard','projects','infrastructure','customers','readings','billing','maintenance','reports','loss-analysis','costs','copilot','settings'],
  tenant_manager: ['dashboard','projects','infrastructure','customers','readings','billing','maintenance','reports','loss-analysis','costs','copilot','settings'],
  operations_officer: ['dashboard','infrastructure','maintenance','reports','loss-analysis','copilot','settings'],
  meter_reader: ['readings','settings'],
  collection_officer: ['billing','settings'],
  maintenance_officer: ['dashboard','maintenance','infrastructure','copilot','settings'],
  technician: ['dashboard','maintenance','infrastructure','copilot','settings'],
  data_exception_officer: ['dashboard','readings','reports','loss-analysis','copilot','settings'],
  viewer: ['dashboard','reports','loss-analysis','copilot','settings'],
};

function AuthedApp(){
  const {profile,loading}=useAuth();
  const [page,setPage]=useState<PageId>(() => {\n    if (typeof window === 'undefined') return 'dashboard';\n    return 'dashboard';\n  });
  const isRecoveryFlow=typeof window!=='undefined' && window.location.hash.includes('type=recovery');

  if(isRecoveryFlow)return <ResetPasswordPage/>;
  if(loading)return <div className="min-h-screen flex items-center justify-center bg-neutral-50"><p>جاري التحميل...</p></div>;
  if(!profile)return <LoginPage/>;
  if(profile.must_change_password)return <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4"><ChangePasswordPage/></div>;

  const allowedPages=roleAccess[profile.role]||['dashboard'];\n  const roleDefaultPage: PageId = profile.role === 'meter_reader' ? 'readings' : profile.role === 'collection_officer' ? 'billing' : 'dashboard';\n  const effectiveInitialPage = allowedPages.includes(page) ? page : roleDefaultPage;
  const effectivePage=allowedPages.includes(page)?page:roleDefaultPage;

  const renderPage=()=>{
    switch(effectivePage){
      case'dashboard':return <DashboardPage/>;
      case'projects':return <ProjectsPage/>;
      case'infrastructure':return <InfrastructurePage/>;
      case'customers':return <CustomersPage/>;
      case'readings':return <ReadingsPage/>;
      case'billing':return <BillingPage/>;
      case'maintenance':return <MaintenancePage/>;
      case'reports':return <ReportsPage/>;
      case'loss-analysis':return <LossAnalysisPage/>;
      case'costs':return <CostsPage/>;
      case'users':return <UsersPage/>;
      case'copilot':return <CopilotPage/>;
      case'settings':return <SettingsPage/>;
      default:return <DashboardPage/>;
    }
  };

  const handleNavigate=(p:string)=>{if(allowedPages.includes(p as PageId))setPage(p as PageId);};

  return <ProjectProvider><Layout activePage={effectivePage} onNavigate={handleNavigate} allowedPages={allowedPages}>{renderPage()}</Layout></ProjectProvider>;
}

function App(){return <AuthProvider><AuthedApp/></AuthProvider>}
export default App;