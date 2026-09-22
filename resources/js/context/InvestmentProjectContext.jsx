import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import { investmentProjectsApi } from '../api/investmentProjects';

export const InvestmentProjectContext = createContext(null);

export const InvestmentProjectProvider = ({ children }) => {
    const { activeCompany } = useAuth();
    const { success, error: notifyError } = useNotification();

    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [selectedProject, setSelectedProject] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('assumptions');

    const fetchProjects = useCallback(async (preserveSelectedId = null) => {
        if (!activeCompany?.id) {
            setProjects([]);
            setSelectedProjectId(null);
            setSelectedProject(null);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await investmentProjectsApi.getProjects();
            const projectList = response.data?.data || [];
            setProjects(projectList);

            if (projectList.length > 0) {
                const targetId = preserveSelectedId && projectList.some(p => p.id === preserveSelectedId)
                    ? preserveSelectedId
                    : projectList[0].id;

                setSelectedProjectId(targetId);
                const found = projectList.find(p => p.id === targetId);
                setSelectedProject(found || null);
            } else {
                setSelectedProjectId(null);
                setSelectedProject(null);
            }
        } catch (err) {
            const msg = err.response?.data?.message || 'Nie udało się pobrać listy projektów inwestycyjnych.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, [activeCompany?.id]);

    // Fetch projects on active company switch
    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    // Select project by ID
    const selectProject = useCallback((id) => {
        setSelectedProjectId(id);
        const found = projects.find(p => p.id === id);
        setSelectedProject(found || null);
    }, [projects]);

    // Fetch full project details if needed
    const loadProjectDetails = useCallback(async (id) => {
        if (!id) return null;
        try {
            const response = await investmentProjectsApi.getProject(id);
            const data = response.data?.data || null;
            setSelectedProject(data);
            return data;
        } catch (err) {
            const msg = err.response?.data?.message || 'Nie udało się pobrać szczegółów projektu.';
            notifyError(msg);
            return null;
        }
    }, [notifyError]);

    // Create project
    const createProject = useCallback(async (payload) => {
        setLoading(true);
        try {
            const response = await investmentProjectsApi.createProject(payload);
            const newProject = response.data?.data;
            success('Projekt inwestycyjny został pomyślnie zainicjalizowany.');
            await fetchProjects(newProject?.id);
            return newProject;
        } catch (err) {
            const msg = err.response?.data?.message || 'Błąd podczas tworzenia projektu inwestycyjnego.';
            notifyError(msg);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [fetchProjects, success, notifyError]);

    // Update project
    const updateProject = useCallback(async (id, payload) => {
        setLoading(true);
        try {
            const response = await investmentProjectsApi.updateProject(id, payload);
            const updated = response.data?.data;
            success('Projekt inwestycyjny został pomyślnie zaktualizowany.');
            setSelectedProject(updated);
            await fetchProjects(id);
            return updated;
        } catch (err) {
            const msg = err.response?.data?.message || 'Błąd podczas aktualizacji projektu inwestycyjnego.';
            notifyError(msg);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [fetchProjects, success, notifyError]);

    // Delete project
    const deleteProject = useCallback(async (id) => {
        setLoading(true);
        try {
            await investmentProjectsApi.deleteProject(id);
            success('Projekt inwestycyjny został pomyślnie usunięty.');
            setSelectedProject(null);
            setSelectedProjectId(null);
            await fetchProjects();
        } catch (err) {
            const msg = err.response?.data?.message || 'Błąd podczas usuwania projektu inwestycyjnego.';
            notifyError(msg);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [fetchProjects, success, notifyError]);

    const value = {
        projects,
        selectedProjectId,
        selectedProject,
        loading,
        error,
        activeTab,
        setActiveTab,
        selectProject,
        loadProjectDetails,
        createProject,
        updateProject,
        deleteProject,
        refreshProjects: () => fetchProjects(selectedProjectId),
    };

    return (
        <InvestmentProjectContext.Provider value={value}>
            {children}
        </InvestmentProjectContext.Provider>
    );
};

export const useInvestmentProject = () => {
    const context = useContext(InvestmentProjectContext);
    if (!context) {
        throw new Error('useInvestmentProject must be used within an InvestmentProjectProvider');
    }
    return context;
};
