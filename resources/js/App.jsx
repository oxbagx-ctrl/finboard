import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { DealProvider } from './context/DealContext';
import { InvestmentProjectProvider } from './context/InvestmentProjectContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginView } from './views/LoginView';
import { AcceptInvitationView } from './views/AcceptInvitationView';
import { DashboardView } from './views/DashboardView';
import { AnalyticsView } from './views/AnalyticsView';
import { RecordsView } from './views/RecordsView';
import { InvestmentPlanningView } from './views/InvestmentPlanningView';
import { ImportView } from './views/ImportView';
import { DataRoomView } from './views/DataRoomView';
import { ReportsView } from './views/ReportsView';
import { AuditLogsView } from './views/AuditLogsView';
import { AdvisorsManagementView } from './views/AdvisorsManagementView';

const hasInvitationTokenInUrl = () => {
    if (typeof window === 'undefined') return false;
    const searchParams = new URLSearchParams(window.location.search);
    const hasToken = !!searchParams.get('token');
    const isInvitationPath = window.location.pathname.includes('/invitation') || window.location.pathname.includes('/accept-invitation');
    return hasToken || isInvitationPath;
};

const MainRouter = () => {
    const { isAuthenticated, loading } = useAuth();
    const [currentRoute, setCurrentRoute] = useState('dashboard');
    const [refreshKey, setRefreshKey] = useState(0);
    const [showInvitation, setShowInvitation] = useState(hasInvitationTokenInUrl);

    useEffect(() => {
        const handlePopState = () => {
            setShowInvitation(hasInvitationTokenInUrl());
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

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

    if (!isAuthenticated) {
        if (showInvitation) {
            return (
                <AcceptInvitationView
                    onNavigateLogin={() => setShowInvitation(false)}
                />
            );
        }
        return <LoginView />;
    }

    const renderView = () => {
        switch (currentRoute) {
            case 'dashboard':
                return <DashboardView key={refreshKey} />;
            case 'analytics':
                return <AnalyticsView key={refreshKey} />;
            case 'records':
                return <RecordsView key={refreshKey} />;
            case 'investments':
                return <InvestmentPlanningView key={refreshKey} />;
            case 'import':
                return <ImportView key={refreshKey} />;
            case 'data-room':
                return <DataRoomView key={refreshKey} />;
            case 'reports':
                return <ReportsView key={refreshKey} />;
            case 'audit-logs':
                return <AuditLogsView key={refreshKey} />;
            case 'advisors':
                return <AdvisorsManagementView key={refreshKey} />;
            default:
                return <DashboardView key={refreshKey} />;
        }
    };

    return (
        <AppLayout
            currentRoute={currentRoute}
            onRouteChange={setCurrentRoute}
            onRefreshData={() => setRefreshKey(prev => prev + 1)}
        >
            {renderView()}
        </AppLayout>
    );
};

export const App = () => {
    return (
        <NotificationProvider>
            <AuthProvider>
                <DealProvider>
                    <InvestmentProjectProvider>
                        <MainRouter />
                    </InvestmentProjectProvider>
                </DealProvider>
            </AuthProvider>
        </NotificationProvider>
    );
};

export default App;
