import React, { createContext, useContext, useState, useEffect } from 'react';
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

        if (storedUser) {
            try {
                const parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);

                if (storedCompany) {
                    setActiveCompany(JSON.parse(storedCompany));
                } else if (parsedUser.company) {
                    setActiveCompany(parsedUser.company);
                }
            } catch (e) {
                console.error('Failed to parse user from localStorage', e);
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
            setUser(userData);
            localStorage.setItem('finboard_user', JSON.stringify(userData));

            const storedCompany = localStorage.getItem('finboard_active_company');
            if (storedCompany) {
                setActiveCompany(JSON.parse(storedCompany));
            } else if (userData.company) {
                setActiveCompany(userData.company);
                localStorage.setItem('finboard_active_company', JSON.stringify(userData.company));
                localStorage.setItem('finboard_active_company_id', userData.company.id);
            }
        } catch (error) {
            logout();
        } finally {
            setLoading(false);
        }
    };

    const login = (authToken, userData) => {
        localStorage.setItem('finboard_token', authToken);
        localStorage.setItem('finboard_user', JSON.stringify(userData));
        setToken(authToken);
        setUser(userData);

        if (userData.company) {
            setActiveCompany(userData.company);
            localStorage.setItem('finboard_active_company', JSON.stringify(userData.company));
            localStorage.setItem('finboard_active_company_id', userData.company.id);
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
            setToken(null);
            setUser(null);
            setActiveCompany(null);
        }
    };

    const switchCompany = (company) => {
        setActiveCompany(company);
        if (company) {
            localStorage.setItem('finboard_active_company', JSON.stringify(company));
            localStorage.setItem('finboard_active_company_id', company.id);
        } else {
            localStorage.removeItem('finboard_active_company');
            localStorage.removeItem('finboard_active_company_id');
        }
    };

    const isAdmin = user?.role === 'admin';
    const isClient = user?.role === 'client';

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                activeCompany,
                isAdmin,
                isClient,
                loading,
                login,
                logout,
                switchCompany,
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
