import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Project } from '@/types';

interface ProjectContextValue { currentProject: Project | null; projects: Project[]; setCurrentProjectId: (id: string | null) => void; loading: boolean; }
const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [projects,setProjects]=useState<Project[]>([]);
  const [currentProject,setCurrentProject]=useState<Project|null>(null);
  const [loading,setLoading]=useState(true);
  const [projectId,setProjectId]=useState<string|null>(null);

  useEffect(() => {
    let alive=true;
    if (!profile) { setProjects([]); setCurrentProject(null); setProjectId(null); setLoading(false); return; }
    setLoading(true);
    (async()=>{
      const base=supabase.from('projects').select('*').order('name_ar');
      const {data,error}=profile.role==='platform_admin' ? await base : await base.eq('id',profile.project_id || '');
      if(!alive)return;
      if(error){console.error('Failed to load projects:',error.message);setProjects([]);setCurrentProject(null);setLoading(false);return;}
      const list=(data||[]) as Project[];
      setProjects(list);
      const desired=profile.role==='platform_admin' ? (projectId && list.some(p=>p.id===projectId) ? projectId : list[0]?.id || null) : profile.project_id;
      setProjectId(desired);
      setCurrentProject(list.find(p=>p.id===desired)||null);
      if(desired)localStorage.setItem('mizan_current_project_id',desired);else localStorage.removeItem('mizan_current_project_id');
      setLoading(false);
    })();
    return()=>{alive=false};
  },[profile]);

  useEffect(()=>{const p=projects.find(x=>x.id===projectId)||null;setCurrentProject(p);},[projectId,projects]);

  const setCurrentProjectId=(id:string|null)=>{
    if(profile?.role!=='platform_admin')return;
    if(id && !projects.some(p=>p.id===id))return;
    setProjectId(id);
    if(id)localStorage.setItem('mizan_current_project_id',id);else localStorage.removeItem('mizan_current_project_id');
  };
  return <ProjectContext.Provider value={{currentProject,projects,setCurrentProjectId,loading}}>{children}</ProjectContext.Provider>;
}
export function useProject(){const ctx=useContext(ProjectContext);if(!ctx)throw new Error('useProject must be used within ProjectProvider');return ctx;}
