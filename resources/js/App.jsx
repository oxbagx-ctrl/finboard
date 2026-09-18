import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { AnalyticsView } from './views/AnalyticsView';
import { RecordsView } from './views/RecordsView';
import { ImportView } from './views/ImportView';
import { DataRoomView } from './views/DataRoomView';
import { AuditLogsView } from './views/AuditLogsView';

const MainRouter = () => {
    const { isAuthenticated, loading } = useAuth();
    const [currentRoute, setCurrentRoute] = useState('dashboard');
    const [refreshKey, setRefreshKey] = useState(0);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white font-extrabold text-xl shadow-xl shadow-brand-600/30 animate-pulse mb-4">
                    F
                </div>
                <div className="text-sm font-medium text-slate-400">Ładowanie środowiska FinBoard...</div>
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
            case 'audit-logs':
                return <AuditLogsView key={refreshKey} />;
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
                <MainRouter />
            </AuthProvider>
        </NotificationProvider>
    );
};

export default App;
