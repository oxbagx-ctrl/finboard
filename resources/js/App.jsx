import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { DealProvider } from './context/DealContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { AnalyticsView } from './views/AnalyticsView';
import { RecordsView } from './views/RecordsView';
import { ImportView } from './views/ImportView';
import { DataRoomView } from './views/DataRoomView';
import { ReportsView } from './views/ReportsView';
import { AuditLogsView } from './views/AuditLogsView';
import { AdvisorsManagementView } from './views/AdvisorsManagementView';

const MainRouter = () => {
    const { isAuthenticated, loading } = useAuth();
    const [currentRoute, setCurrentRoute] = useState('dashboard');
    const [refreshKey, setRefreshKey] = useState(0);

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
                    <MainRouter />
                </DealProvider>
            </AuthProvider>
        </NotificationProvider>
    );
};

export default App;
