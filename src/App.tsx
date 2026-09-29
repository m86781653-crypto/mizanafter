import { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ProjectProvider } from '@/context/ProjectContext';
import { Layout } from '@/components/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { ChangePasswordPage } from '@/pages/ChangePasswordPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { InfrastructurePage } from '@/pages/InfrastructurePage';
import { CustomersPage } from '@/pages/CustomersPage';
import { ReadingsPage } from '@/pages/ReadingsPage';
import { BillingPage } from '@/pages/BillingPage';
import { MaintenancePage } from '@/pages/MaintenancePage';
import { WaterProductionPage } from '@/pages/WaterProductionPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { CopilotPage } from '@/pages/CopilotPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { LossAnalysisPage } from '@/pages/LossAnalysisPage';
import { CostsPage } from '@/pages/CostsPage';
import { UsersPage } from '@/pages/UsersPage';
import type { UserRole } from '@/types';

const allPages = ['dashboard','projects','infrastructure','customers','readings','billing','maintenance','water-production','reports','loss-analysis','costs','users','copilot','settings'] as const;
type PageId = typeof allPages[number];

const roleAccess: Record<UserRole, PageId[]> = {
  platform_admin: [...allPages],
  central_governance: ['dashboard','projects','reports','loss-analysis','costs','users','settings'],
  project_manager: ['dashboard','projects','infrastructure','customers','readings','billing','maintenance','water-production','reports','loss-analysis','costs','copilot','settings'],
  tenant_manager: ['dashboard','projects','infrastructure','customers','readings','billing','maintenance','water-production','reports','loss-analysis','costs','copilot','settings'],
  operations_officer: ['dashboard','infrastructure','maintenance','water-production','reports','loss-analysis','copilot','settings'],
  operations_maintenance: ['dashboard','infrastructure','maintenance','water-production','reports','loss-analysis','copilot','settings'],
  meter_reader: ['readings','settings'],
  collection_officer: ['billing','settings'],
  maintenance_officer: ['dashboard','maintenance','infrastructure','water-production','copilot','settings'],
  technician: ['dashboard','maintenance','infrastructure','copilot','settings'],
  data_exception_officer: ['dashboard','readings','reports','loss-analysis','copilot','settings'],
  viewer: ['dashboard','reports','loss-analysis','copilot','settings'],
};

function AuthedApp(){
  const {profile,loading}=useAuth();
  const [page,setPage]=useState<PageId>('dashboard');
  if (typeof window !== 'undefined' && window.location.pathname === '/onboarding') return <OnboardingPage/>;
  const isRecoveryFlow=typeof window!=='undefined' && window.location.hash.includes('type=recovery');

  if(isRecoveryFlow)return <ResetPasswordPage/>;
  if(loading)return <div className="min-h-screen flex items-center justify-center bg-neutral-50"><p>جاري التحميل...</p></div>;
  if(!profile)return <LoginPage/>;
  if(profile.must_change_password)return <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4"><ChangePasswordPage/></div>;

  const allowedPages=roleAccess[profile.role]||['dashboard'];
  const roleDefaultPage: PageId = profile.role === 'meter_reader' ? 'readings' : profile.role === 'collection_officer' ? 'billing' : profile.role === 'operations_maintenance' ? 'water-production' : 'dashboard';
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
      case'water-production':return <WaterProductionPage/>;
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