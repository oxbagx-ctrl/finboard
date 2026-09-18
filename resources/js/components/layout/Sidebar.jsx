import React from 'react';
import {
    LayoutDashboard,
    TrendingUp,
    TableProperties,
    FileSpreadsheet,
    FolderLock,
    ShieldCheck,
    Building2,
    LogOut,
    ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Sidebar = ({ currentRoute, onRouteChange, isOpen, onClose }) => {
    const { user, activeCompany, isAdmin, logout } = useAuth();

    const navItems = [
        { id: 'dashboard', label: 'Dashboard Główny', icon: LayoutDashboard },
        { id: 'analytics', label: 'Analityka i Trendy', icon: TrendingUp },
        { id: 'records', label: 'Transakcje Finansowe', icon: TableProperties },
        { id: 'import', label: 'Import Danych CSV', icon: FileSpreadsheet },
        { id: 'data-room', label: 'Wirtualny Pokój Danych', icon: FolderLock },
        { id: 'audit-logs', label: 'Dziennik Audytowy', icon: ShieldCheck },
    ];

    return (
        <>
            {isOpen && (
                <div
                    onClick={onClose}
                    className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
                />
            )}

            <aside
                className={`fixed top-0 left-0 bottom-0 z-50 w-72 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                {/* Logo & Brand */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-brand-600/30">
                            F
                        </div>
                        <div>
                            <div className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                                FinBoard
                                <span className="text-[10px] uppercase font-semibold bg-brand-500/20 text-brand-300 px-1.5 py-0.5 rounded border border-brand-500/30">
                                    SaaS
                                </span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-medium">Deal Advisory Platform</div>
                        </div>
                    </div>
                </div>

                {/* Active Company info pill */}
                <div className="px-4 py-3 border-b border-slate-800/60 bg-slate-900/50">
                    <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-slate-300">
                            <Building2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-slate-200 truncate">
                                {activeCompany?.name || 'Wybierz podmiot'}
                            </div>
                            <div className="text-[10px] text-slate-400">
                                {isAdmin ? 'Kontekst doradcy M&A' : 'Klient dedykowany'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentRoute === item.id;

                        return (
                            <button
                                key={item.id}
                                onClick={() => {
                                    onRouteChange(item.id);
                                    if (onClose) onClose();
                                }}
                                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                                    isActive
                                        ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/25 border border-brand-500/40'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 border border-transparent'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon
                                        className={`w-4 h-4 ${
                                            isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                                        }`}
                                    />
                                    <span>{item.label}</span>
                                </div>
                                {isActive && <ChevronRight className="w-4 h-4 text-brand-200" />}
                            </button>
                        );
                    })}
                </nav>

                {/* User footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-900/60">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center font-bold text-xs text-brand-300">
                                {user?.name ? user.name.slice(0, 2).toUpperCase() : 'U'}
                            </div>
                            <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-200 truncate">{user?.name}</div>
                                <div className="text-[11px] text-slate-400 truncate">{user?.email}</div>
                            </div>
                        </div>
                        <button
                            onClick={logout}
                            title="Wyloguj się"
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
};
