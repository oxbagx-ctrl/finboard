import React, { useState } from 'react';
import { Menu, Building2, RefreshCw, Lock, ChevronDown, User } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/Badge';
import { Tooltip } from '../ui/Tooltip';
import { ThemeToggle } from '../ui/ThemeToggle';
import { UserProfileModal } from '../auth/UserProfileModal';
import { CompanySwitcherModal } from './CompanySwitcherModal';
import { ROUTES, ROUTE_TITLES } from '../../constants/routes';

export const Header = ({ currentRoute, onToggleSidebar, onRefreshData, refreshing = false }) => {
    const { user, activeCompany, isAdmin } = useAuth();
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [switcherModalOpen, setSwitcherModalOpen] = useState(false);

    let location = null;
    try {
        location = useLocation();
    } catch {
        location = null;
    }

    const legacyTitles = {
        'dashboard': 'Pulpit Zarządczy (Executive Overview)',
        'analytics': 'Analityka P&L, Marże i Wskaźniki Płynności',
        'records': 'Księga Transakcji Finansowych',
        'investments': 'Planowanie Inwestycji i Montaż Finansowy (Project Finance)',
        'import': 'Moduł Importu Wyciągów i Zbiorów CSV',
        'data-room': 'Virtual Data Room (VDR) – Dokumentacja Transakcyjna',
        'reports': 'Raporty Zarządcze & Generator PDF',
        'audit-logs': 'Rejestr Nadzoru i Ścieżka Audytowa',
        'advisors': 'Doradcy & Przypisania / Uprawnienia',
    };

    const resolveTitle = () => {
        // 1. Direct path lookup from ROUTE_TITLES (e.g. '/dashboard', '/records', '/advisors')
        if (location?.pathname && ROUTE_TITLES[location.pathname]) {
            return ROUTE_TITLES[location.pathname];
        }
        // 2. Base root path '/'
        if (location?.pathname === '/' || location?.pathname === '') {
            return ROUTE_TITLES[ROUTES.DASHBOARD] || legacyTitles.dashboard;
        }
        // 3. Fallback to currentRoute prop if supplied
        if (currentRoute) {
            const matchedByRoute = ROUTE_TITLES[`/${currentRoute}`] || legacyTitles[currentRoute];
            if (matchedByRoute) return matchedByRoute;
        }
        // 4. Fallback matching without leading slash
        const pathKey = location?.pathname?.replace(/^\//, '');
        if (pathKey && legacyTitles[pathKey]) {
            return legacyTitles[pathKey];
        }
        return 'FinBoard';
    };

    return (
        <>
            <header className="h-14 bg-zinc-950 border-b border-zinc-800 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 font-mono print:hidden">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onToggleSidebar}
                        className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 lg:hidden"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3">
                        <h1 className="text-xs sm:text-sm font-semibold text-zinc-100 uppercase tracking-wide">
                            {resolveTitle()}
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                    {/* Confidentiality indicator */}
                    <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400">
                        <Lock className="w-3 h-3 text-amber-500" />
                        <span>STRICTLY CONFIDENTIAL</span>
                    </div>

                    {/* Refresh button */}
                    {onRefreshData && (
                        <Tooltip content="Odśwież dane z serwera">
                            <button
                                onClick={onRefreshData}
                                disabled={refreshing}
                                aria-label="Odśwież dane z serwera"
                                className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors disabled:opacity-50"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-zinc-200' : ''}`} />
                            </button>
                        </Tooltip>
                    )}

                    {/* Theme Toggle Trigger */}
                    <ThemeToggle />

                    {/* Company Switcher Trigger */}
                    {isAdmin ? (
                        <Tooltip content="Kliknij, aby przełączyć spółkę portfelową">
                            <button
                                onClick={() => setSwitcherModalOpen(true)}
                                aria-label="Przełącz spółkę portfelową"
                                className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-750 hover:border-zinc-700 rounded px-2.5 py-1 text-xs text-zinc-200 transition-all"
                            >
                                <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                <span className="font-bold text-[11px] text-zinc-100">{activeCompany?.code || 'PODMIOT'}</span>
                                <span className="hidden sm:inline text-zinc-500 text-[10px] truncate max-w-[120px]">
                                    {activeCompany?.name}
                                </span>
                                <ChevronDown className="w-3 h-3 text-zinc-500 shrink-0 ml-0.5" />
                            </button>
                        </Tooltip>
                    ) : (
                        <div className="hidden sm:flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1">
                            <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                            <span className="text-xs font-medium text-zinc-300">{activeCompany?.name}</span>
                        </div>
                    )}

                    {/* User Profile Trigger Button */}
                    <Tooltip content="Twój profil i ustawienia bezpieczeństwa">
                        <button
                            onClick={() => setProfileModalOpen(true)}
                            aria-label="Twój profil i ustawienia bezpieczeństwa"
                            className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 rounded px-2 py-1 transition-colors"
                        >
                            <div className="w-4 h-4 rounded bg-zinc-800 flex items-center justify-center text-zinc-300">
                                <User className="w-3 h-3" />
                            </div>
                        <span className="hidden md:inline text-xs text-zinc-300 font-semibold max-w-[100px] truncate">
                            {user?.name?.split(' ')[0] || 'Użytkownik'}
                        </span>
                        <Badge variant={isAdmin ? 'default' : 'brand'} size="sm">
                            {isAdmin ? 'ADMIN' : 'CLIENT'}
                        </Badge>
                    </button>
                    </Tooltip>
                </div>
            </header>

            {/* User Profile Modal */}
            <UserProfileModal
                isOpen={profileModalOpen}
                onClose={() => setProfileModalOpen(false)}
            />

            {/* Company Switcher Modal */}
            <CompanySwitcherModal
                isOpen={switcherModalOpen}
                onClose={() => setSwitcherModalOpen(false)}
            />
        </>
    );
};
