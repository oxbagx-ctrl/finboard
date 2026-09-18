import React from 'react';
import { Menu, Building2, Shield, RefreshCw, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/Badge';

export const Header = ({ currentRoute, onToggleSidebar, onRefreshData, refreshing = false }) => {
    const { user, activeCompany, isAdmin, switchCompany } = useAuth();

    const titles = {
        'dashboard': 'Pulpit Zarządczy (Executive Overview)',
        'analytics': 'Analityka P&L, Marże i Wskaźniki Płynności',
        'records': 'Księga Transakcji Finansowych',
        'import': 'Moduł Importu Wyciągów i Zbiorów CSV',
        'data-room': 'Virtual Data Room (VDR) – Dokumentacja Transakcyjna',
        'audit-logs': 'Rejestr Nadzoru i Ścieżka Audytowa',
    };

    const demoCompanies = [
        { id: 'c0000000-0000-0000-0000-000000000002', name: 'Acme Manufacturing S.A.', code: 'ACME' },
        { id: 'c0000000-0000-0000-0000-000000000001', name: 'Helvest Advisory Sp. z o.o.', code: 'HELVEST' },
    ];

    return (
        <header className="h-14 bg-zinc-950 border-b border-zinc-800 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
                <button
                    onClick={onToggleSidebar}
                    className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 lg:hidden"
                >
                    <Menu className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                    <h1 className="text-xs sm:text-sm font-semibold text-zinc-100 uppercase tracking-wide font-mono">
                        {titles[currentRoute] || 'FinBoard'}
                    </h1>
                </div>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3">
                {/* Confidentiality indicator */}
                <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400">
                    <Lock className="w-3 h-3 text-amber-500" />
                    <span>STRICTLY CONFIDENTIAL</span>
                </div>

                {/* Refresh button */}
                {onRefreshData && (
                    <button
                        onClick={onRefreshData}
                        disabled={refreshing}
                        title="Odśwież dane z serwera"
                        className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-zinc-200' : ''}`} />
                    </button>
                )}

                {/* Tenant Switcher for Advisor */}
                {isAdmin ? (
                    <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-750 rounded px-2 py-1">
                        <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <select
                            value={activeCompany?.id || ''}
                            onChange={(e) => {
                                const selected = demoCompanies.find(c => c.id === e.target.value);
                                if (selected) switchCompany(selected);
                            }}
                            className="bg-transparent text-xs font-medium text-zinc-200 focus:outline-none cursor-pointer pr-1"
                        >
                            {demoCompanies.map(comp => (
                                <option key={comp.id} value={comp.id} className="bg-zinc-900 text-zinc-200">
                                    {comp.code} – {comp.name}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <div className="hidden sm:flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1">
                        <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="text-xs font-medium text-zinc-300 font-mono">{activeCompany?.name}</span>
                    </div>
                )}

                {/* Role badge */}
                <Badge variant={isAdmin ? 'default' : 'brand'} size="sm">
                    {isAdmin ? 'ADMIN' : 'CLIENT'}
                </Badge>
            </div>
        </header>
    );
};
