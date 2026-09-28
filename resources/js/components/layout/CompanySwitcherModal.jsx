import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { Badge } from '../ui/Badge';
import {
    X,
    Building2,
    Search,
    Check,
    Briefcase,
    Shield,
    ArrowRight
} from 'lucide-react';

export const CompanySwitcherModal = ({ isOpen, onClose }) => {
    const { availableCompanies, activeCompany, switchCompany } = useAuth();
    const { success } = useNotification();
    const [searchQuery, setSearchQuery] = useState('');

    if (!isOpen) return null;

    const filteredCompanies = (availableCompanies || []).filter((comp) => {
        const query = searchQuery.toLowerCase();
        return (
            comp.name.toLowerCase().includes(query) ||
            comp.code.toLowerCase().includes(query) ||
            (comp.tax_id && comp.tax_id.toLowerCase().includes(query))
        );
    });

    const handleSelectCompany = (comp) => {
        switchCompany(comp);
        success(`Przełączono kontekst analityczny na: ${comp.name}`);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 dark:bg-zinc-950/80 backdrop-blur-xs font-mono">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-750 rounded-lg shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="px-5 py-3.5 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-750 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                            <Building2 className="w-3.5 h-3.5" />
                        </div>
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                                Wybór Podmiotu Transakcyjnego
                            </h2>
                            <p className="text-[10px] text-zinc-500">PORTFEL SPÓŁEK POD NADZOREM DORADCY</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40">
                    <div className="relative">
                        <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            autoFocus
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Szukaj po nazwie spółki, kodzie lub NIP..."
                            className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-750 rounded pl-9 pr-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                        />
                    </div>
                </div>

                {/* Company List */}
                <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/80 p-2">
                    {filteredCompanies.length === 0 ? (
                        <div className="py-8 text-center text-xs text-zinc-500">
                            Brak podmiotów spełniających kryteria wyszukiwania.
                        </div>
                    ) : (
                        filteredCompanies.map((comp) => {
                            const isActive = activeCompany?.id === comp.id;

                            return (
                                <button
                                    key={comp.id}
                                    onClick={() => handleSelectCompany(comp)}
                                    className={`w-full text-left p-3 rounded-md transition-all flex items-center justify-between group ${
                                        isActive
                                            ? 'bg-zinc-100/90 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700'
                                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-850/60 border border-transparent'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-xs shrink-0 ${
                                            isActive
                                                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                                                : 'bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 group-hover:border-zinc-300 dark:group-hover:border-zinc-700 group-hover:text-zinc-900 dark:group-hover:text-zinc-200'
                                        }`}>
                                            {comp.code}
                                        </div>

                                        <div className="min-w-0">
                                            <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 truncate">
                                                <span className="truncate">{comp.name}</span>
                                                {isActive && (
                                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400 font-semibold">
                                                        AKTYWNA
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-zinc-500 flex items-center gap-2 mt-0.5 font-mono">
                                                <span>NIP: {comp.tax_id || 'PL0000000000'}</span>
                                                <span>•</span>
                                                <span>ID: {comp.id.substring(0, 8)}...</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="shrink-0 ml-2">
                                        {isActive ? (
                                            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                        ) : (
                                            <ArrowRight className="w-4 h-4 text-zinc-400 dark:text-zinc-600 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all" />
                                        )}
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span>PODMIOTÓW W REJESTRZE: {filteredCompanies.length}</span>
                    <span>IZOLACJA MULTI-TENANT: STRICT</span>
                </div>
            </div>
        </div>
    );
};
