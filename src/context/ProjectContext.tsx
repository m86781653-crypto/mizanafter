import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Project } from '@/types';

interface ProjectContextValue {
  currentProject: Project | null;
  projects: Project[];
  setCurrentProjectId: (id: string | null) => void;
  loading: boolean;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState<string | null>(() => {
    return localStorage.getItem('mizan_current_project_id');
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('projects').select('*').order('name_ar');
      if (data && data.length > 0) {
        setProjects(data as Project[]);
        if (!projectId) {
          const first = data[0] as Project;
          setProjectId(first.id);
          localStorage.setItem('mizan_current_project_id', first.id);
        }
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (projectId && projects.length > 0) {
      const p = projects.find((p) => p.id === projectId);
      if (p) setCurrentProject(p);
    } else if (!projectId) {
      setCurrentProject(null);
    }
  }, [projectId, projects]);

  const setCurrentProjectId = (id: string | null) => {
    setProjectId(id);
    if (id) localStorage.setItem('mizan_current_project_id', id);
    else localStorage.removeItem('mizan_current_project_id');
  };

  return (
    <ProjectContext.Provider value={{ currentProject, projects, setCurrentProjectId, loading }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
}
