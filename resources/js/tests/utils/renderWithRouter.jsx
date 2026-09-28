import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthContext } from '../../context/AuthContext';
import { NotificationContext } from '../../context/NotificationContext';

/**
 * Creates mock authentication context state with institutional defaults.
 */
export const createMockAuthContext = (overrides = {}) => ({
    user: { id: 'u-admin-1', name: 'Jan Dyrektor', role: 'admin' },
    activeCompany: { id: 'comp-1', name: 'Acme Corp', code: 'ACME' },
    availableCompanies: [{ id: 'comp-1', name: 'Acme Corp', code: 'ACME' }],
    token: 'mock-token-xyz',
    isAuthenticated: true,
    isAdmin: true,
    isSuperAdmin: false,
    isAdvisor: false,
    isClient: false,
    loading: false,
    login: vi.fn().mockResolvedValue(true),
    logout: vi.fn().mockResolvedValue(true),
    switchCompany: vi.fn(),
    updateProfile: vi.fn(),
    refreshUser: vi.fn(),
    ...overrides,
});

/**
 * Creates mock notification context functions.
 */
export const createMockNotificationContext = (overrides = {}) => ({
    notifications: [],
    notify: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    removeNotification: vi.fn(),
    ...overrides,
});

/**
 * Custom testing-library render helper wrapping the component in MemoryRouter,
 * AuthContext, and NotificationContext.
 *
 * @param {React.ReactElement} ui - Component to mount
 * @param {Object} [options]
 * @param {string} [options.route='/'] - Initial location path
 * @param {Array<string|Object>} [options.initialEntries] - History stack entries
 * @param {number} [options.initialIndex=0] - Initial entry index
 * @param {Object|null} [options.authContext] - Custom AuthContext overrides
 * @param {Object|null} [options.notificationContext] - Custom NotificationContext overrides
 * @param {React.ComponentType} [options.wrapper] - Optional additional wrapper
 * @returns {import('@testing-library/react').RenderResult & { mockAuth: Object, mockNotification: Object }}
 */
export const renderWithRouter = (ui, {
    route = '/',
    initialEntries = [route],
    initialIndex = 0,
    authContext = {},
    notificationContext = {},
    wrapper: CustomWrapper = null,
    ...renderOptions
} = {}) => {
    const mockAuth = authContext !== null
        ? createMockAuthContext(authContext)
        : null;

    const mockNotification = notificationContext !== null
        ? createMockNotificationContext(notificationContext)
        : null;

    const AllProviders = ({ children }) => {
        let content = children;

        if (CustomWrapper) {
            content = <CustomWrapper>{content}</CustomWrapper>;
        }

        if (mockNotification) {
            content = (
                <NotificationContext.Provider value={mockNotification}>
                    {content}
                </NotificationContext.Provider>
            );
        }

        if (mockAuth) {
            content = (
                <AuthContext.Provider value={mockAuth}>
                    {content}
                </AuthContext.Provider>
            );
        }

        return (
            <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
                {content}
            </MemoryRouter>
        );
    };

    const renderResult = render(ui, { wrapper: AllProviders, ...renderOptions });

    return {
        ...renderResult,
        mockAuth,
        mockNotification,
    };
};

export default renderWithRouter;
