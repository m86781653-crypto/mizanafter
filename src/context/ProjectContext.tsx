import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Project } from '@/types';

interface ProjectContextValue {
  currentProject: Project | null;
  projects: Project[];
  setCurrentProjectId: (id: string | null) => void;
  loading: boolean;
  isCentralTenant: boolean;
}
const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [projects,setProjects] = useState<Project[]>([]);
  const [currentProject,setCurrentProject] = useState<Project|null>(null);
  const [loading,setLoading] = useState(true);
  const [projectId,setProjectId] = useState<string|null>(null);
  const [isCentralTenant,setIsCentralTenant] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!profile) { setProjects([]); setCurrentProject(null); setProjectId(null); setIsCentralTenant(false); setLoading(false); return; }
    setLoading(true);
    (async () => {
      const { data: tenant } = profile.tenant_id
        ? await supabase.from('tenants').select('id,tenant_type,parent_tenant_id,status').eq('id',profile.tenant_id).maybeSingle()
        : { data: null };
      if (!alive) return;
      const central = profile.role === 'platform_admin' || (profile.role === 'tenant_manager' && tenant?.tenant_type === 'main_tenant');
      setIsCentralTenant(central);
      const base = supabase.from('projects').select('*').order('name_ar');
      const { data, error } = await (central ? base : base.eq('id',profile.project_id || ''));
      if (!alive) return;
      if (error) { console.error('Failed to load projects:',error.message); setProjects([]); setCurrentProject(null); setLoading(false); return; }
      const list = (data || []) as Project[];
      setProjects(list);
      const stored = localStorage.getItem('mizan_current_project_id');
      const desired = central
        ? (projectId && list.some(p => p.id === projectId) ? projectId : stored && list.some(p => p.id === stored) ? stored : list[0]?.id || null)
        : profile.project_id;
      setProjectId(desired);
      setCurrentProject(list.find(p => p.id === desired) || null);
      if (desired) localStorage.setItem('mizan_current_project_id',desired); else localStorage.removeItem('mizan_current_project_id');
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [profile]);

  useEffect(() => { setCurrentProject(projects.find(x => x.id === projectId) || null); }, [projectId,projects]);

  const setCurrentProjectId = (id:string|null) => {
    if (!isCentralTenant) return;
    if (id && !projects.some(p => p.id === id)) return;
    setProjectId(id);
    if (id) localStorage.setItem('mizan_current_project_id',id); else localStorage.removeItem('mizan_current_project_id');
  };

  return <ProjectContext.Provider value={{currentProject,projects,setCurrentProjectId,loading,isCentralTenant}}>{children}</ProjectContext.Provider>;
}
export function useProject(){const ctx=useContext(ProjectContext);if(!ctx)throw new Error('useProject must be used within ProjectProvider');return ctx;}
