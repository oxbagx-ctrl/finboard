import React from 'react';
import { Menu, Building2, Shield, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/Badge';

export const Header = ({ currentRoute, onToggleSidebar, onRefreshData, refreshing = false }) => {
    const { user, activeCompany, isAdmin, switchCompany } = useAuth();

    const titles = {
        'dashboard': 'Dashboard Główny FinBoard',
        'analytics': 'Zaawansowana Analityka Finansowa & Wskaźniki',
        'records': 'Transakcje i Rekordy Finansowe',
        'import': 'Asynchroniczny Import Danych CSV',
        'data-room': 'Wirtualny Pokój Danych (VDR)',
        'audit-logs': 'Dziennik Audytowy Dokumentów',
    };

    const demoCompanies = [
        { id: 'c0000000-0000-0000-0000-000000000002', name: 'Acme Manufacturing S.A.', code: 'ACME' },
        { id: 'c0000000-0000-0000-0000-000000000001', name: 'Helvest Advisory Sp. z o.o.', code: 'HELVEST' },
    ];

    return (
        <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
                <button
                    onClick={onToggleSidebar}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 lg:hidden"
                >
                    <Menu className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
                        {titles[currentRoute] || 'FinBoard'}
                    </h1>
                </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
                {/* Refresh button */}
                {onRefreshData && (
                    <button
                        onClick={onRefreshData}
                        disabled={refreshing}
                        title="Odśwież dane"
                        className="p-2 rounded-xl text-slate-400 hover:text-brand-400 hover:bg-slate-800/80 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-brand-400' : ''}`} />
                    </button>
                )}

                {/* Tenant Switcher for Admin */}
                {isAdmin ? (
                    <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 rounded-xl px-2.5 py-1.5 shadow-sm">
                        <Building2 className="w-4 h-4 text-brand-400 shrink-0" />
                        <select
                            value={activeCompany?.id || ''}
                            onChange={(e) => {
                                const selected = demoCompanies.find(c => c.id === e.target.value);
                                if (selected) switchCompany(selected);
                            }}
                            className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer pr-1"
                        >
                            {demoCompanies.map(comp => (
                                <option key={comp.id} value={comp.id} className="bg-slate-800 text-slate-200">
                                    {comp.name}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <div className="hidden sm:flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-1.5">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-medium text-slate-300">{activeCompany?.name}</span>
                    </div>
                )}

                {/* Role Badge */}
                <Badge variant={isAdmin ? 'brand' : 'purple'} size="sm" className="hidden md:inline-flex">
                    <Shield className="w-3 h-3 mr-1" />
                    {isAdmin ? 'Doradca M&A' : 'Klient CFO'}
                </Badge>
            </div>
        </header>
    );
};
