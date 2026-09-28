/**
 * FinBoard Routing Constants
 * Centralized registry of routes, paths, and view metadata for Deal Advisory SPA.
 */

export const ROUTES = Object.freeze({
    HOME: '/',
    LOGIN: '/login',
    ACCEPT_INVITATION: '/accept-invitation',
    DASHBOARD: '/dashboard',
    ANALYTICS: '/analytics',
    RECORDS: '/records',
    INVESTMENTS: '/investments',
    IMPORT: '/import',
    DATA_ROOM: '/data-room',
    REPORTS: '/reports',
    AUDIT_LOGS: '/audit-logs',
    ADVISORS: '/advisors',
    NOT_FOUND: '/404',
});

export const ROUTE_TITLES = Object.freeze({
    [ROUTES.DASHBOARD]: 'Pulpit Zarządczy (Executive Overview)',
    [ROUTES.ANALYTICS]: 'Analityka P&L, Marże i Wskaźniki Płynności',
    [ROUTES.RECORDS]: 'Księga Transakcji Finansowych',
    [ROUTES.INVESTMENTS]: 'Planowanie Inwestycji i Montaż Finansowy (Project Finance)',
    [ROUTES.IMPORT]: 'Moduł Importu Wyciągów i Zbiorów CSV',
    [ROUTES.DATA_ROOM]: 'Virtual Data Room (VDR) – Dokumentacja Transakcyjna',
    [ROUTES.REPORTS]: 'Raporty Zarządcze & Generator PDF',
    [ROUTES.AUDIT_LOGS]: 'Rejestr Nadzoru i Ścieżka Audytowa',
    [ROUTES.ADVISORS]: 'Doradcy & Przypisania / Uprawnienia',
    [ROUTES.LOGIN]: 'Logowanie do Platformy',
    [ROUTES.ACCEPT_INVITATION]: 'Aktywacja Konta i Zaproszenie',
    [ROUTES.NOT_FOUND]: '404 Nie Odnaleziono Zasobu',
});

export default ROUTES;
