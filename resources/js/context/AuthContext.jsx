import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('finboard_token'));
    const [activeCompany, setActiveCompany] = useState(null);
    const [availableCompanies, setAvailableCompanies] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedUser = localStorage.getItem('finboard_user');
        const storedCompany = localStorage.getItem('finboard_active_company');
        const storedAvailable = localStorage.getItem('finboard_available_companies');

        if (storedUser) {
            try {
                const parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);

                if (storedCompany) {
                    setActiveCompany(JSON.parse(storedCompany));
                } else if (parsedUser.company) {
                    setActiveCompany(parsedUser.company);
                }

                if (storedAvailable) {
                    setAvailableCompanies(JSON.parse(storedAvailable));
                }
            } catch (e) {
                console.error('Failed to parse auth data from localStorage', e);
            }
        }

        if (token) {
            fetchCurrentUser();
        } else {
            setLoading(false);
        }
    }, [token]);

    const fetchCurrentUser = async () => {
        try {
            const response = await apiClient.get('/auth/me');
            const userData = response.data.user;
            const companies = response.data.available_companies || [];

            setUser(userData);
            setAvailableCompanies(companies);
            localStorage.setItem('finboard_user', JSON.stringify(userData));
            localStorage.setItem('finboard_available_companies', JSON.stringify(companies));

            const storedCompany = localStorage.getItem('finboard_active_company');
            if (storedCompany) {
                const parsed = JSON.parse(storedCompany);
                // Ensure the stored company is still valid in availableCompanies
                const matched = companies.find(c => c.id === parsed.id) || parsed;
                setActiveCompany(matched);
            } else if (userData.company) {
                setActiveCompany(userData.company);
                localStorage.setItem('finboard_active_company', JSON.stringify(userData.company));
                localStorage.setItem('finboard_active_company_id', userData.company.id);
            } else if (companies.length > 0) {
                setActiveCompany(companies[0]);
                localStorage.setItem('finboard_active_company', JSON.stringify(companies[0]));
                localStorage.setItem('finboard_active_company_id', companies[0].id);
            }
        } catch (error) {
            logout();
        } finally {
            setLoading(false);
        }
    };

    const login = (authToken, userData, companies = []) => {
        localStorage.setItem('finboard_token', authToken);
        localStorage.setItem('finboard_user', JSON.stringify(userData));
        localStorage.setItem('finboard_available_companies', JSON.stringify(companies));
        setToken(authToken);
        setUser(userData);
        setAvailableCompanies(companies);

        if (userData.company) {
            setActiveCompany(userData.company);
            localStorage.setItem('finboard_active_company', JSON.stringify(userData.company));
            localStorage.setItem('finboard_active_company_id', userData.company.id);
        } else if (companies.length > 0) {
            setActiveCompany(companies[0]);
            localStorage.setItem('finboard_active_company', JSON.stringify(companies[0]));
            localStorage.setItem('finboard_active_company_id', companies[0].id);
        }
    };

    const logout = async () => {
        try {
            if (token) {
                await apiClient.post('/auth/logout');
            }
        } catch (e) {
            // ignore network errors on logout
        } finally {
            localStorage.removeItem('finboard_token');
            localStorage.removeItem('finboard_user');
            localStorage.removeItem('finboard_active_company');
            localStorage.removeItem('finboard_active_company_id');
            localStorage.removeItem('finboard_available_companies');
            setToken(null);
            setUser(null);
            setActiveCompany(null);
            setAvailableCompanies([]);
        }
    };

    const switchCompany = useCallback((company) => {
        setActiveCompany(company);
        if (company) {
            localStorage.setItem('finboard_active_company', JSON.stringify(company));
            localStorage.setItem('finboard_active_company_id', company.id);
        } else {
            localStorage.removeItem('finboard_active_company');
            localStorage.removeItem('finboard_active_company_id');
        }
        // Dispatch custom DOM event for any reactive listener
        window.dispatchEvent(new CustomEvent('finboard:company-changed', { detail: company }));
    }, []);

    const updateProfile = async ({ name, currentPassword, newPassword }) => {
        const payload = {};
        if (name) payload.name = name;
        if (currentPassword && newPassword) {
            payload.current_password = currentPassword;
            payload.new_password = newPassword;
        }

        const response = await apiClient.put('/auth/profile', payload);
        const updatedUser = response.data.user;
        setUser(updatedUser);
        localStorage.setItem('finboard_user', JSON.stringify(updatedUser));
        return response.data;
    };

    const isAdmin = user?.role === 'admin';
    const isClient = user?.role === 'client';

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                activeCompany,
                availableCompanies,
                isAdmin,
                isClient,
                loading,
                login,
                logout,
                switchCompany,
                updateProfile,
                refreshUser: fetchCurrentUser,
                isAuthenticated: !!token && !!user,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
