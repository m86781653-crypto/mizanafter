import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Project } from '@/types';

interface ProjectContextValue {
  currentProject: Project | null;
  projects: Project[];
  setCurrentProjectId: (id: string | null) => void;
  loading: boolean;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState<string | null>(() => {
    return localStorage.getItem('mizan_current_project_id');
  });

  useEffect(() => {
    if (!profile) {
      setProjects([]);
      setCurrentProject(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    (async () => {
      const { data, error } = await supabase.from('projects').select('*').order('name_ar');
      if (error) {
        console.error('Failed to load projects:', error.message);
        setProjects([]);
        setLoading(false);
        return;
      }
      const projectList = (data || []) as Project[];
      setProjects(projectList);

      // For non-super-admin, force their assigned project
      if (profile.role !== 'super_admin' && profile.project_id) {
        setProjectId(profile.project_id);
        const p = projectList.find((p) => p.id === profile.project_id);
        if (p) {
          setCurrentProject(p);
          localStorage.setItem('mizan_current_project_id', p.id);
        }
      } else if (projectList.length > 0 && !projectId) {
        const first = projectList[0];
        setProjectId(first.id);
        setCurrentProject(first);
        localStorage.setItem('mizan_current_project_id', first.id);
      } else if (projectId) {
        const p = projectList.find((p) => p.id === projectId);
        if (p) setCurrentProject(p);
      }

      setLoading(false);
    })();
  }, [profile]);

  useEffect(() => {
    if (projectId && projects.length > 0) {
      const p = projects.find((p) => p.id === projectId);
      if (p) setCurrentProject(p);
    } else if (!projectId) {
      setCurrentProject(null);
    }
  }, [projectId, projects]);

  const setCurrentProjectId = (id: string | null) => {
    // Non-super-admin can't switch projects
    if (profile && profile.role !== 'super_admin' && profile.project_id && id !== profile.project_id) {
      return;
    }
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
