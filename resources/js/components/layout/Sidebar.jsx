import React, { useState } from 'react';
import {
    LayoutDashboard,
    TrendingUp,
    TableProperties,
    FileSpreadsheet,
    FolderLock,
    FileText,
    ShieldCheck,
    Building2,
    LogOut,
    User,
    ChevronRight,
    Users,
    Calculator
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, NavLink, useInRouterContext } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { UserProfileModal } from '../auth/UserProfileModal';
import { CompanySwitcherModal } from './CompanySwitcherModal';
import { Tooltip } from '../ui/Tooltip';

export const Sidebar = ({ currentRoute, onRouteChange, isOpen, onClose }) => {
    const { user, activeCompany, isAdmin, isSuperAdmin, isAdvisor, logout } = useAuth();
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [switcherModalOpen, setSwitcherModalOpen] = useState(false);
    const inRouter = useInRouterContext();

    let navigate = null;
    try {
        navigate = useNavigate();
    } catch {
        navigate = (to) => {
            if (typeof window !== 'undefined' && typeof to === 'string') {
                window.location.href = to;
            }
        };
    }

    const handleLogout = async () => {
        try {
            await logout();
        } finally {
            if (navigate) {
                navigate(ROUTES.LOGIN, { replace: true });
            } else if (typeof window !== 'undefined') {
                window.location.href = ROUTES.LOGIN;
            }
        }
    };

    const baseNavItems = [
        { id: 'dashboard', path: ROUTES.DASHBOARD, label: 'Executive Dashboard', code: 'DSH', icon: LayoutDashboard },
        { id: 'analytics', path: ROUTES.ANALYTICS, label: 'Analiza P&L i Wskaźniki', code: 'ANL', icon: TrendingUp },
        { id: 'records', path: ROUTES.RECORDS, label: 'Ewidencja Operacji', code: 'REC', icon: TableProperties },
        { id: 'investments', path: ROUTES.INVESTMENTS, label: 'Planowanie Inwestycji', code: 'PRJ', icon: Calculator },
        { id: 'import', path: ROUTES.IMPORT, label: 'Import Danych Finansowych', code: 'IMP', icon: FileSpreadsheet },
        { id: 'data-room', path: ROUTES.DATA_ROOM, label: 'Virtual Data Room (VDR)', code: 'VDR', icon: FolderLock },
        { id: 'reports', path: ROUTES.REPORTS, label: 'Raporty Zarządcze & PDF', code: 'REP', icon: FileText },
        { id: 'audit-logs', path: ROUTES.AUDIT_LOGS, label: 'Dziennik Nadzoru & Audyt', code: 'AUD', icon: ShieldCheck },
    ];

    const canAccessUserManagement = isAdmin || isAdvisor;

    const adminNavItems = canAccessUserManagement ? [
        {
            id: 'advisors',
            path: ROUTES.ADVISORS,
            label: isAdvisor ? 'Zaproszenia Klientów' : 'Doradcy & Przypisania',
            code: isAdvisor ? 'INV' : 'ADV',
            icon: Users
        },
    ] : [];

    const navItems = [...baseNavItems, ...adminNavItems];

    const getRoleLabel = () => {
        if (user?.role === 'super_admin') return 'ROLA: SUPER ADMIN';
        if (user?.role === 'advisor') return 'ROLA: DORADCA M&A';
        if (user?.role === 'admin') return 'ROLA: ADMIN / DORADCA';
        return 'ROLA: KLIENT / CFO';
    };

    return (
        <>
            {isOpen && (
                <div
                    onClick={onClose}
                    className="fixed inset-0 z-40 bg-zinc-950/80 lg:hidden print:hidden"
                />
            )}

            <aside
                className={`fixed top-0 left-0 bottom-0 z-50 w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 print:hidden ${
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                {/* Institutional Header */}
                <div className="h-14 flex items-center justify-between px-5 border-b border-zinc-800">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded bg-zinc-100 flex items-center justify-center text-zinc-950 font-black text-xs tracking-tighter">
                            FB
                        </div>
                        <div>
                            <div className="font-bold text-xs tracking-wider uppercase text-zinc-100 font-mono">
                                FinBoard
                            </div>
                            <div className="text-[10px] text-zinc-500 font-mono">HELVEST ADVISORY</div>
                        </div>
                    </div>
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                        ENTERPRISE
                    </span>
                </div>

                {/* Target Company Box (Interactive for Admin / Advisor) */}
                <div className="p-3 border-b border-zinc-855 bg-zinc-900/30">
                    <button
                        type="button"
                        onClick={isAdmin || isAdvisor ? () => setSwitcherModalOpen(true) : undefined}
                        className={`w-full p-2.5 rounded-md text-left transition-all ${
                            isAdmin || isAdvisor
                                ? 'bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 cursor-pointer group'
                                : 'bg-zinc-900 border border-zinc-800 cursor-default'
                        }`}
                    >
                        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 uppercase mb-1">
                            <span>PODMIOT ANALIZOWANY</span>
                            <span className="text-zinc-400">{activeCompany?.code || 'N/A'}</span>
                        </div>
                        <div className="text-xs font-semibold text-zinc-200 truncate flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 truncate">
                                <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                <span className="truncate">{activeCompany?.name || 'Wybierz podmiot'}</span>
                            </div>
                            {(isAdmin || isAdvisor) && (
                                <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-300 shrink-0" />
                            )}
                        </div>
                    </button>
                </div>

                {/* Navigation Items */}
                <div className="px-3 pt-3 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
                    MODUŁY ANALITYCZNE
                </div>
                <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
                    {navItems.map((item) => {
                        const Icon = item.icon;

                        if (inRouter) {
                            return (
                                <NavLink
                                    key={item.id}
                                    to={item.path}
                                    onClick={() => {
                                        if (onRouteChange) onRouteChange(item.id);
                                        if (onClose) onClose();
                                    }}
                                    className={({ isActive }) => {
                                        const active = isActive || currentRoute === item.id;
                                        return `w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                                            active
                                                ? 'bg-zinc-850 text-zinc-100 font-semibold border-l-2 border-zinc-100'
                                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                                        }`;
                                    }}
                                >
                                    {({ isActive }) => {
                                        const active = isActive || currentRoute === item.id;
                                        return (
                                            <>
                                                <div className="flex items-center gap-2.5">
                                                    <Icon className={`w-4 h-4 ${active ? 'text-zinc-100' : 'text-zinc-500'}`} />
                                                    <span>{item.label}</span>
                                                </div>
                                                <span className={`text-[10px] font-mono ${active ? 'text-zinc-300' : 'text-zinc-600'}`}>
                                                    {item.code}
                                                </span>
                                            </>
                                        );
                                    }}
                                </NavLink>
                            );
                        }

                        const isActive = currentRoute === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => {
                                    if (onRouteChange) onRouteChange(item.id);
                                    if (onClose) onClose();
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                                    isActive
                                        ? 'bg-zinc-850 text-zinc-100 font-semibold border-l-2 border-zinc-100'
                                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                                }`}
                            >
                                <div className="flex items-center gap-2.5">
                                    <Icon className={`w-4 h-4 ${isActive ? 'text-zinc-100' : 'text-zinc-500'}`} />
                                    <span>{item.label}</span>
                                </div>
                                <span className={`text-[10px] font-mono ${isActive ? 'text-zinc-300' : 'text-zinc-600'}`}>
                                    {item.code}
                                </span>
                            </button>
                        );
                    })}
                </nav>

                {/* Bottom User Bar */}
                <div className="p-3 border-t border-zinc-800 bg-zinc-950">
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => setProfileModalOpen(true)}
                            className="min-w-0 pr-2 text-left hover:opacity-80 transition-opacity"
                        >
                            <div className="text-xs font-semibold text-zinc-200 truncate flex items-center gap-1.5">
                                <User className="w-3 h-3 text-zinc-400 shrink-0" />
                                <span className="truncate">{user?.name}</span>
                            </div>
                            <div className="text-[10px] font-mono text-zinc-500 truncate">
                                {getRoleLabel()}
                            </div>
                        </button>
                        <Tooltip content="Zakończ sesję">
                            <button
                                onClick={handleLogout}
                                aria-label="Zakończ sesję"
                                className="p-1.5 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-900 transition-colors"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                            </button>
                        </Tooltip>
                    </div>
                </div>
            </aside>

            <UserProfileModal
                isOpen={profileModalOpen}
                onClose={() => setProfileModalOpen(false)}
            />

            <CompanySwitcherModal
                isOpen={switcherModalOpen}
                onClose={() => setSwitcherModalOpen(false)}
            />
        </>
    );
};
