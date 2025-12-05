import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getProjectStats,
  type Project,
  type ProjectListItem,
  type ProjectStats,
  type CreateProjectRequest,
  type UpdateProjectRequest,
} from '@/lib/api/projects';

interface ProjectsState {
  // Data
  projects: ProjectListItem[];
  currentProject: Project | null;
  selectedProjectId: string | null;
  projectStats: ProjectStats | null;
  
  // Derived/computed - updated automatically
  selectedProject: ProjectListItem | null;
  
  // Loading states
  isLoading: boolean;
  loading: boolean; // alias for isLoading
  isLoadingProject: boolean;
  isLoadingStats: boolean;
  
  // Error
  error: string | null;
  
  // Actions
  fetchProjects: () => Promise<void>;
  fetchProject: (id: string) => Promise<void>;
  fetchProjectStats: (id: string) => Promise<void>;
  createProject: (data: CreateProjectRequest) => Promise<Project>;
  updateProject: (id: string, data: UpdateProjectRequest) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  selectProject: (id: string | null) => void;
  setSelectedProjectId: (id: string | null) => void; // alias for selectProject
  clearError: () => void;
  // Internal: update selectedProject
  _updateSelectedProject: () => void;
}

// Selector to get selectedProject - use this instead of store.selectedProject
export const selectSelectedProject = (state: ProjectsState): ProjectListItem | null => {
  return state.projects.find(p => p.id === state.selectedProjectId) || null;
};

// Hook to get selectedProject with proper reactivity
export const useSelectedProject = () => {
  return useProjectsStore(
    useShallow((state) => ({
      selectedProject: state.projects.find(p => p.id === state.selectedProjectId) || null,
      selectedProjectId: state.selectedProjectId,
    }))
  );
};

export const useProjectsStore = create<ProjectsState>()(
  persist(
    (set, get) => ({
      // Initial state
      projects: [],
      currentProject: null,
      selectedProjectId: null,
      selectedProject: null,
      projectStats: null,
      isLoading: false,
      loading: false, // Will be synced with isLoading
      isLoadingProject: false,
      isLoadingStats: false,
      error: null,

      // Internal: update selectedProject based on projects and selectedProjectId
      _updateSelectedProject: () => {
        const { projects, selectedProjectId } = get();
        const selectedProject = projects.find(p => p.id === selectedProjectId) || null;
        set({ selectedProject });
      },

      // Actions
      fetchProjects: async () => {
        set({ isLoading: true, loading: true, error: null });
        try {
          const projects = await getProjects();
          const { selectedProjectId } = get();
          
          // Auto-select first project if none selected
          const newSelectedId = (!selectedProjectId && projects.length > 0) 
            ? projects[0].id 
            : selectedProjectId;
          
          // Find selectedProject
          const selectedProject = projects.find(p => p.id === newSelectedId) || null;
          
          set({ 
            projects, 
            selectedProjectId: newSelectedId,
            selectedProject,
            isLoading: false, 
            loading: false,
          });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Ошибка загрузки проектов',
            isLoading: false,
            loading: false,
          });
        }
      },

      fetchProject: async (id: string) => {
        set({ isLoadingProject: true, error: null });
        try {
          const project = await getProject(id);
          set({ currentProject: project, isLoadingProject: false });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Ошибка загрузки проекта',
            isLoadingProject: false 
          });
        }
      },

      fetchProjectStats: async (id: string) => {
        set({ isLoadingStats: true });
        try {
          const stats = await getProjectStats(id);
          set({ projectStats: stats, isLoadingStats: false });
        } catch {
          set({ isLoadingStats: false });
        }
      },

      createProject: async (data: CreateProjectRequest) => {
        set({ isLoading: true, loading: true, error: null });
        try {
          const project = await createProject(data);
          const { projects, selectedProjectId } = get();
          const newProjects: ProjectListItem[] = [...projects, {
            id: project.id,
            name: project.name,
            // Address (immutable)
            addressName: project.addressName,
            addressFullAddress: project.addressFullAddress,
            // Finance
            budget: project.budget,
            status: project.status,
            serviceType: project.serviceType,
            isHeadquarters: project.isHeadquarters,
            // Employee counts
            employeesCount: project.employeesCount,
            employeesWithLunch: 0,
            employeesWithCompensation: 0,
            // Spending breakdown
            spentLunch: 0,
            spentCompensation: 0,
            spentTotal: 0,
            // Budget remaining
            budgetRemaining: project.budget,
          }];
          set({ 
            projects: newProjects,
            selectedProject: newProjects.find(p => p.id === selectedProjectId) || null,
            isLoading: false,
            loading: false,
          });
          return project;
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Ошибка создания проекта',
            isLoading: false,
            loading: false,
          });
          throw error;
        }
      },

      updateProject: async (id: string, data: UpdateProjectRequest) => {
        set({ isLoading: true, loading: true, error: null });
        try {
          const project = await updateProject(id, data);
          const { projects, selectedProjectId } = get();
          // NOTE: Address is IMMUTABLE - cannot be changed after creation
          const updatedProjects = projects.map(p => p.id === id ? {
            ...p,
            name: project.name,
            budget: project.budget,
            status: project.status,
            serviceType: project.serviceType,
            // Address stays the same (immutable)
          } : p);
          set({ 
            projects: updatedProjects,
            selectedProject: updatedProjects.find(p => p.id === selectedProjectId) || null,
            currentProject: project,
            isLoading: false,
            loading: false,
          });
          return project;
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Ошибка обновления проекта',
            isLoading: false,
            loading: false,
          });
          throw error;
        }
      },

      deleteProject: async (id: string) => {
        set({ isLoading: true, loading: true, error: null });
        try {
          await deleteProject(id);
          const { projects, selectedProjectId } = get();
          const newProjects = projects.filter(p => p.id !== id);
          const newSelectedId = selectedProjectId === id 
            ? (newProjects[0]?.id || null) 
            : selectedProjectId;
          set({ 
            projects: newProjects,
            selectedProjectId: newSelectedId,
            selectedProject: newProjects.find(p => p.id === newSelectedId) || null,
            isLoading: false,
            loading: false,
          });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Ошибка удаления проекта',
            isLoading: false,
            loading: false,
          });
          throw error;
        }
      },

      selectProject: (id: string | null) => {
        const { projects } = get();
        set({ 
          selectedProjectId: id,
          selectedProject: projects.find(p => p.id === id) || null,
        });
      },

      setSelectedProjectId: (id: string | null) => {
        const { projects } = get();
        set({ 
          selectedProjectId: id,
          selectedProject: projects.find(p => p.id === id) || null,
        });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'projects-storage',
      partialize: (state) => ({ selectedProjectId: state.selectedProjectId }),
      onRehydrateStorage: () => (state) => {
        // After rehydration, we need to update selectedProject
        // This will be done when fetchProjects is called
        // But we can trigger a re-compute if projects are already loaded
        if (state && state.projects.length > 0) {
          const selectedProject = state.projects.find(p => p.id === state.selectedProjectId) || null;
          useProjectsStore.setState({ selectedProject });
        }
      },
    }
  )
);

