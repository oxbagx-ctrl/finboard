import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../constants/routes';

/**
 * GuestRoute Guard
 * Restricts access to non-authenticated visitors only (e.g. login, accept-invitation).
 * Automatically redirects authenticated users to their intended destination or dashboard.
 */
export const GuestRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center font-mono">
                <div className="w-10 h-10 rounded bg-zinc-900 border border-zinc-750 flex items-center justify-center text-zinc-100 font-bold text-base mb-3 shadow-sm">
                    FB
                </div>
                <div className="text-xs text-zinc-400">INICJALIZACJA ŚRODOWISKA DEAL ADVISORY...</div>
            </div>
        );
    }

    if (isAuthenticated) {
        const from = location.state?.from?.pathname || ROUTES.DASHBOARD;
        return <Navigate to={from} replace />;
    }

    return children ? children : <Outlet />;
};

export default GuestRoute;
