import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    FileSpreadsheet,
    Download,
    ChevronDown,
    ChevronRight,
    Search,
    Maximize2,
    Minimize2,
    CheckCircle2,
    AlertTriangle,
    Calendar,
    Layers,
    Clock,
    RefreshCw,
    TrendingUp,
    Coins,
    Building2,
    ShieldCheck
} from 'lucide-react';
import { useInvestmentProject } from '../../context/InvestmentProjectContext';
import { getInvestmentWorkerClient } from '../../workers/InvestmentWorkerClient';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

export const ThreeStatementGrid = ({
    project = null,
    assumptions = null,
    overrides = null,
    initialGranularity = 'annual',
    initialStatement = 'pnl',
    className = ''
}) => {
    const { selectedProject: contextProject } = useInvestmentProject();
    const activeProject = project || contextProject;

    // View States
    const [statementType, setStatementType] = useState(initialStatement); // 'pnl' | 'balancesheet' | 'cashflow' | 'all'
    const [granularity, setGranularity] = useState(initialGranularity); // 'annual' | 'monthly'
    const [yearFilter, setYearFilter] = useState('all'); // 'all' or '1'..'15' for monthly
    const [scale, setScale] = useState('full'); // 'full' | 'thousands' | 'millions'
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedSections, setExpandedSections] = useState({
        revenue_breakdown: true,
        opex_breakdown: true,
        assets_breakdown: true,
        liabilities_breakdown: true,
        cf_breakdown: true,
    });

    // Simulation Data State
    const [simulationData, setSimulationData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [executionTimeMs, setExecutionTimeMs] = useState(null);

    // Fetch / Calculate Statements via Worker Client
    useEffect(() => {
        if (!activeProject) {
            setSimulationData(null);
            return;
        }

        let isMounted = true;
        setLoading(true);

        const client = getInvestmentWorkerClient();
        const activeAssumptions = assumptions || activeProject.operating_assumptions;

        client.simulate(activeProject, activeAssumptions, overrides, 15)
            .then((res) => {
                if (isMounted) {
                    setSimulationData(res);
                    setExecutionTimeMs(res.executionTimeMs || null);
                }
            })
            .catch((err) => {
                console.error('[ThreeStatementGrid] Simulation calculation failed:', err);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [activeProject, assumptions, overrides]);

    // Toggle Section Folding
    const toggleSection = (sectionKey) => {
        setExpandedSections((prev) => ({
            ...prev,
            [sectionKey]: !prev[sectionKey],
        }));
    };

    const expandAll = () => {
        setExpandedSections({
            revenue_breakdown: true,
            opex_breakdown: true,
            assets_breakdown: true,
            liabilities_breakdown: true,
            cf_breakdown: true,
        });
    };

    const collapseAll = () => {
        setExpandedSections({
            revenue_breakdown: false,
            opex_breakdown: false,
            assets_breakdown: false,
            liabilities_breakdown: false,
            cf_breakdown: false,
        });
    };

    // Columns Definition based on Granularity and Year Filter
    const columns = useMemo(() => {
        if (!simulationData) return [];

        if (granularity === 'annual') {
            return (simulationData.annualPeriods || []).map((p) => ({
                id: `Y${p.year}`,
                label: `Rok ${p.year}`,
                sublabel: `${(activeProject?.start_date ? new Date(activeProject.start_date).getFullYear() : 2026) + p.year - 1}`,
                data: p,
            }));
        }

        // Monthly Granularity
        let monthly = simulationData.monthlyPeriods || [];

        // If monthly periods were not returned, fallback to annualPeriods
        if (!monthly.length) {
            return (simulationData.annualPeriods || []).map((p) => ({
                id: `Y${p.year}`,
                label: `Rok ${p.year}`,
                sublabel: `${(activeProject?.start_date ? new Date(activeProject.start_date).getFullYear() : 2026) + p.year - 1}`,
                data: p,
            }));
        }

        if (yearFilter !== 'all') {
            const yNum = parseInt(yearFilter, 10);
            monthly = monthly.filter((m) => m.year === yNum);
        }

        return monthly.map((m) => ({
            id: `M${m.period}`,
            label: `M${m.period}`,
            sublabel: m.date || `M${m.monthInYear}`,
            data: m,
        }));
    }, [simulationData, granularity, yearFilter, activeProject]);

    // Number Formatting according to selected Scale and Currency
    const currency = activeProject?.currency || 'PLN';

    const formatValue = useCallback((val, isPercent = false, isRatio = false) => {
        if (val === null || val === undefined || isNaN(Number(val))) {
            return '—';
        }

        const num = Number(val);

        if (isPercent) {
            return `${num.toFixed(1)}%`;
        }

        if (isRatio) {
            return `${num.toFixed(2)}x`;
        }

        let scaled = num;
        let suffix = '';

        if (scale === 'thousands') {
            scaled = num / 1_000;
            suffix = '';
        } else if (scale === 'millions') {
            scaled = num / 1_000_000;
            suffix = '';
        }

        const formatted = new Intl.NumberFormat('pl-PL', {
            minimumFractionDigits: scale === 'full' ? 0 : 1,
            maximumFractionDigits: scale === 'full' ? 0 : 2,
        }).format(scaled);

        return formatted + suffix;
    }, [scale]);

    // Cumulative Balance Sheet Series Builder (with Strict Double-Entry Balance Check)
    const balanceSheetData = useMemo(() => {
        if (!columns.length) return [];

        let cumCapex = 0;
        let cumDepr = 0;
        let cumNetIncome = 0;
        const initialEquity = simulationData?.summary?.initialEquity ?? 0;

        return columns.map((col) => {
            const p = col.data;
            const capex = p.capex || 0;
            const depr = p.depreciation || 0;
            const netIncome = p.netIncome || 0;
            const cash = p.closingCash ?? 0;
            const debt = p.closingDebt ?? 0;

            let curCumCapex = 0;
            let curCumDepr = 0;
            let curCumNetIncome = 0;

            if (granularity === 'monthly' && simulationData?.monthlyPeriods?.length) {
                const upTo = simulationData.monthlyPeriods.slice(0, p.period);
                curCumCapex = upTo.reduce((s, m) => s + (m.capex || 0), 0);
                curCumDepr = upTo.reduce((s, m) => s + (m.depreciation || 0), 0);
                curCumNetIncome = upTo.reduce((s, m) => s + (m.netIncome || 0), 0);
            } else {
                cumCapex += capex;
                cumDepr += depr;
                cumNetIncome += netIncome;
                curCumCapex = cumCapex;
                curCumDepr = cumDepr;
                curCumNetIncome = cumNetIncome;
            }

            const netPpe = Math.max(0, curCumCapex - curCumDepr);

            const receivables = granularity === 'monthly' ? (p.receivables ?? 0) : (p.closingReceivables ?? 0);
            const inventory = granularity === 'monthly' ? (p.inventory ?? 0) : (p.closingInventory ?? 0);
            const payables = granularity === 'monthly' ? (p.payables ?? 0) : (p.closingPayables ?? 0);

            const totalCurrentAssets = receivables + inventory + cash;
            const totalAssets = netPpe + totalCurrentAssets;

            const totalEquity = initialEquity + curCumNetIncome;
            const totalLiabilitiesAndEquity = totalEquity + debt + payables;
            const delta = totalAssets - totalLiabilitiesAndEquity;

            return {
                netPpe,
                grossPpe: curCumCapex,
                accumulatedDepreciation: curCumDepr,
                receivables,
                inventory,
                cash,
                totalCurrentAssets,
                totalAssets,
                initialEquity,
                retainedEarnings: curCumNetIncome,
                totalEquity,
                debt,
                payables,
                totalLiabilitiesAndEquity,
                delta,
                isBalanced: Math.abs(delta) < 1.0,
            };
        });
    }, [columns, simulationData, activeProject, granularity]);

    // Check overall balance sheet integrity
    const isModelGloballyBalanced = useMemo(() => {
        if (!balanceSheetData.length) return true;
        return balanceSheetData.every((b) => b.isBalanced);
    }, [balanceSheetData]);

    // Export Table Data to CSV
    const exportToCsv = () => {
        if (!columns.length) return;

        const periodHeaders = columns.map((c) => `"${c.label} (${c.sublabel})"`).join(';');
        const csvRows = [`"Pozycja Finansowa / Okres";${periodHeaders}`];

        // Helper to push row
        const pushRow = (title, getter) => {
            const vals = columns.map((c, idx) => {
                const v = getter(c.data, idx);
                return typeof v === 'number' ? v.toFixed(2) : `"${v}"`;
            }).join(';');
            csvRows.push(`"${title}";${vals}`);
        };

        // RZiS
        csvRows.push('"--- RACHUNEK ZYSKÓW I STRAT (P&L) ---"');
        pushRow('Przychody ze Sprzedaży', (p) => p.revenue);
        pushRow('Koszty Zmienne OPEX', (p) => p.variableCosts);
        pushRow('Koszty Stałe OPEX', (p) => p.fixedCosts);
        pushRow('Fundusz Płac & Wynagrodzenia', (p) => p.payrollCosts);
        pushRow('Łączne Koszty Operacyjne OPEX', (p) => p.totalOpex);
        pushRow('EBITDA', (p) => p.ebitda);
        pushRow('Amortyzacja Środków Trwałych KŚT', (p) => p.depreciation);
        pushRow('EBIT (Zysk Operacyjny)', (p) => p.ebit);
        pushRow('Koszty Finansowe (Odsetki)', (p) => p.interestExpense);
        pushRow('EBT (Zysk Brutto)', (p) => p.ebt);
        pushRow('Podatek Dochodowy CIT', (p) => p.cit);
        pushRow('Wynik Finansowy Netto', (p) => p.netIncome);

        // Bilans
        csvRows.push('"--- BILANS (BALANCE SHEET) ---"');
        pushRow('Rzeczowe Aktywa Trwałe Netto (Net PPE)', (p, idx) => balanceSheetData[idx]?.netPpe);
        pushRow('Należności Handlowe (Receivables)', (p, idx) => balanceSheetData[idx]?.receivables);
        pushRow('Zapasy (Inventory)', (p, idx) => balanceSheetData[idx]?.inventory);
        pushRow('Środki Pieniężne i Ekwiwalenty', (p, idx) => balanceSheetData[idx]?.cash);
        pushRow('SUMA AKTYWÓW', (p, idx) => balanceSheetData[idx]?.totalAssets);
        pushRow('Kapitał Własny (Equity)', (p, idx) => balanceSheetData[idx]?.totalEquity);
        pushRow('Zadłużenie Kredytowe (Senior Debt)', (p, idx) => balanceSheetData[idx]?.debt);
        pushRow('Zobowiązania Handlowe (Payables)', (p, idx) => balanceSheetData[idx]?.payables);
        pushRow('SUMA PASYWÓW', (p, idx) => balanceSheetData[idx]?.totalLiabilitiesAndEquity);
        pushRow('Test Zbilansowania (Zero Variance Delta)', (p, idx) => balanceSheetData[idx]?.delta);

        // Cash Flow
        csvRows.push('"--- RACHUNEK PRZEPŁYWÓW PIENIĘŻNYCH (CASH FLOW) ---"');
        pushRow('Przepływy z Działalności Operacyjnej (OCF)', (p) => p.operatingCashFlow);
        pushRow('Przepływy z Działalności Inwestycyjnej (ICF / CAPEX)', (p) => p.investingCashFlow);
        pushRow('Przepływy z Działalności Finansowej (FCF / Kredyt)', (p) => p.financingCashFlow);
        pushRow('Przepływ Pieniężny Netto (Net Cash Flow)', (p) => p.netCashFlow);
        pushRow('Stan Gotówki na Koniec Okresu (Closing Cash)', (p) => p.closingCash);
        pushRow('Free Cash Flow to Firm (FCFF)', (p) => p.fcff);
        pushRow('Free Cash Flow to Equity (FCFE)', (p) => p.fcfe);
        pushRow('Wskaźnik Pokrycia Obsługi Długu (DSCR)', (p) => p.dscr ?? '—');

        const csvContent = '\uFEFF' + csvRows.join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute(
            'download',
            `finboard-three-statement-${activeProject?.name ? activeProject.name.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'project'}-${granularity}.csv`
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Filter check helper
    const matchesSearch = (text) => {
        if (!searchQuery.trim()) return true;
        return text.toLowerCase().includes(searchQuery.toLowerCase().trim());
    };

    if (!activeProject) {
        return (
            <Card
                title="15-letni Model Finansowy & Trójstronne Sprawozdania (3-Statement)"
                subtitle="RZiS, Bilans i Cash Flow w pełnej integracji matematycznej"
            >
                <div className="py-12 text-center font-mono">
                    <FileSpreadsheet className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                    <p className="font-semibold text-zinc-300 uppercase tracking-wide">
                        Brak Wybranego Projektu Inwestycyjnego
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-1">
                        Wybierz projekt z selektora powyżej, aby wygenerować 15-letnie sprawozdania finansowe.
                    </p>
                </div>
            </Card>
        );
    }

    return (
        <div className={`space-y-4 font-mono ${className}`}>
            {/* Top Toolbar: Statement Type Tabs, Granularity, Scale & Actions */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 sm:p-4 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                {/* Statement Type Segmented Control */}
                <div className="flex flex-wrap items-center gap-1.5 bg-zinc-950 p-1.5 rounded-lg border border-zinc-800">
                    <button
                        type="button"
                        onClick={() => setStatementType('pnl')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-all cursor-pointer ${
                            statementType === 'pnl'
                                ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-xs font-bold'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
                        }`}
                    >
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        <span>RZiS (P&L)</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setStatementType('balancesheet')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-all cursor-pointer ${
                            statementType === 'balancesheet'
                                ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-xs font-bold'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
                        }`}
                    >
                        <Building2 className="w-3.5 h-3.5 text-blue-400" />
                        <span>Bilans</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setStatementType('cashflow')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-all cursor-pointer ${
                            statementType === 'cashflow'
                                ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-xs font-bold'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
                        }`}
                    >
                        <Coins className="w-3.5 h-3.5 text-amber-400" />
                        <span>Cash Flow</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setStatementType('all')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-all cursor-pointer ${
                            statementType === 'all'
                                ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-xs font-bold'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
                        }`}
                    >
                        <Layers className="w-3.5 h-3.5 text-purple-400" />
                        <span>Wszystkie (Zbiorczy)</span>
                    </button>
                </div>

                {/* Granularity & Secondary Controls */}
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
                    {/* Time Granularity Toggle */}
                    <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                        <button
                            type="button"
                            onClick={() => setGranularity('annual')}
                            className={`px-2.5 py-1 text-xs rounded transition-all cursor-pointer ${
                                granularity === 'annual'
                                    ? 'bg-zinc-800 text-zinc-100 font-bold'
                                    : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            15 Lat (Rocznie)
                        </button>
                        <button
                            type="button"
                            onClick={() => setGranularity('monthly')}
                            className={`px-2.5 py-1 text-xs rounded transition-all cursor-pointer ${
                                granularity === 'monthly'
                                    ? 'bg-zinc-800 text-zinc-100 font-bold'
                                    : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            180 M (Miesięcznie)
                        </button>
                    </div>

                    {/* Scale Selector */}
                    <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs">
                        <span className="text-[10px] text-zinc-500 uppercase px-1">Skala:</span>
                        <button
                            type="button"
                            onClick={() => setScale('full')}
                            className={`px-2 py-0.5 rounded text-[11px] ${scale === 'full' ? 'bg-zinc-800 text-zinc-100 font-bold' : 'text-zinc-400 hover:text-zinc-200'}`}
                        >
                            PLN
                        </button>
                        <button
                            type="button"
                            onClick={() => setScale('thousands')}
                            className={`px-2 py-0.5 rounded text-[11px] ${scale === 'thousands' ? 'bg-zinc-800 text-zinc-100 font-bold' : 'text-zinc-400 hover:text-zinc-200'}`}
                        >
                            tys.
                        </button>
                        <button
                            type="button"
                            onClick={() => setScale('millions')}
                            className={`px-2 py-0.5 rounded text-[11px] ${scale === 'millions' ? 'bg-zinc-800 text-zinc-100 font-bold' : 'text-zinc-400 hover:text-zinc-200'}`}
                        >
                            mln
                        </button>
                    </div>

                    {/* CSV Export Button */}
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={exportToCsv}
                        className="gap-1.5 text-xs shrink-0"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span>Eksportuj CSV</span>
                    </Button>
                </div>
            </div>

            {/* Sub-bar: Search, Folding Controls & Zero-Variance Verification */}
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-lg p-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                {/* Search Bar */}
                <div className="relative w-full md:w-64">
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Szukaj pozycji w sprawozdaniu..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
                    />
                </div>

                {/* Monthly Year Filter (if monthly granularity active) */}
                {granularity === 'monthly' && (
                    <div className="flex items-center gap-1.5 text-xs bg-zinc-950 px-2 py-1 rounded border border-zinc-800">
                        <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="text-[10px] text-zinc-500 uppercase">Filtr roku:</span>
                        <select
                            value={yearFilter}
                            onChange={(e) => setYearFilter(e.target.value)}
                            aria-label="Wybierz rok do wyświetlenia"
                            className="bg-transparent text-xs text-zinc-200 font-semibold focus:outline-none cursor-pointer"
                        >
                            <option value="all" className="bg-zinc-900 text-zinc-200">Wszystkie 15 lat (180M)</option>
                            {Array.from({ length: 15 }, (_, i) => i + 1).map((y) => (
                                <option key={y} value={y.toString()} className="bg-zinc-900 text-zinc-200">
                                    Rok {y} (M{(y - 1) * 12 + 1} - M{y * 12})
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Folding Controls & Balance Integrity Badge */}
                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={expandAll}
                            className="text-[11px] text-zinc-400 hover:text-zinc-200 underline"
                        >
                            Rozwiń wszystko
                        </button>
                        <span className="text-zinc-600">/</span>
                        <button
                            type="button"
                            onClick={collapseAll}
                            className="text-[11px] text-zinc-400 hover:text-zinc-200 underline"
                        >
                            Zwiń wszystko
                        </button>
                    </div>

                    {/* Zero-Variance Balance Indicator */}
                    <div
                        data-testid="balance-integrity-badge"
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-semibold ${
                            isModelGloballyBalanced
                                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                                : 'bg-rose-950/40 text-rose-300 border-rose-800/60'
                        }`}
                        title="Zasada podwójnego zapisu: Aktywa = Pasywa (Zero Variance)"
                    >
                        {isModelGloballyBalanced ? (
                            <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>BILANS: ZERO VARIANCE (Δ = 0,00)</span>
                            </>
                        ) : (
                            <>
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                                <span>ODCHYLENIE BILANSU (Δ ≠ 0)</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Interactive 3-Statement Grid Table Container */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-sm">
                <div className="overflow-x-auto max-h-[750px] relative scrollbar-thin scrollbar-thumb-zinc-700">
                    <table className="w-full text-left border-collapse text-xs">
                        {/* Table Header with Frozen Columns */}
                        <thead className="bg-zinc-950 sticky top-0 z-20 border-b border-zinc-800 text-[11px]">
                            <tr>
                                <th className="py-2.5 px-4 sticky left-0 z-30 bg-zinc-950 min-w-[280px] text-zinc-400 font-bold uppercase tracking-wider border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.4)]">
                                    Pozycja Sprawozdania ({currency})
                                </th>
                                {columns.map((col) => (
                                    <th
                                        key={col.id}
                                        className="py-2.5 px-3 min-w-[110px] text-right font-bold text-zinc-300 border-r border-zinc-850"
                                    >
                                        <div className="font-mono text-zinc-200">{col.label}</div>
                                        <div className="text-[10px] text-zinc-500 font-normal font-sans">{col.sublabel}</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-zinc-850 font-mono text-zinc-300">
                            {/* ========================================================================= */}
                            {/* 1. RACHUNEK ZYSKÓW I STRAT (P&L)                                         */}
                            {/* ========================================================================= */}
                            {(statementType === 'pnl' || statementType === 'all') && (
                                <>
                                    <tr className="bg-zinc-950/80 font-bold text-zinc-200">
                                        <td
                                            colSpan={columns.length + 1}
                                            className="py-2 px-4 text-xs uppercase tracking-wider text-emerald-400 border-t border-b border-zinc-800"
                                        >
                                            1. Rachunek Zysków i Strat (Income Statement / P&L)
                                        </td>
                                    </tr>

                                    {/* Przychody ze Sprzedaży */}
                                    {matchesSearch('Przychody ze Sprzedaży') && (
                                        <tr className="bg-zinc-900/40 hover:bg-zinc-850/50">
                                            <td className="py-2 px-4 sticky left-0 z-10 bg-zinc-900 font-semibold text-zinc-100 flex items-center justify-between border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                                <span>Przychody ze Sprzedaży</span>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSection('revenue_breakdown')}
                                                    className="p-1 hover:text-zinc-100 text-zinc-400"
                                                >
                                                    {expandedSections.revenue_breakdown ? (
                                                        <ChevronDown className="w-3.5 h-3.5" />
                                                    ) : (
                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                    )}
                                                </button>
                                            </td>
                                            {columns.map((c) => (
                                                <td key={c.id} className="py-2 px-3 text-right text-emerald-400 font-semibold border-r border-zinc-850">
                                                    {formatValue(c.data.revenue)}
                                                </td>
                                            ))}
                                        </tr>
                                    )}

                                    {/* Expanded: Revenue Details */}
                                    {expandedSections.revenue_breakdown && matchesSearch('Przychody ze Sprzedaży') && (
                                        <tr className="text-zinc-400 bg-zinc-950/20 text-[11px]">
                                            <td className="py-1.5 px-4 pl-8 sticky left-0 z-10 bg-zinc-950/80 border-r border-zinc-800 italic">
                                                ↳ Sprzedaż Podstawowa (Nominal Capacity)
                                            </td>
                                            {columns.map((c) => (
                                                <td key={c.id} className="py-1.5 px-3 text-right border-r border-zinc-850 text-zinc-400">
                                                    {formatValue(c.data.revenue)}
                                                </td>
                                            ))}
                                        </tr>
                                    )}

                                    {/* Koszty Operacyjne (OPEX) */}
                                    {matchesSearch('Koszty Operacyjne') && (
                                        <tr className="bg-zinc-900/30 hover:bg-zinc-850/50">
                                            <td className="py-2 px-4 sticky left-0 z-10 bg-zinc-900 font-medium text-zinc-200 flex items-center justify-between border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                                <span>(-) Koszty Operacyjne (OPEX)</span>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSection('opex_breakdown')}
                                                    className="p-1 hover:text-zinc-100 text-zinc-400"
                                                >
                                                    {expandedSections.opex_breakdown ? (
                                                        <ChevronDown className="w-3.5 h-3.5" />
                                                    ) : (
                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                    )}
                                                </button>
                                            </td>
                                            {columns.map((c) => (
                                                <td key={c.id} className="py-2 px-3 text-right text-zinc-300 border-r border-zinc-850">
                                                    {formatValue(-c.data.totalOpex)}
                                                </td>
                                            ))}
                                        </tr>
                                    )}

                                    {/* Expanded OPEX Details */}
                                    {expandedSections.opex_breakdown && (
                                        <>
                                            {matchesSearch('Koszty Zmienne') && (
                                                <tr className="text-zinc-400 bg-zinc-950/20 text-[11px]">
                                                    <td className="py-1.5 px-4 pl-8 sticky left-0 z-10 bg-zinc-950/80 border-r border-zinc-800">
                                                        ↳ Koszty Zmienne (Media, Surowce, Prowizje)
                                                    </td>
                                                    {columns.map((c) => (
                                                        <td key={c.id} className="py-1.5 px-3 text-right border-r border-zinc-850 text-zinc-400">
                                                            {formatValue(-c.data.variableCosts)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            )}
                                            {matchesSearch('Koszty Stałe') && (
                                                <tr className="text-zinc-400 bg-zinc-950/20 text-[11px]">
                                                    <td className="py-1.5 px-4 pl-8 sticky left-0 z-10 bg-zinc-950/80 border-r border-zinc-800">
                                                        ↳ Koszty Stałe OPEX (Serwis, Najem, Ubezpieczenia)
                                                    </td>
                                                    {columns.map((c) => (
                                                        <td key={c.id} className="py-1.5 px-3 text-right border-r border-zinc-850 text-zinc-400">
                                                            {formatValue(-c.data.fixedCosts)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            )}
                                            {matchesSearch('Fundusz Płac') && (
                                                <tr className="text-zinc-400 bg-zinc-950/20 text-[11px]">
                                                    <td className="py-1.5 px-4 pl-8 sticky left-0 z-10 bg-zinc-950/80 border-r border-zinc-800">
                                                        ↳ Fundusz Płac & Wynagrodzenia (Payroll)
                                                    </td>
                                                    {columns.map((c) => (
                                                        <td key={c.id} className="py-1.5 px-3 text-right border-r border-zinc-850 text-zinc-400">
                                                            {formatValue(-c.data.payrollCosts)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            )}
                                        </>
                                    )}

                                    {/* EBITDA */}
                                    {matchesSearch('EBITDA') && (
                                        <tr className="bg-emerald-950/30 font-bold border-t border-b border-emerald-900/50">
                                            <td className="py-2.5 px-4 sticky left-0 z-10 bg-emerald-950/90 text-emerald-300 uppercase border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.4)]">
                                                EBITDA (Zysk Operacyjny Gotówkowy)
                                            </td>
                                            {columns.map((c) => (
                                                <td key={c.id} className="py-2.5 px-3 text-right text-emerald-300 font-bold border-r border-zinc-850">
                                                    {formatValue(c.data.ebitda)}
                                                </td>
                                            ))}
                                        </tr>
                                    )}

                                    {/* Marża EBITDA % */}
                                    {matchesSearch('Marża EBITDA') && (
                                        <tr className="text-[11px] text-zinc-400 bg-zinc-900/20">
                                            <td className="py-1 px-4 sticky left-0 z-10 bg-zinc-950/80 border-r border-zinc-800 italic">
                                                % Marża EBITDA
                                            </td>
                                            {columns.map((c) => (
                                                <td key={c.id} className="py-1 px-3 text-right text-emerald-400/90 border-r border-zinc-850">
                                                    {formatValue(c.data.ebitdaMarginPercent ?? (c.data.revenue > 0 ? (c.data.ebitda / c.data.revenue) * 100 : 0), true)}
                                                </td>
                                            ))}
                                        </tr>
                                    )}

                                    {/* Amortyzacja KŚT */}
                                    {matchesSearch('Amortyzacja') && (
                                        <tr className="hover:bg-zinc-850/50">
                                            <td className="py-2 px-4 sticky left-0 z-10 bg-zinc-900 text-zinc-300 border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                                (-) Amortyzacja Środków Trwałych KŚT
                                            </td>
                                            {columns.map((c) => (
                                                <td key={c.id} className="py-2 px-3 text-right text-zinc-400 border-r border-zinc-850">
                                                    {formatValue(-c.data.depreciation)}
                                                </td>
                                            ))}
                                        </tr>
                                    )}

                                    {/* EBIT */}
                                    {matchesSearch('EBIT') && (
                                        <tr className="bg-zinc-950/50 font-bold border-t border-zinc-800">
                                            <td className="py-2 px-4 sticky left-0 z-10 bg-zinc-950 text-zinc-100 uppercase border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                                EBIT (Zysk Operacyjny)
                                            </td>
                                            {columns.map((c) => (
                                                <td key={c.id} className="py-2 px-3 text-right text-zinc-100 font-semibold border-r border-zinc-850">
                                                    {formatValue(c.data.ebit)}
                                                </td>
                                            ))}
                                        </tr>
                                    )}

                                    {/* Odsetki i Koszty Finansowe */}
                                    {matchesSearch('Koszty Finansowe') && (
                                        <tr className="hover:bg-zinc-850/50">
                                            <td className="py-2 px-4 sticky left-0 z-10 bg-zinc-900 text-zinc-300 border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                                (-) Koszty Finansowe (Odsetki od Kredytu)
                                            </td>
                                            {columns.map((c) => (
                                                <td key={c.id} className="py-2 px-3 text-right text-rose-400/90 border-r border-zinc-850">
                                                    {formatValue(-c.data.interestExpense)}
                                                </td>
                                            ))}
                                        </tr>
                                    )}

                                    {/* EBT */}
                                    {matchesSearch('EBT') && (
                                        <tr className="bg-zinc-950/30 font-semibold border-t border-zinc-800">
                                            <td className="py-2 px-4 sticky left-0 z-10 bg-zinc-950 text-zinc-200 border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                                EBT (Zysk Brutto)
                                            </td>
                                            {columns.map((c) => (
                                                <td key={c.id} className="py-2 px-3 text-right text-zinc-200 border-r border-zinc-850">
                                                    {formatValue(c.data.ebt)}
                                                </td>
                                            ))}
                                        </tr>
                                    )}

                                    {/* Podatek CIT */}
                                    {matchesSearch('Podatek CIT') && (
                                        <tr className="hover:bg-zinc-850/50">
                                            <td className="py-2 px-4 sticky left-0 z-10 bg-zinc-900 text-zinc-400 border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                                (-) Podatek Dochodowy CIT (Tarcza Strat)
                                            </td>
                                            {columns.map((c) => (
                                                <td key={c.id} className="py-2 px-3 text-right text-rose-400/80 border-r border-zinc-850">
                                                    {formatValue(-c.data.cit)}
                                                </td>
                                            ))}
                                        </tr>
                                    )}

                                    {/* Zysk Netto */}
                                    {matchesSearch('Zysk Netto') && (
                                        <tr className="bg-blue-950/30 font-bold border-t-2 border-b-2 border-blue-900/60">
                                            <td className="py-2.5 px-4 sticky left-0 z-10 bg-blue-950/90 text-blue-200 uppercase tracking-wide border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.4)]">
                                                Wynik Finansowy Netto (Zysk Netto)
                                            </td>
                                            {columns.map((c) => (
                                                <td key={c.id} className="py-2.5 px-3 text-right text-blue-200 font-bold border-r border-zinc-850">
                                                    {formatValue(c.data.netIncome)}
                                                </td>
                                            ))}
                                        </tr>
                                    )}

                                    {/* Marża Netto % */}
                                    {matchesSearch('Marża Netto') && (
                                        <tr className="text-[11px] text-zinc-400 bg-zinc-900/20">
                                            <td className="py-1 px-4 sticky left-0 z-10 bg-zinc-950/80 border-r border-zinc-800 italic">
                                                % Marża Netto
                                            </td>
                                            {columns.map((c) => (
                                                <td key={c.id} className="py-1 px-3 text-right text-blue-400/90 border-r border-zinc-850">
                                                    {formatValue(c.data.netMarginPercent ?? (c.data.revenue > 0 ? (c.data.netIncome / c.data.revenue) * 100 : 0), true)}
                                                </td>
                                            ))}
                                        </tr>
                                    )}
                                </>
                            )}

                            {/* ========================================================================= */}
                            {/* 2. BILANS (BALANCE SHEET)                                                */}
                            {/* ========================================================================= */}
                            {(statementType === 'balancesheet' || statementType === 'all') && (
                                <>
                                    <tr className="bg-zinc-950/80 font-bold text-zinc-200">
                                        <td
                                            colSpan={columns.length + 1}
                                            className="py-2 px-4 text-xs uppercase tracking-wider text-blue-400 border-t border-b border-zinc-800"
                                        >
                                            2. Bilans (Balance Sheet - Aktywa & Pasywa)
                                        </td>
                                    </tr>

                                    {/* AKTYWA TRWAŁE */}
                                    {matchesSearch('Aktywa Trwałe') && (
                                        <tr className="bg-zinc-900/40 hover:bg-zinc-850/50">
                                            <td className="py-2 px-4 sticky left-0 z-10 bg-zinc-900 font-semibold text-zinc-200 flex items-center justify-between border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                                <span>Rzeczowe Aktywa Trwałe Netto (Net PPE)</span>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSection('assets_breakdown')}
                                                    className="p-1 hover:text-zinc-100 text-zinc-400"
                                                >
                                                    {expandedSections.assets_breakdown ? (
                                                        <ChevronDown className="w-3.5 h-3.5" />
                                                    ) : (
                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                    )}
                                                </button>
                                            </td>
                                            {columns.map((c, idx) => (
                                                <td key={c.id} className="py-2 px-3 text-right text-zinc-200 border-r border-zinc-850">
                                                    {formatValue(balanceSheetData[idx]?.netPpe)}
                                                </td>
                                            ))}
                                        </tr>
                                    )}

                                    {/* PPE Breakdown */}
                                    {expandedSections.assets_breakdown && (
                                        <>
                                            {matchesSearch('Wartość Brutto KŚT') && (
                                                <tr className="text-zinc-400 bg-zinc-950/20 text-[11px]">
                                                    <td className="py-1.5 px-4 pl-8 sticky left-0 z-10 bg-zinc-950/80 border-r border-zinc-800">
                                                        ↳ Wartość Początkowa KŚT (Gross PPE)
                                                    </td>
                                                    {columns.map((c, idx) => (
                                                        <td key={c.id} className="py-1.5 px-3 text-right border-r border-zinc-850 text-zinc-400">
                                                            {formatValue(balanceSheetData[idx]?.grossPpe)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            )}
                                            {matchesSearch('Skumulowane Umorzenie') && (
                                                <tr className="text-zinc-400 bg-zinc-950/20 text-[11px]">
                                                    <td className="py-1.5 px-4 pl-8 sticky left-0 z-10 bg-zinc-950/80 border-r border-zinc-800">
                                                        ↳ (-) Skumulowane Odpisy Umorzeniowe KŚT
                                                    </td>
                                                    {columns.map((c, idx) => (
                                                        <td key={c.id} className="py-1.5 px-3 text-right border-r border-zinc-850 text-zinc-400">
                                                            {formatValue(-balanceSheetData[idx]?.accumulatedDepreciation)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            )}
                                        </>
                                    )}

                                    {/* Aktywa Obrotowe */}
                                    {matchesSearch('Należności Handlowe') && (
                                        <tr className="hover:bg-zinc-850/50">
                                            <td className="py-2 px-4 sticky left-0 z-10 bg-zinc-900 text-zinc-300 border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                                Należności Handlowe (DSO)
                                            </td>
                                            {columns.map((c, idx) => (
                                                <td key={c.id} className="py-2 px-3 text-right text-zinc-300 border-r border-zinc-850">
                                                    {formatValue(balanceSheetData[idx]?.receivables)}
                                                </td>
                                            ))}
                                        </tr>
                                    )}

                                    {matchesSearch('Zapasy') && (
                                        <tr className="hover:bg-zinc-850/50">
                                            <td className="py-2 px-4 sticky left-0 z-10 bg-zinc-900 text-zinc-300 border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                                Zapasy Operacyjne (DIO)
                                            </td>
                                            {columns.map((c, idx) => (
                                                <td key={c.id} className="py-2 px-3 text-right text-zinc-300 border-r border-zinc-850">
                                                    {formatValue(balanceSheetData[idx]?.inventory)}
                                                </td>
                                            ))}
                                        </tr>
                                    )}

                                    {matchesSearch('Środki Pieniężne') && (
                                        <tr className="hover:bg-zinc-850/50 bg-emerald-950/10">
                                            <td className="py-2 px-4 sticky left-0 z-10 bg-zinc-900 text-emerald-300 font-semibold border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                                Środki Pieniężne na Koniec Okresu (Cash)
                                            </td>
                                            {columns.map((c, idx) => (
                                                <td key={c.id} className="py-2 px-3 text-right text-emerald-300 font-semibold border-r border-zinc-850">
                                                    {formatValue(balanceSheetData[idx]?.cash)}
                                                </td>
                                            ))}
                                        </tr>
                                    )}

                                    {/* SUMA AKTYWÓW */}
                                    {matchesSearch('SUMA AKTYWÓW') && (
                                        <tr className="bg-zinc-950 font-bold border-t-2 border-b-2 border-zinc-700">
                                            <td className="py-2.5 px-4 sticky left-0 z-10 bg-zinc-950 text-zinc-100 uppercase tracking-wide border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.4)]">
                                                SUMA AKTYWÓW (TOTAL ASSETS)
                                            </td>
                                            {columns.map((c, idx) => (
                                                <td key={c.id} className="py-2.5 px-3 text-right text-zinc-100 font-bold border-r border-zinc-850">
                                                    {formatValue(balanceSheetData[idx]?.totalAssets)}
                                                </td>
                                            ))}
                                        </tr>
                                    )}

                                    {/* KAPITAŁ WŁASNY */}
                                    {matchesSearch('Kapitał Własny') && (
                                        <tr className="bg-zinc-900/40 hover:bg-zinc-850/50">
                                            <td className="py-2 px-4 sticky left-0 z-10 bg-zinc-900 font-semibold text-zinc-200 flex items-center justify-between border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                                <span>Kapitał Własny (Total Equity)</span>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSection('liabilities_breakdown')}
                                                    className="p-1 hover:text-zinc-100 text-zinc-400"
                                                >
                                                    {expandedSections.liabilities_breakdown ? (
                                                        <ChevronDown className="w-3.5 h-3.5" />
                                                    ) : (
                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                    )}
                                                </button>
                                            </td>
                                            {columns.map((c, idx) => (
                                                <td key={c.id} className="py-2 px-3 text-right text-purple-300 font-semibold border-r border-zinc-850">
                                                    {formatValue(balanceSheetData[idx]?.totalEquity)}
                                                </td>
                                            ))}
                                        </tr>
                                    )}

                                    {/* Equity Breakdown */}
                                    {expandedSections.liabilities_breakdown && (
                                        <>
                                            {matchesSearch('Wkład Własny') && (
                                                <tr className="text-zinc-400 bg-zinc-950/20 text-[11px]">
                                                    <td className="py-1.5 px-4 pl-8 sticky left-0 z-10 bg-zinc-950/80 border-r border-zinc-800">
                                                        ↳ Kapitał Początkowy Inwestorów
                                                    </td>
                                                    {columns.map((c, idx) => (
                                                        <td key={c.id} className="py-1.5 px-3 text-right border-r border-zinc-850 text-zinc-400">
                                                            {formatValue(balanceSheetData[idx]?.initialEquity)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            )}
                                            {matchesSearch('Zyski Zatrzymane') && (
                                                <tr className="text-zinc-400 bg-zinc-950/20 text-[11px]">
                                                    <td className="py-1.5 px-4 pl-8 sticky left-0 z-10 bg-zinc-950/80 border-r border-zinc-800">
                                                        ↳ Zyski Zatrzymane (Skumulowany Wynik Netto)
                                                    </td>
                                                    {columns.map((c, idx) => (
                                                        <td key={c.id} className="py-1.5 px-3 text-right border-r border-zinc-850 text-zinc-400">
                                                            {formatValue(balanceSheetData[idx]?.retainedEarnings)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            )}
                                        </>
                                    )}

                                    {/* Zobowiązania Długoterminowe (Senior Debt) */}
                                    {matchesSearch('Kredyt Bankowy') && (
                                        <tr className="hover:bg-zinc-850/50">
                                            <td className="py-2 px-4 sticky left-0 z-10 bg-zinc-900 text-zinc-300 border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                                Zadłużenie Kredytowe (Senior Debt Closing)
                                            </td>
                                            {columns.map((c, idx) => (
                                                <td key={c.id} className="py-2 px-3 text-right text-rose-400/90 border-r border-zinc-850">
                                                    {formatValue(balanceSheetData[idx]?.debt)}
                                                </td>
                                            ))}
                                        </tr>
                                    )}

                                    {/* Zobowiązania Bieżące (Payables) */}
                                    {matchesSearch('Zobowiązania Handlowe') && (
                                        <tr className="hover:bg-zinc-850/50">
                                            <td className="py-2 px-4 sticky left-0 z-10 bg-zinc-900 text-zinc-300 border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                                Zobowiązania Handlowe (DPO)
                                            </td>
                                            {columns.map((c, idx) => (
                                                <td key={c.id} className="py-2 px-3 text-right text-zinc-300 border-r border-zinc-850">
                                                    {formatValue(balanceSheetData[idx]?.payables)}
                                                </td>
                                            ))}
                                        </tr>
                                    )}

                                    {/* SUMA PASYWÓW */}
                                    {matchesSearch('SUMA PASYWÓW') && (
                                        <tr className="bg-zinc-950 font-bold border-t-2 border-b-2 border-zinc-700">
                                            <td className="py-2.5 px-4 sticky left-0 z-10 bg-zinc-950 text-zinc-100 uppercase tracking-wide border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.4)]">
                                                SUMA PASYWÓW (TOTAL LIABILITIES & EQUITY)
                                            </td>
                                            {columns.map((c, idx) => (
                                                <td key={c.id} className="py-2.5 px-3 text-right text-zinc-100 font-bold border-r border-zinc-850">
                                                    {formatValue(balanceSheetData[idx]?.totalLiabilitiesAndEquity)}
                                                </td>
                                            ))}
                                        </tr>
                                    )}

                                    {/* TEST ZBILANSOWANIA (ZERO VARIANCE DELTA) */}
                                    <tr className="bg-emerald-950/20 font-bold border-b border-zinc-800">
                                        <td className="py-2 px-4 sticky left-0 z-10 bg-emerald-950/80 text-emerald-400 uppercase text-[11px] border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.4)]">
                                            Test Zbilansowania (Zero Variance: Aktywa - Pasywa)
                                        </td>
                                        {columns.map((c, idx) => (
                                            <td
                                                key={c.id}
                                                className={`py-2 px-3 text-right font-bold text-[11px] border-r border-zinc-850 ${
                                                    balanceSheetData[idx]?.isBalanced ? 'text-emerald-400' : 'text-rose-400 animate-pulse'
                                                }`}
                                            >
                                                {formatValue(balanceSheetData[idx]?.delta)}
                                            </td>
                                        ))}
                                    </tr>
                                </>
                            )}

                            {/* ========================================================================= */}
                            {/* 3. RACHUNEK PRZEPŁYWÓW PIENIĘŻNYCH (CASH FLOW)                           */}
                            {/* ========================================================================= */}
                            {(statementType === 'cashflow' || statementType === 'all') && (
                                <>
                                    <tr className="bg-zinc-950/80 font-bold text-zinc-200">
                                        <td
                                            colSpan={columns.length + 1}
                                            className="py-2 px-4 text-xs uppercase tracking-wider text-amber-400 border-t border-b border-zinc-800"
                                        >
                                            3. Rachunek Przepływów Pieniężnych (Cash Flow Statement)
                                        </td>
                                    </tr>

                                    {/* Działalność Operacyjna */}
                                    {matchesSearch('Przepływy Operacyjne') && (
                                        <tr className="bg-zinc-900/40 hover:bg-zinc-850/50 font-semibold">
                                            <td className="py-2 px-4 sticky left-0 z-10 bg-zinc-900 text-zinc-100 flex items-center justify-between border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                                <span>Przepływy z Działalności Operacyjnej (OCF)</span>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSection('cf_breakdown')}
                                                    className="p-1 hover:text-zinc-100 text-zinc-400"
                                                >
                                                    {expandedSections.cf_breakdown ? (
                                                        <ChevronDown className="w-3.5 h-3.5" />
                                                    ) : (
                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                    )}
                                                </button>
                                            </td>
                                            {columns.map((c) => (
                                                <td key={c.id} className="py-2 px-3 text-right text-emerald-400 font-semibold border-r border-zinc-850">
                                                    {formatValue(c.data.operatingCashFlow)}
                                                </td>
                                            ))}
                                        </tr>
                                    )}

                                    {/* OCF Details */}
                                    {expandedSections.cf_breakdown && (
                                        <>
                                            {matchesSearch('Zysk Netto OCF') && (
                                                <tr className="text-zinc-400 bg-zinc-950/20 text-[11px]">
                                                    <td className="py-1.5 px-4 pl-8 sticky left-0 z-10 bg-zinc-950/80 border-r border-zinc-800">
                                                        ↳ Wynik Finansowy Netto
                                                    </td>
                                                    {columns.map((c) => (
                                                        <td key={c.id} className="py-1.5 px-3 text-right border-r border-zinc-850 text-zinc-400">
                                                            {formatValue(c.data.netIncome)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            )}
                                            {matchesSearch('Korekta o Amortyzację') && (
                                                <tr className="text-zinc-400 bg-zinc-950/20 text-[11px]">
                                                    <td className="py-1.5 px-4 pl-8 sticky left-0 z-10 bg-zinc-950/80 border-r border-zinc-800">
                                                        ↳ (+) Amortyzacja Środków Trwałych
                                                    </td>
                                                    {columns.map((c) => (
                                                        <td key={c.id} className="py-1.5 px-3 text-right border-r border-zinc-850 text-zinc-400">
                                                            {formatValue(c.data.depreciation)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            )}
                                            {matchesSearch('Zmiana NWC') && (
                                                <tr className="text-zinc-400 bg-zinc-950/20 text-[11px]">
                                                    <td className="py-1.5 px-4 pl-8 sticky left-0 z-10 bg-zinc-950/80 border-r border-zinc-800">
                                                        ↳ (+/-) Zmiana Kapitału Obrotowego Netto (ΔNWC)
                                                    </td>
                                                    {columns.map((c) => (
                                                        <td key={c.id} className="py-1.5 px-3 text-right border-r border-zinc-850 text-zinc-400">
                                                            {formatValue(c.data.changeInNwc)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            )}
                                        </>
                                    )}

                                    {/* Działalność Inwestycyjna */}
                                    {matchesSearch('Przepływy Inwestycyjne') && (
                                        <tr className="hover:bg-zinc-850/50">
                                            <td className="py-2 px-4 sticky left-0 z-10 bg-zinc-900 font-semibold text-zinc-200 border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                                Przepływy z Działalności Inwestycyjnej (ICF / CAPEX)
                                            </td>
                                            {columns.map((c) => (
                                                <td key={c.id} className="py-2 px-3 text-right text-rose-400/90 font-semibold border-r border-zinc-850">
                                                    {formatValue(c.data.investingCashFlow)}
                                                </td>
                                            ))}
                                        </tr>
                                    )}

                                    {/* Działalność Finansowa */}
                                    {matchesSearch('Przepływy Finansowe') && (
                                        <tr className="hover:bg-zinc-850/50">
                                            <td className="py-2 px-4 sticky left-0 z-10 bg-zinc-900 font-semibold text-zinc-200 border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                                Przepływy z Działalności Finansowej (FCF / Kredyt)
                                            </td>
                                            {columns.map((c) => (
                                                <td key={c.id} className="py-2 px-3 text-right text-purple-300 font-semibold border-r border-zinc-850">
                                                    {formatValue(c.data.financingCashFlow)}
                                                </td>
                                            ))}
                                        </tr>
                                    )}

                                    {/* PRZEPŁYW PIENIĘŻNY NETTO */}
                                    {matchesSearch('Przepływ Pieniężny Netto') && (
                                        <tr className="bg-amber-950/30 font-bold border-t border-b border-amber-900/50">
                                            <td className="py-2.5 px-4 sticky left-0 z-10 bg-amber-950/90 text-amber-300 uppercase border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.4)]">
                                                Przepływ Pieniężny Netto (Net Cash Flow)
                                            </td>
                                            {columns.map((c) => (
                                                <td key={c.id} className="py-2.5 px-3 text-right text-amber-300 font-bold border-r border-zinc-850">
                                                    {formatValue(c.data.netCashFlow)}
                                                </td>
                                            ))}
                                        </tr>
                                    )}

                                    {/* Stan Gotówki Zamykający */}
                                    {matchesSearch('Stan Gotówki') && (
                                        <tr className="bg-zinc-950 font-bold border-b border-zinc-800">
                                            <td className="py-2 px-4 sticky left-0 z-10 bg-zinc-950 text-emerald-400 border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                                Środki Pieniężne na Koniec Okresu (Closing Cash)
                                            </td>
                                            {columns.map((c) => (
                                                <td key={c.id} className="py-2 px-3 text-right text-emerald-400 font-bold border-r border-zinc-850">
                                                    {formatValue(c.data.closingCash)}
                                                </td>
                                            ))}
                                        </tr>
                                    )}

                                    {/* Metryki Wyceny: FCFF i FCFE */}
                                    {matchesSearch('Free Cash Flow to Firm') && (
                                        <tr className="hover:bg-zinc-850/50 text-[11px] bg-zinc-900/30">
                                            <td className="py-1.5 px-4 sticky left-0 z-10 bg-zinc-950 text-cyan-300 font-semibold border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                                Free Cash Flow to Firm (FCFF - Wycena Projektu)
                                            </td>
                                            {columns.map((c) => (
                                                <td key={c.id} className="py-1.5 px-3 text-right text-cyan-300 font-semibold border-r border-zinc-850">
                                                    {formatValue(c.data.fcff)}
                                                </td>
                                            ))}
                                        </tr>
                                    )}

                                    {matchesSearch('Free Cash Flow to Equity') && (
                                        <tr className="hover:bg-zinc-850/50 text-[11px] bg-zinc-900/30">
                                            <td className="py-1.5 px-4 sticky left-0 z-10 bg-zinc-950 text-purple-300 font-semibold border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                                Free Cash Flow to Equity (FCFE - Wycena Udziałowców)
                                            </td>
                                            {columns.map((c) => (
                                                <td key={c.id} className="py-1.5 px-3 text-right text-purple-300 font-semibold border-r border-zinc-850">
                                                    {formatValue(c.data.fcfe)}
                                                </td>
                                            ))}
                                        </tr>
                                    )}

                                    {matchesSearch('DSCR') && (
                                        <tr className="hover:bg-zinc-850/50 text-[11px] bg-zinc-900/40 border-b border-zinc-800">
                                            <td className="py-1.5 px-4 sticky left-0 z-10 bg-zinc-950 text-zinc-300 font-semibold border-r border-zinc-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                                Kowenant DSCR (Wskaźnik Obsługi Długu)
                                            </td>
                                            {columns.map((c) => {
                                                const d = c.data.dscr;
                                                const isRisk = d !== null && d !== undefined && d < 1.20;
                                                return (
                                                    <td
                                                        key={c.id}
                                                        className={`py-1.5 px-3 text-right font-bold border-r border-zinc-850 ${
                                                            d === null || d === undefined
                                                                ? 'text-zinc-600'
                                                                : isRisk
                                                                ? 'text-amber-400'
                                                                : 'text-emerald-400'
                                                        }`}
                                                    >
                                                        {d ? `${d.toFixed(2)}x` : '—'}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    )}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Table Footer Telemetry Strip */}
                <div className="bg-zinc-950 border-t border-zinc-800 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] text-zinc-400 font-mono">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            Kolumny: <strong className="text-zinc-200">{columns.length}</strong>
                        </span>
                        <span className="text-zinc-700">|</span>
                        <span>
                            Waluta: <strong className="text-zinc-200">{currency}</strong>
                        </span>
                        <span className="text-zinc-700">|</span>
                        <span>
                            Prezentacja: <strong className="text-zinc-200">{granularity === 'annual' ? 'Roczna (15L)' : 'Miesięczna (180M)'}</strong>
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {executionTimeMs !== null && (
                            <span className="text-zinc-500">
                                Czas kompilacji modelu: <strong className="text-zinc-300">{executionTimeMs} ms</strong>
                            </span>
                        )}
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400">
                            STANDARD IFRS / PROJECT FINANCE
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
