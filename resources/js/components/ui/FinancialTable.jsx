import React, { useState } from 'react';
import { FinancialValue } from './FinancialValue';
import { PercentageBadge } from './PercentageBadge';
import { ChevronRight, ChevronDown } from 'lucide-react';

/**
 * Bloomberg/FactSet-style high-density financial data table.
 * Standardizes accounting hierarchy (groups, deductions, subtotals, final net bottom-line),
 * indentation guides, expandable category breakdowns, and PSR/MSR formatting.
 */
export const FinancialTable = ({
    title = 'Rachunek Zysków i Strat (P&L Breakdown)',
    subtitle,
    data = [],
    currency = 'PLN',
    revenueTotal = 0,
    className = '',
}) => {
    const [expandedGroups, setExpandedGroups] = useState({});

    const toggleGroup = (groupId) => {
        setExpandedGroups((prev) => ({
            ...prev,
            [groupId]: prev[groupId] === undefined ? false : !prev[groupId],
        }));
    };

    return (
        <div className={`bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-sm ${className}`}>
            {/* Table Header / Action Bar */}
            <div className="px-4 py-3 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-zinc-900/90">
                <div>
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-2">
                        <span className="w-2 h-2 bg-zinc-400 rounded-xs"></span>
                        {title}
                    </h3>
                    {subtitle && <p className="text-[11px] font-mono text-zinc-500 mt-0.5">{subtitle}</p>}
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-400">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800">WALUTA: {currency}</span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800">TRYB: KONSOLIDOWANY</span>
                </div>
            </div>

            {/* High Density Table Body */}
            <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                    <thead>
                        <tr className="bg-zinc-950/80 border-b border-zinc-800 text-[10px] text-zinc-500 uppercase tracking-wider">
                            <th className="py-2.5 px-4 font-semibold w-1/2">Pozycja Finansowa / Kategoria</th>
                            <th className="py-2.5 px-3 font-semibold text-right">Kwota ({currency})</th>
                            <th className="py-2.5 px-3 font-semibold text-right">% Przych.</th>
                            <th className="py-2.5 px-3 font-semibold text-right">Dynamika R/R</th>
                            <th className="py-2.5 px-4 font-semibold text-center w-28">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850">
                        {data.map((row) => {
                            const hasChildren = Array.isArray(row.children) && row.children.length > 0;
                            // A row is expandable only if it has more than 1 child.
                            // Groups with exactly 1 subcategory or no children do not need interactive expanding/collapsing.
                            const isExpandable = hasChildren && row.children.length > 1 && Boolean(row.isGroup);
                            const isExpanded = isExpandable && (expandedGroups[row.id] !== false);
                            const isFinalResult = Boolean(row.isFinalResult);
                            const isSummary = Boolean(row.isSummary) || isFinalResult;
                            const isSubItem = Boolean(row.isSubItem);
                            const isDeduction = Boolean(row.isDeduction);

                            // Calculate % of Revenue if total revenue is positive
                            const revShare = revenueTotal > 0 && row.amount != null && !isNaN(Number(row.amount))
                                ? (Number(row.amount) / revenueTotal) * 100
                                : null;

                            return (
                                <React.Fragment key={row.id}>
                                    <tr
                                        className={`transition-colors duration-100 ${
                                            isFinalResult
                                                ? 'bg-zinc-850/80 font-bold border-t-2 border-b-4 border-double border-zinc-600 text-zinc-100'
                                                : isSummary
                                                ? 'bg-zinc-850/40 font-bold border-t border-b border-zinc-750 text-zinc-100'
                                                : isExpandable
                                                ? 'bg-zinc-950/40 font-semibold cursor-pointer hover:bg-zinc-800/40 text-zinc-200'
                                                : row.isGroup
                                                ? 'bg-zinc-950/30 font-semibold text-zinc-200'
                                                : 'hover:bg-zinc-850/50 text-zinc-300'
                                        }`}
                                        onClick={isExpandable ? () => toggleGroup(row.id) : undefined}
                                    >
                                        <td className={`py-2 px-4 flex items-center gap-2 ${
                                            isSubItem ? 'pl-8 text-zinc-400' : 'text-zinc-200'
                                        }`}>
                                            {isExpandable ? (
                                                <span className="w-3.5 h-3.5 inline-flex items-center justify-center shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors">
                                                    {isExpanded ? (
                                                        <ChevronDown className="w-3.5 h-3.5" />
                                                    ) : (
                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                    )}
                                                </span>
                                            ) : isSubItem ? (
                                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 mr-1 shrink-0"></span>
                                            ) : (
                                                <span className="w-3.5 h-3.5 inline-flex shrink-0" aria-hidden="true" />
                                            )}
                                            <span className={isFinalResult ? 'text-zinc-100 font-bold text-[13px] tracking-tight' : isSummary ? 'text-zinc-100 tracking-tight' : ''}>
                                                {row.label}
                                            </span>
                                            {((isDeduction && !row.isGroup && !isSummary) || row.code) && (
                                                <span className="inline-flex items-center gap-1 shrink-0">
                                                    {isDeduction && !row.isGroup && !isSummary && (
                                                        <span
                                                            className="text-[10px] font-mono text-zinc-500 font-normal select-none"
                                                            title="Pozycja pomniejszająca wynik"
                                                        >
                                                            (-)
                                                        </span>
                                                    )}
                                                    {row.code && (
                                                        <span className="text-[10px] font-mono text-zinc-500 font-normal">
                                                            [{row.code}]
                                                        </span>
                                                    )}
                                                </span>
                                            )}
                                            {hasChildren && (
                                                <span className="ml-1 px-1.5 py-0.2 rounded text-[9px] font-mono bg-zinc-800/80 text-zinc-400 border border-zinc-700/60">
                                                    {row.children.length} {row.children.length === 1 ? 'poz.' : 'kat.'}
                                                </span>
                                            )}
                                        </td>

                                        <td className="py-2 px-3 text-right">
                                            <FinancialValue
                                                amount={row.amount}
                                                currency={currency}
                                                color={row.color || (isSummary ? 'auto' : 'neutral')}
                                                size={isFinalResult ? 'md' : isSummary ? 'md' : 'sm'}
                                            />
                                        </td>

                                        <td className="py-2 px-3 text-right text-zinc-400 tabular-nums">
                                            {revShare !== null ? `${revShare.toFixed(1)}%` : '—'}
                                        </td>

                                        <td className="py-2 px-3 text-right">
                                            <PercentageBadge
                                                value={row.change}
                                                reverse={row.reverseChange}
                                                decimals={1}
                                                fallback="—"
                                                title={row.title}
                                            />
                                        </td>

                                        <td className="py-2 px-4 text-center">
                                            <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-mono uppercase border ${
                                                isFinalResult
                                                    ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-400 font-semibold'
                                                    : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                                            }`}>
                                                {row.auditStatus || (isFinalResult ? 'WYNIK KOŃCOWY' : 'AUDYT: OK')}
                                            </span>
                                        </td>
                                    </tr>

                                    {/* Render Sub-items if group is expanded (or if single child group where no collapse is needed) */}
                                    {((isExpandable && isExpanded) || (hasChildren && !isExpandable)) && row.children.map((child) => {
                                        const childRevShare = revenueTotal > 0 && child.amount != null && !isNaN(Number(child.amount))
                                            ? (Number(child.amount) / revenueTotal) * 100
                                            : null;

                                        return (
                                            <tr key={child.id} className="hover:bg-zinc-850/40 bg-zinc-950/25 text-zinc-400 border-b border-zinc-850/60 transition-colors">
                                                <td className="py-1.5 px-4 pl-10 flex items-center gap-2 text-zinc-400">
                                                    <span className="text-zinc-600 font-mono select-none">↳</span>
                                                    <span className="truncate">{child.label}</span>
                                                    {child.code && (
                                                        <span className="text-[9px] text-zinc-500 font-mono">[{child.code}]</span>
                                                    )}
                                                </td>

                                                <td className="py-1.5 px-3 text-right">
                                                    <FinancialValue
                                                        amount={child.amount}
                                                        currency={currency}
                                                        size="sm"
                                                        color="neutral"
                                                    />
                                                </td>

                                                <td className="py-1.5 px-3 text-right text-zinc-500 text-[11px] tabular-nums">
                                                    {childRevShare !== null ? `${childRevShare.toFixed(1)}%` : '—'}
                                                </td>

                                                <td className="py-1.5 px-3 text-right">
                                                    <PercentageBadge
                                                        value={child.change}
                                                        reverse={child.reverseChange}
                                                        decimals={1}
                                                        fallback="—"
                                                        title={child.title}
                                                    />
                                                </td>

                                                <td className="py-1.5 px-4 text-center">
                                                    <span className="inline-block px-1.5 py-0.2 rounded text-[8px] font-mono uppercase bg-zinc-950/80 border border-zinc-850 text-zinc-500">
                                                        {child.auditStatus || 'ZWERYFIKOWANY'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Table Footer with Summary Note */}
            <div className="px-4 py-2 bg-zinc-950 border-t border-zinc-850 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px] font-mono text-zinc-500">
                <span>STANDARD: POLSKIE STANDARDY RACHUNKOWOŚCI (PSR) / MSR 1</span>
                <span>DOKŁADNOŚĆ: KALKULATOR DOMENOWY BCMATH (SCALE 4)</span>
            </div>
        </div>
    );
};
