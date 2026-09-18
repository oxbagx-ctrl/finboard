import React from 'react';
import { useDeal, CURRENCIES, FISCAL_YEARS, FISCAL_QUARTERS } from '../../context/DealContext';
import { Lock, Calendar, Coins, RotateCcw, ChevronDown } from 'lucide-react';

export const DealContextBar = () => {
    const {
        selectedYear,
        setSelectedYear,
        selectedQuarter,
        setSelectedQuarter,
        currency,
        setCurrency,
        dateRange,
        dealMetadata,
        resetFilters,
    } = useDeal();

    const isFiltered = selectedYear !== 'all' || selectedQuarter !== 'all' || currency !== 'PLN';

    return (
        <div className="w-full bg-zinc-950 border-b border-zinc-800/80 px-4 sm:px-6 py-2">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono">
                {/* Confidentiality and Project Code pill */}
                <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-900 border border-zinc-750 text-zinc-300">
                        <Lock className="w-3 h-3 text-amber-400" />
                        <span className="font-bold tracking-tight text-[11px] text-zinc-100">{dealMetadata.accessLevel}</span>
                    </div>

                    <div className="hidden sm:inline-flex items-center gap-1 text-[11px] text-zinc-400">
                        <span className="text-zinc-600">//</span>
                        <span className="font-semibold text-zinc-300">{dealMetadata.code}</span>
                        <span className="text-zinc-600">:</span>
                        <span className="text-zinc-400">{dealMetadata.phase}</span>
                    </div>
                </div>

                {/* Right controls: Fiscal Period & Reporting Currency */}
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Currency selector buttons */}
                    <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded p-0.5">
                        <Coins className="w-3 h-3 text-zinc-500 ml-1.5 mr-0.5" />
                        {CURRENCIES.map((c) => {
                            const isSelected = currency === c.code;
                            return (
                                <button
                                    key={c.code}
                                    onClick={() => setCurrency(c.code)}
                                    title={c.label}
                                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                                        isSelected
                                            ? 'bg-zinc-100 text-zinc-950 shadow-sm'
                                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                                    }`}
                                >
                                    {c.code}
                                </button>
                            );
                        })}
                    </div>

                    {/* Fiscal Year dropdown/buttons */}
                    <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded px-2 py-1">
                        <Calendar className="w-3 h-3 text-zinc-500 shrink-0" />
                        <span className="text-[10px] text-zinc-500 uppercase">ROK:</span>
                        <select
                            value={selectedYear}
                            onChange={(e) => {
                                setSelectedYear(e.target.value);
                                if (e.target.value === 'all') {
                                    setSelectedQuarter('all');
                                }
                            }}
                            className="bg-transparent text-[11px] font-semibold text-zinc-200 focus:outline-none cursor-pointer pr-1"
                        >
                            <option value="all" className="bg-zinc-900 text-zinc-200">HISTORIA (2025-2026)</option>
                            <option value="2026" className="bg-zinc-900 text-zinc-200">FY 2026</option>
                            <option value="2025" className="bg-zinc-900 text-zinc-200">FY 2025</option>
                        </select>
                    </div>

                    {/* Fiscal Quarter selector (only when year is selected) */}
                    {selectedYear !== 'all' && (
                        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1">
                            <span className="text-[10px] text-zinc-500 uppercase">KWARTAŁ:</span>
                            <select
                                value={selectedQuarter}
                                onChange={(e) => setSelectedQuarter(e.target.value)}
                                className="bg-transparent text-[11px] font-semibold text-zinc-200 focus:outline-none cursor-pointer pr-1"
                            >
                                {FISCAL_QUARTERS.map((q) => (
                                    <option key={q.id} value={q.id} className="bg-zinc-900 text-zinc-200">
                                        {q.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Reset button when filters are active */}
                    {isFiltered && (
                        <button
                            onClick={resetFilters}
                            title="Przywróć pełny zakres i walutę PLN"
                            className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-200 px-1.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors"
                        >
                            <RotateCcw className="w-3 h-3 text-zinc-400" />
                            <span>RESET</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
