import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { DealContextBar } from './DealContextBar';

export const AppLayout = ({
    currentRoute,
    onRouteChange,
    onRefreshData,
    refreshing = false,
    refreshKey = 0,
    children,
}) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex font-sans antialiased selection:bg-brand-500/20 selection:text-brand-900 dark:selection:bg-zinc-700 dark:selection:text-white transition-colors duration-150 print:bg-white print:text-black">
            {/* Sidebar Navigation */}
            <Sidebar
                currentRoute={currentRoute}
                onRouteChange={onRouteChange}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 lg:pl-64 print:pl-0">
                <Header
                    currentRoute={currentRoute}
                    onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                    onRefreshData={onRefreshData}
                    refreshing={refreshing}
                />

                {/* Sub-header Deal Advisory Context Bar */}
                <DealContextBar />

                <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6 print:p-0 print:max-w-full print:space-y-0">
                    {children ? children : <Outlet context={{ onRefreshData, refreshing, refreshKey }} />}
                </main>
            </div>
        </div>
    );
};

