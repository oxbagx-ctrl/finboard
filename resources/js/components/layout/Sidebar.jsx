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
    ExternalLink
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Sidebar = ({ currentRoute, onRouteChange, isOpen, onClose }) => {
    const { user, activeCompany, isAdmin, logout } = useAuth();

    const navItems = [
        { id: 'dashboard', label: 'Executive Dashboard', code: 'DSH', icon: LayoutDashboard },
        { id: 'analytics', label: 'Analiza P&L i Wskaźniki', code: 'ANL', icon: TrendingUp },
        { id: 'records', label: 'Ewidencja Operacji', code: 'REC', icon: TableProperties },
        { id: 'import', label: 'Import Danych Finansowych', code: 'IMP', icon: FileSpreadsheet },
        { id: 'data-room', label: 'Virtual Data Room (VDR)', code: 'VDR', icon: FolderLock },
        { id: 'audit-logs', label: 'Dziennik Nadzoru & Audyt', code: 'AUD', icon: ShieldCheck },
    ];

    return (
        <>
            {isOpen && (
                <div
                    onClick={onClose}
                    className="fixed inset-0 z-40 bg-zinc-950/80 lg:hidden"
                />
            )}

            <aside
                className={`fixed top-0 left-0 bottom-0 z-50 w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
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

                {/* Target Company Box */}
                <div className="p-3 border-b border-zinc-850 bg-zinc-900/30">
                    <div className="p-2.5 rounded-md bg-zinc-900 border border-zinc-800">
                        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 uppercase mb-1">
                            <span>PODMIOT ANALIZOWANY</span>
                            <span className="text-zinc-400">{activeCompany?.code || 'N/A'}</span>
                        </div>
                        <div className="text-xs font-semibold text-zinc-200 truncate flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            <span className="truncate">{activeCompany?.name || 'Wybierz podmiot'}</span>
                        </div>
                    </div>
                </div>

                {/* Navigation Items */}
                <div className="px-3 pt-3 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
                    MODUŁY ANALITYCZNE
                </div>
                <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
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
                        <div className="min-w-0 pr-2">
                            <div className="text-xs font-semibold text-zinc-200 truncate">{user?.name}</div>
                            <div className="text-[10px] font-mono text-zinc-500 truncate">
                                {isAdmin ? 'ROLA: DORADCA M&A' : 'ROLA: KLIENT / CFO'}
                            </div>
                        </div>
                        <button
                            onClick={logout}
                            title="Zakończ sesję"
                            className="p-1.5 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-900 transition-colors"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
};
