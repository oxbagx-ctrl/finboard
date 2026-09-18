import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const AppLayout = ({ currentRoute, onRouteChange, onRefreshData, refreshing, children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex">
            {/* Sidebar */}
            <Sidebar
                currentRoute={currentRoute}
                onRouteChange={onRouteChange}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            {/* Main Content wrapper */}
            <div className="flex-1 flex flex-col min-w-0 lg:pl-72">
                <Header
                    currentRoute={currentRoute}
                    onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                    onRefreshData={onRefreshData}
                    refreshing={refreshing}
                />

                <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
                    {children}
                </main>
            </div>
        </div>
    );
};
