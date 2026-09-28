import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { ProtectedRoute, GuestRoute, RoleGuard } from '../../components/routing';
import { renderWithRouter } from '../utils/renderWithRouter';
import { ROUTES } from '../../constants/routes';

// Test consumer to inspect location state in redirects
const LocationInspector = () => {
    const location = useLocation();
    return (
        <div>
            <span data-testid="current-path">{location.pathname}</span>
            <span data-testid="from-path">{location.state?.from?.pathname || 'none'}</span>
        </div>
    );
};

describe('Route Guards Suite (Phase 59 Commit 292)', () => {
    describe('ProtectedRoute', () => {
        it('renders loading splash screen when authentication state is loading', () => {
            renderWithRouter(
                <ProtectedRoute>
                    <div data-testid="protected-content">Content</div>
                </ProtectedRoute>,
                {
                    authContext: { loading: true, isAuthenticated: false },
                }
            );

            expect(screen.getByText('INICJALIZACJA ŚRODOWISKA DEAL ADVISORY...')).toBeInTheDocument();
            expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
        });

        it('redirects unauthenticated user to /login and preserves attempted destination in state', () => {
            renderWithRouter(
                <Routes>
                    <Route
                        path="/investments"
                        element={
                            <ProtectedRoute>
                                <div data-testid="protected-content">Content</div>
                            </ProtectedRoute>
                        }
                    />
                    <Route path={ROUTES.LOGIN} element={<LocationInspector />} />
                </Routes>,
                {
                    route: '/investments',
                    authContext: { isAuthenticated: false, loading: false },
                }
            );

            expect(screen.getByTestId('current-path')).toHaveTextContent(ROUTES.LOGIN);
            expect(screen.getByTestId('from-path')).toHaveTextContent('/investments');
            expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
        });

        it('renders protected children when user is authenticated', () => {
            renderWithRouter(
                <ProtectedRoute>
                    <div data-testid="protected-content">Chroniona Zawartość</div>
                </ProtectedRoute>,
                {
                    authContext: { isAuthenticated: true, loading: false },
                }
            );

            expect(screen.getByTestId('protected-content')).toBeInTheDocument();
            expect(screen.getByText('Chroniona Zawartość')).toBeInTheDocument();
        });

        it('renders nested routes via Outlet when children prop is omitted', () => {
            renderWithRouter(
                <Routes>
                    <Route element={<ProtectedRoute />}>
                        <Route
                            path="/analytics"
                            element={<div data-testid="outlet-content">Outlet Analytics</div>}
                        />
                    </Route>
                </Routes>,
                {
                    route: '/analytics',
                    authContext: { isAuthenticated: true, loading: false },
                }
            );

            expect(screen.getByTestId('outlet-content')).toBeInTheDocument();
        });
    });

    describe('GuestRoute', () => {
        it('renders loading splash screen when loading is true', () => {
            renderWithRouter(
                <GuestRoute>
                    <div data-testid="guest-content">Login Form</div>
                </GuestRoute>,
                {
                    authContext: { loading: true },
                }
            );

            expect(screen.getByText('INICJALIZACJA ŚRODOWISKA DEAL ADVISORY...')).toBeInTheDocument();
            expect(screen.queryByTestId('guest-content')).not.toBeInTheDocument();
        });

        it('renders public guest content when visitor is unauthenticated', () => {
            renderWithRouter(
                <GuestRoute>
                    <div data-testid="guest-content">Publiczne Logowanie</div>
                </GuestRoute>,
                {
                    authContext: { isAuthenticated: false, loading: false },
                }
            );

            expect(screen.getByTestId('guest-content')).toBeInTheDocument();
            expect(screen.getByText('Publiczne Logowanie')).toBeInTheDocument();
        });

        it('redirects authenticated user to /dashboard by default', () => {
            renderWithRouter(
                <Routes>
                    <Route
                        path={ROUTES.LOGIN}
                        element={
                            <GuestRoute>
                                <div data-testid="guest-content">Login Form</div>
                            </GuestRoute>
                        }
                    />
                    <Route path={ROUTES.DASHBOARD} element={<LocationInspector />} />
                </Routes>,
                {
                    route: ROUTES.LOGIN,
                    authContext: { isAuthenticated: true, loading: false },
                }
            );

            expect(screen.getByTestId('current-path')).toHaveTextContent(ROUTES.DASHBOARD);
            expect(screen.queryByTestId('guest-content')).not.toBeInTheDocument();
        });

        it('redirects authenticated user back to intended destination from location.state.from', () => {
            renderWithRouter(
                <Routes>
                    <Route
                        path={ROUTES.LOGIN}
                        element={
                            <GuestRoute>
                                <div data-testid="guest-content">Login Form</div>
                            </GuestRoute>
                        }
                    />
                    <Route path="/data-room" element={<LocationInspector />} />
                </Routes>,
                {
                    initialEntries: [
                        {
                            pathname: ROUTES.LOGIN,
                            state: { from: { pathname: '/data-room' } },
                        },
                    ],
                    authContext: { isAuthenticated: true, loading: false },
                }
            );

            expect(screen.getByTestId('current-path')).toHaveTextContent('/data-room');
            expect(screen.queryByTestId('guest-content')).not.toBeInTheDocument();
        });
    });

    describe('RoleGuard', () => {
        it('grants access to super_admin regardless of allowedRoles array', () => {
            renderWithRouter(
                <RoleGuard allowedRoles={['special_role']}>
                    <div data-testid="rbac-content">Super Admin Module</div>
                </RoleGuard>,
                {
                    authContext: {
                        isSuperAdmin: true,
                        isAdmin: false,
                        isAdvisor: false,
                        user: { role: 'super_admin' },
                    },
                }
            );

            expect(screen.getByTestId('rbac-content')).toBeInTheDocument();
        });

        it('grants access to admin and advisor roles', () => {
            const { unmount } = renderWithRouter(
                <RoleGuard allowedRoles={['advisor']}>
                    <div data-testid="advisor-content">Advisor Module</div>
                </RoleGuard>,
                {
                    authContext: {
                        isSuperAdmin: false,
                        isAdmin: true,
                        isAdvisor: false,
                        user: { role: 'admin' },
                    },
                }
            );

            expect(screen.getByTestId('advisor-content')).toBeInTheDocument();
            unmount();

            renderWithRouter(
                <RoleGuard allowedRoles={['advisor']}>
                    <div data-testid="advisor-content-2">Advisor Module 2</div>
                </RoleGuard>,
                {
                    authContext: {
                        isSuperAdmin: false,
                        isAdmin: false,
                        isAdvisor: true,
                        user: { role: 'advisor' },
                    },
                }
            );

            expect(screen.getByTestId('advisor-content-2')).toBeInTheDocument();
        });

        it('denies access to unauthorized role, triggers warning notification, and redirects to dashboard', () => {
            const { mockNotification } = renderWithRouter(
                <Routes>
                    <Route
                        path="/advisors"
                        element={
                            <RoleGuard allowedRoles={['admin', 'advisor']}>
                                <div data-testid="protected-advisors">Advisors Management</div>
                            </RoleGuard>
                        }
                    />
                    <Route path={ROUTES.DASHBOARD} element={<LocationInspector />} />
                </Routes>,
                {
                    route: '/advisors',
                    authContext: {
                        isSuperAdmin: false,
                        isAdmin: false,
                        isAdvisor: false,
                        user: { role: 'client' },
                    },
                }
            );

            expect(screen.getByTestId('current-path')).toHaveTextContent(ROUTES.DASHBOARD);
            expect(screen.queryByTestId('protected-advisors')).not.toBeInTheDocument();
            expect(mockNotification.warning).toHaveBeenCalledWith(
                'Brak uprawnień do przeglądania wybranego modułu.',
                'Odmowa Dostępu'
            );
        });

        it('renders nested route via Outlet when allowed and children prop is omitted', () => {
            renderWithRouter(
                <Routes>
                    <Route element={<RoleGuard allowedRoles={['admin']} />}>
                        <Route
                            path="/audit-logs"
                            element={<div data-testid="audit-outlet">Audit Logs Outlet</div>}
                        />
                    </Route>
                </Routes>,
                {
                    route: '/audit-logs',
                    authContext: {
                        isAdmin: true,
                        user: { role: 'admin' },
                    },
                }
            );

            expect(screen.getByTestId('audit-outlet')).toBeInTheDocument();
        });
    });
});
