import React, { useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, useOutletContext, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { DealProvider } from './context/DealContext';
import { InvestmentProjectProvider } from './context/InvestmentProjectContext';
import { ROUTES } from './constants/routes';
import { ProtectedRoute, GuestRoute, RoleGuard } from './components/routing';
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

/**
 * ProtectedLayout Shell
 * Hosts AppLayout outlet architecture and propagates refresh triggers to nested views.
 */
const ProtectedLayout = () => {
    const [refreshKey, setRefreshKey] = useState(0);
    const location = useLocation();
    const navigate = useNavigate();

    // Current route identifier for legacy Sidebar navigation until Commit 290
    const currentRoute = location.pathname === '/' || location.pathname === ROUTES.DASHBOARD
        ? 'dashboard'
        : location.pathname.replace(/^\//, '');

    const handleRouteChange = (routeId) => {
        const targetPath = routeId === 'dashboard' ? ROUTES.DASHBOARD : `/${routeId}`;
        navigate(targetPath);
    };

    return (
        <AppLayout
            currentRoute={currentRoute}
            onRouteChange={handleRouteChange}
            refreshKey={refreshKey}
            onRefreshData={() => setRefreshKey((prev) => prev + 1)}
        />
    );
};

/**
 * RouteView Wrapper
 * Passes refresh key down to active view component to force re-mounting on manual refresh.
 */
const RouteView = ({ component: Component }) => {
    const context = useOutletContext() || {};
    return <Component key={context.refreshKey ?? 0} />;
};

/**
 * Application Routes Declaration
 */
export const AppRoutes = () => {
    return (
        <Routes>
            {/* Public / Guest Routes */}
            <Route
                path={ROUTES.LOGIN}
                element={
                    <GuestRoute>
                        <LoginView />
                    </GuestRoute>
                }
            />
            <Route
                path={ROUTES.ACCEPT_INVITATION}
                element={
                    <GuestRoute>
                        <AcceptInvitationView />
                    </GuestRoute>
                }
            />
            <Route
                path={`${ROUTES.ACCEPT_INVITATION}/:token`}
                element={
                    <GuestRoute>
                        <AcceptInvitationView />
                    </GuestRoute>
                }
            />
            <Route
                path="/invitation/accept"
                element={
                    <GuestRoute>
                        <AcceptInvitationView />
                    </GuestRoute>
                }
            />
            <Route
                path="/invitation/:token"
                element={
                    <GuestRoute>
                        <AcceptInvitationView />
                    </GuestRoute>
                }
            />
            <Route
                path="/invitation"
                element={
                    <GuestRoute>
                        <AcceptInvitationView />
                    </GuestRoute>
                }
            />

            {/* Protected Application Routes */}
            <Route
                element={
                    <ProtectedRoute>
                        <ProtectedLayout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<Navigate to={ROUTES.DASHBOARD} replace />} />
                <Route path={ROUTES.DASHBOARD} element={<RouteView component={DashboardView} />} />
                <Route path={ROUTES.ANALYTICS} element={<RouteView component={AnalyticsView} />} />
                <Route path={ROUTES.RECORDS} element={<RouteView component={RecordsView} />} />
                <Route path={ROUTES.INVESTMENTS} element={<RouteView component={InvestmentPlanningView} />} />
                <Route path={ROUTES.IMPORT} element={<RouteView component={ImportView} />} />
                <Route path={ROUTES.DATA_ROOM} element={<RouteView component={DataRoomView} />} />
                <Route path={ROUTES.REPORTS} element={<RouteView component={ReportsView} />} />
                <Route path={ROUTES.AUDIT_LOGS} element={<RouteView component={AuditLogsView} />} />

                {/* Role-Guarded Route: Advisors Management */}
                <Route
                    path={ROUTES.ADVISORS}
                    element={
                        <RoleGuard allowedRoles={['super_admin', 'admin', 'advisor']}>
                            <RouteView component={AdvisorsManagementView} />
                        </RoleGuard>
                    }
                />
            </Route>

            {/* Catch-all Fallback */}
            <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
        </Routes>
    );
};

export const App = () => {
    return (
        <NotificationProvider>
            <AuthProvider>
                <DealProvider>
                    <InvestmentProjectProvider>
                        <AppRoutes />
                    </InvestmentProjectProvider>
                </DealProvider>
            </AuthProvider>
        </NotificationProvider>
    );
};

export default App;
