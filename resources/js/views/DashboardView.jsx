import React, { useEffect, useState, useMemo, useCallback } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useDeal } from '../context/DealContext';
import { useNotification } from '../context/NotificationContext';
import { MetricCard } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { FinancialTable } from '../components/ui/FinancialTable';
import { FinancialMultiplesStrip } from '../components/ui/FinancialMultiplesStrip';
import { AuditTrailSnippet } from '../components/ui/AuditTrailSnippet';
import { BenchmarkConfigModal } from '../components/benchmarks/BenchmarkConfigModal';
import { PnlTrendChart } from '../components/charts/PnlTrendChart';
import { CostBreakdownChart } from '../components/charts/CostBreakdownChart';
import { LiquidityTrendChart } from '../components/charts/LiquidityTrendChart';
import {
    DollarSign,
    TrendingUp,
    PieChart,
    ShieldAlert,
    Building2,
    Calendar,
    Coins,
    Cpu,
    BarChart3,
    Activity,
    Sliders
} from 'lucide-react';

export const DashboardView = () => {
    const { activeCompany, isAdmin, isAdvisor } = useAuth();
    const { dateRange, currency, convertAmount } = useDeal();
    const { error } = useNotification();

    const [metrics, setMetrics] = useState(null);
    const [trends, setTrends] = useState([]);
    const [expenseBreakdown, setExpenseBreakdown] = useState([]);
    const [revenueBreakdown, setRevenueBreakdown] = useState([]);
    const [liquidityTrends, setLiquidityTrends] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [chartMode, setChartMode] = useState('pnl'); // 'pnl' | 'liquidity'
    const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (dateRange?.startDate) params.start_date = dateRange.startDate;
            if (dateRange?.endDate) params.end_date = dateRange.endDate;

            const [metricsRes, trendsRes, expensesRes, revenuesRes, liquidityRes, auditRes] = await Promise.all([
                apiClient.get('/finance/analytics/metrics', { params }).catch(() => ({ data: { data: null } })),
                apiClient.get('/finance/analytics/trends', { params }).catch(() => ({ data: { data: [] } })),
                apiClient.get('/finance/analytics/breakdown', { params: { ...params, record_type: 'EXPENSE', category_type: 'OPEX' } }).catch(() => ({ data: { data: [] } })),
                apiClient.get('/finance/analytics/breakdown', { params: { ...params, record_type: 'REVENUE' } }).catch(() => ({ data: { data: [] } })),
                apiClient.get('/finance/analytics/liquidity', { params }).catch(() => ({ data: { data: [] } })),
                apiClient.get('/finance/audit-logs', { params: { per_page: 5 } }).catch(() => ({ data: { data: [] } })),
            ]);

            setMetrics(metricsRes.data?.data || null);
            setTrends(trendsRes.data?.data || []);
            setExpenseBreakdown(expensesRes.data?.data || []);
            setRevenueBreakdown(revenuesRes.data?.data || []);
            setLiquidityTrends(liquidityRes.data?.data || []);
            setAuditLogs(auditRes.data?.data || []);
        } catch (err) {
            error('Nie udało się pobrać danych analitycznych z serwera.');
        } finally {
            setLoading(false);
        }
    }, [activeCompany?.id, dateRange?.startDate, dateRange?.endDate, error]);

    useEffect(() => {
        fetchData();

        const handleCompanyChange = () => fetchData();
        const handleBenchmarksUpdated = () => fetchData();

        window.addEventListener('finboard:company-changed', handleCompanyChange);
        window.addEventListener('finboard:benchmarks-updated', handleBenchmarksUpdated);

        return () => {
            window.removeEventListener('finboard:company-changed', handleCompanyChange);
            window.removeEventListener('finboard:benchmarks-updated', handleBenchmarksUpdated);
        };
    }, [fetchData]);

    const rawRevenue = Number(metrics?.pnl?.revenue?.amount || 0);
    const rawCogs = Number(metrics?.pnl?.cogs?.amount || 0);
    const rawGrossProfit = Number(metrics?.pnl?.gross_profit?.amount || (rawRevenue - rawCogs));
    const rawEbitda = Number(metrics?.pnl?.ebitda?.amount || 0);
    const rawEbit = Number(metrics?.pnl?.ebit?.amount || 0);
    const rawDa = Number(metrics?.pnl?.depreciation?.amount || (rawEbitda > rawEbit ? rawEbitda - rawEbit : 0));
    const rawTax = Number(metrics?.pnl?.tax?.amount || 0);
    const rawNetProfit = Number(metrics?.pnl?.net_profit?.amount || 0);
    const rawOpex = Number(metrics?.pnl?.opex?.amount || 0);

    // Converted amounts based on active currency
    const revenueVal = convertAmount(rawRevenue);
    const cogsVal = convertAmount(rawCogs);
    const grossProfitVal = convertAmount(rawGrossProfit);
    const opexVal = convertAmount(rawOpex);
    const ebitdaVal = convertAmount(rawEbitda);
    const daVal = convertAmount(rawDa);
    const ebitVal = convertAmount(rawEbit);
    const taxVal = convertAmount(rawTax);
    const netProfitVal = convertAmount(rawNetProfit);

    // Dynamic Unified Ratios, Liquidity & Margins from API / Benchmarks
    const ratios = metrics?.ratios || {};

    const currentRatio = ratios?.current_ratio != null
        ? Number(ratios.current_ratio)
        : (metrics?.liquidity?.current_ratio != null
            ? Number(metrics.liquidity.current_ratio)
            : (metrics?.benchmarks?.current_ratio?.actual_value != null
                ? Number(metrics.benchmarks.current_ratio.actual_value)
                : (metrics?.benchmarks?.current_ratio?.current_value != null
                    ? Number(metrics.benchmarks.current_ratio.current_value)
                    : 0)));

    const quickRatio = ratios?.quick_ratio != null
        ? Number(ratios.quick_ratio)
        : (metrics?.liquidity?.quick_ratio != null
            ? Number(metrics.liquidity.quick_ratio)
            : (metrics?.benchmarks?.quick_ratio?.actual_value != null
                ? Number(metrics.benchmarks.quick_ratio.actual_value)
                : (metrics?.benchmarks?.quick_ratio?.current_value != null
                    ? Number(metrics.benchmarks.quick_ratio.current_value)
                    : 0)));

    const debtRatio = ratios?.debt_to_assets != null
        ? Number(ratios.debt_to_assets)
        : (metrics?.solvency?.debt_to_assets != null
            ? Number(metrics.solvency.debt_to_assets)
            : (metrics?.benchmarks?.debt_to_assets?.actual_value != null
                ? Number(metrics.benchmarks.debt_to_assets.actual_value)
                : (metrics?.benchmarks?.debt_to_assets?.current_value != null
                    ? Number(metrics.benchmarks.debt_to_assets.current_value)
                    : 0)));

    const ebitdaMargin = ratios?.ebitda_margin != null
        ? Number(ratios.ebitda_margin)
        : (metrics?.pnl?.ebitda_margin_pct != null
            ? Number(metrics.pnl.ebitda_margin_pct) / 100
            : (metrics?.pnl?.ebitda_margin != null
                ? Number(metrics.pnl.ebitda_margin)
                : (rawRevenue > 0 ? rawEbitda / rawRevenue : 0)));

    const operatingMargin = ratios?.operating_margin != null
        ? Number(ratios.operating_margin)
        : (metrics?.pnl?.operating_margin_pct != null
            ? Number(metrics.pnl.operating_margin_pct) / 100
            : (metrics?.pnl?.operating_margin != null
                ? Number(metrics.pnl.operating_margin)
                : (rawRevenue > 0 ? rawEbit / rawRevenue : 0)));

    const grossMargin = ratios?.gross_margin != null
        ? Number(ratios.gross_margin)
        : (metrics?.pnl?.gross_margin_pct != null
            ? Number(metrics.pnl.gross_margin_pct) / 100
            : (metrics?.pnl?.gross_margin != null
                ? Number(metrics.pnl.gross_margin)
                : (rawRevenue > 0 ? rawGrossProfit / rawRevenue : 0)));

    const netMargin = ratios?.net_margin != null
        ? Number(ratios.net_margin)
        : (metrics?.pnl?.net_margin_pct != null
            ? Number(metrics.pnl.net_margin_pct) / 100
            : (metrics?.pnl?.net_margin != null
                ? Number(metrics.pnl.net_margin)
                : (rawRevenue > 0 ? rawNetProfit / rawRevenue : 0)));

    // Dynamic YoY / MoM changes from API
    const dynamics = metrics?.dynamics || {};
    const yoyRevenueGrowth = dynamics?.yoy?.revenue_growth_pct != null ? Number(dynamics.yoy.revenue_growth_pct) : null;
    const yoyEbitdaGrowth = dynamics?.yoy?.ebitda_growth_pct != null ? Number(dynamics.yoy.ebitda_growth_pct) : null;
    const yoyEbitGrowth = dynamics?.yoy?.ebit_growth_pct != null ? Number(dynamics.yoy.ebit_growth_pct) : null;
    const yoyNetProfitGrowth = dynamics?.yoy?.net_profit_growth_pct != null ? Number(dynamics.yoy.net_profit_growth_pct) : null;
    const yoyOpexGrowth = dynamics?.yoy?.opex_growth_pct != null ? Number(dynamics.yoy.opex_growth_pct) : null;
    const yoyGrossProfitGrowth = dynamics?.yoy?.gross_profit_growth_pct != null ? Number(dynamics.yoy.gross_profit_growth_pct) : null;
    const yoyCurrentRatioDiff = dynamics?.yoy?.current_ratio_diff != null ? Number(dynamics.yoy.current_ratio_diff) : null;

    // Converted Trends Data for Charts
    const convertedTrends = useMemo(() => {
        return trends.map((item) => ({
            ...item,
            revenue: convertAmount(item.revenue || 0),
            opex: convertAmount(item.opex || 0),
            ebitda: convertAmount(item.ebitda || 0),
            net_profit: convertAmount(item.net_profit || 0),
        }));
    }, [trends, convertAmount]);

    // Converted Breakdown Data for Charts
    const convertedBreakdown = useMemo(() => {
        return expenseBreakdown.map((item) => ({
            ...item,
            amount: convertAmount(item.amount || 0),
        }));
    }, [expenseBreakdown, convertAmount]);

    // Structured P&L Table Rows
    const pnlRows = useMemo(() => {
        const revenueChildren = revenueBreakdown.length > 0
            ? revenueBreakdown.map((rev, i) => ({
                id: rev.category_id || `rev_${i}`,
                label: rev.category_name,
                code: rev.category_code || `REV-0${i + 1}`,
                amount: convertAmount(rev.amount),
                change: null,
            }))
            : [];

        const expenseChildren = expenseBreakdown.length > 0
            ? expenseBreakdown.map((exp, i) => ({
                id: exp.category_id || `opex_${i}`,
                label: exp.category_name,
                code: exp.category_code || `OPEX-0${i + 1}`,
                amount: convertAmount(exp.amount),
                change: null,
                reverseChange: true,
            }))
            : [];

        return [
            {
                id: 'revenue_group',
                label: '1. Przychody ze Sprzedaży (Total Revenue)',
                code: 'REV-TOT',
                amount: revenueVal,
                isGroup: true,
                change: yoyRevenueGrowth,
                children: revenueChildren.length > 0 ? revenueChildren : undefined,
            },
            {
                id: 'cogs',
                label: '2. Koszt Wytworzenia Sprzedanych Produktów (COGS)',
                code: 'COGS',
                amount: cogsVal,
                reverseChange: true,
                change: null,
            },
            {
                id: 'gross_profit',
                label: '3. ZYSK BRUTTO ZE SPRZEDAŻY (GROSS PROFIT)',
                code: 'GP',
                amount: grossProfitVal,
                isSummary: true,
                color: 'profit',
                change: yoyGrossProfitGrowth,
            },
            {
                id: 'opex_group',
                label: '4. Koszty Działalności Operacyjnej (OPEX)',
                code: 'OPEX',
                amount: opexVal,
                isGroup: true,
                reverseChange: true,
                change: yoyOpexGrowth,
                children: expenseChildren.length > 0 ? expenseChildren : undefined,
            },
            {
                id: 'ebitda',
                label: '5. WYNIK OPERACYJNY EBITDA',
                code: 'EBITDA',
                amount: ebitdaVal,
                isSummary: true,
                color: 'profit',
                change: yoyEbitdaGrowth,
            },
            {
                id: 'da',
                label: '6. Amortyzacja Rzeczowa i Niematerialna (D&A)',
                code: 'D&A',
                amount: daVal,
                change: null,
                reverseChange: true,
            },
            {
                id: 'ebit',
                label: '7. ZYSK OPERACYJNY (EBIT)',
                code: 'EBIT',
                amount: ebitVal,
                isSummary: true,
                color: 'profit',
                change: yoyEbitGrowth,
            },
            {
                id: 'tax',
                label: '8. Podatek Dochodowy od Osób Prawnych (CIT)',
                code: 'CIT',
                amount: taxVal,
                change: null,
                reverseChange: true,
            },
            {
                id: 'net_profit',
                label: '9. ZYSK NETTO OKRESU (NET PROFIT / EAT)',
                code: 'EAT',
                amount: netProfitVal,
                isSummary: true,
                color: 'profit',
                change: yoyNetProfitGrowth,
            },
        ];
    }, [
        revenueVal,
        cogsVal,
        grossProfitVal,
        opexVal,
        ebitdaVal,
        daVal,
        ebitVal,
        taxVal,
        netProfitVal,
        yoyRevenueGrowth,
        yoyGrossProfitGrowth,
        yoyOpexGrowth,
        yoyEbitdaGrowth,
        yoyEbitGrowth,
        yoyNetProfitGrowth,
        revenueBreakdown,
        expenseBreakdown,
        convertAmount,
    ]);

    const crTarget = metrics?.benchmarks?.current_ratio?.target;
    const crSubtitle = crTarget ? `CEL DORADCY: >${crTarget}x` : 'NORMA BRANŻOWA: >1.20x';

    return (
        <div className="space-y-4">
            {/* Top Terminal Header Strip */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
                        <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-zinc-100 flex items-center gap-2 font-mono">
                            <span>{activeCompany?.name || 'Spółka Portfelowa'}</span>
                            <Badge variant="default" size="sm">{activeCompany?.code || 'PODMIOT'}</Badge>
                            <span className="text-zinc-600 font-normal">|</span>
                            <span className="text-zinc-400 font-normal text-[11px]">NIP: {activeCompany?.tax_id || '525-24-11-980'}</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 flex items-center gap-1.5 mt-0.5 font-mono">
                            <Calendar className="w-3 h-3 text-zinc-600" />
                            <span>FILTR ZAKRESU: {dateRange?.label?.toUpperCase() || 'CAŁY OKRES'}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400">
                    {(isAdmin || isAdvisor) && (
                        <button
                            type="button"
                            onClick={() => setIsBenchmarkModalOpen(true)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-zinc-700 hover:border-zinc-600 text-xs transition-colors"
                            title="Konfiguracja celów benchmarkowych spółki"
                        >
                            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Cele Benchmarkowe (M&A)</span>
                        </button>
                    )}
                    <div className="flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="text-zinc-300 text-[10px]">WALUTA: {currency}</span>
                    </div>
                    <span className="text-zinc-700 hidden sm:inline">|</span>
                    <div className="items-center gap-1.5 hidden sm:flex">
                        <Cpu className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="text-[10px] text-zinc-400">ENGINE: CQRS / DDD</span>
                    </div>
                </div>
            </div>

            {/* Primary KPI Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard
                    title="Przychody ze Sprzedaży"
                    value={loading ? '...' : revenueVal}
                    currency={currency}
                    icon={DollarSign}
                    change={yoyRevenueGrowth}
                    subtitle={yoyRevenueGrowth != null ? `DYNAMIKA R/R (${yoyRevenueGrowth > 0 ? '+' : ''}${yoyRevenueGrowth.toFixed(1)}%)` : 'DYNAMIKA R/R'}
                />

                <MetricCard
                    title="Wynik EBITDA"
                    value={loading ? '...' : ebitdaVal}
                    currency={currency}
                    icon={TrendingUp}
                    change={yoyEbitdaGrowth}
                    subtitle={`MARŻA: ${(ebitdaMargin * 100).toFixed(1)}%`}
                />

                <MetricCard
                    title="Zysk Operacyjny (EBIT)"
                    value={loading ? '...' : ebitVal}
                    currency={currency}
                    icon={PieChart}
                    change={yoyEbitGrowth}
                    subtitle={`MARŻA: ${(operatingMargin * 100).toFixed(1)}%`}
                />

                <MetricCard
                    title="Wskaźnik Płynności Bieżącej"
                    value={loading ? '...' : (currentRatio > 0 ? currentRatio.toFixed(2) : '—')}
                    isRatio={currentRatio > 0}
                    ratioSuffix="x"
                    icon={ShieldAlert}
                    change={yoyCurrentRatioDiff}
                    subtitle={crSubtitle}
                />
            </div>

            {/* Bloomberg / FactSet Financial Multiples Strip */}
            <FinancialMultiplesStrip
                ratios={metrics?.ratios}
                currentRatio={currentRatio}
                quickRatio={quickRatio}
                ebitdaMargin={ebitdaMargin}
                operatingMargin={operatingMargin}
                grossMargin={grossMargin}
                netMargin={netMargin}
                debtRatio={debtRatio}
                benchmarks={metrics?.benchmarks}
                onConfigure={isAdmin || isAdvisor ? () => setIsBenchmarkModalOpen(true) : null}
            />

            {/* Charts Section (Recharts) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Main Trend Chart (2 Cols on lg) */}
                <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3 mb-3">
                        <div>
                            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-2">
                                <BarChart3 className="w-3.5 h-3.5 text-zinc-400" />
                                {chartMode === 'pnl' ? 'DYNAMIKA WYNIKOWA P&L (PRZYCHODY / EBITDA / OPEX)' : 'EWOLUCJA WSKAŹNIKÓW PŁYNNOŚCI (CR / QR)'}
                            </h3>
                            <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
                                Horyzont miesięczny skonsolidowany | Seria czasowa PSR
                            </p>
                        </div>

                        {/* Chart View Switcher */}
                        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded border border-zinc-800 text-[10px] font-mono">
                            <button
                                onClick={() => setChartMode('pnl')}
                                className={`px-2.5 py-1 rounded transition-colors ${
                                    chartMode === 'pnl'
                                        ? 'bg-zinc-800 text-zinc-100 font-bold'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                TREND P&L
                            </button>
                            <button
                                onClick={() => setChartMode('liquidity')}
                                className={`px-2.5 py-1 rounded transition-colors ${
                                    chartMode === 'liquidity'
                                        ? 'bg-zinc-800 text-zinc-100 font-bold'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                PŁYNNOŚĆ CR/QR
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 min-h-[300px]">
                        {chartMode === 'pnl' ? (
                            <PnlTrendChart
                                data={convertedTrends}
                                currency={currency}
                            />
                        ) : (
                            <LiquidityTrendChart
                                data={liquidityTrends}
                            />
                        )}
                    </div>
                </div>

                {/* Cost Breakdown Donut Chart (1 Col on lg) */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col">
                    <div className="border-b border-zinc-800 pb-3 mb-3">
                        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-2">
                            <Activity className="w-3.5 h-3.5 text-zinc-400" />
                            Struktura Kosztów Operacyjnych
                        </h3>
                        <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
                            Rozbicie według kategorii rodzajowych
                        </p>
                    </div>

                    <div className="flex-1 min-h-[300px]">
                        <CostBreakdownChart
                            data={convertedBreakdown}
                            currency={currency}
                        />
                    </div>
                </div>
            </div>

            {/* High-Density P&L Breakdown Table */}
            <FinancialTable
                title="Rachunek Zysków i Strat (P&L Konsolidowany)"
                subtitle={`Zestawienie analityczne pozycji wynikowych dla okresu: ${dateRange?.label || 'Bieżący'}`}
                data={pnlRows}
                currency={currency}
                revenueTotal={revenueVal}
            />

            {/* Immutable Audit Trail Snippet with Live API Data */}
            <AuditTrailSnippet logs={auditLogs} />

            {/* Modal Konfiguracji Celów i Benchmarków */}
            <BenchmarkConfigModal
                isOpen={isBenchmarkModalOpen}
                onClose={() => setIsBenchmarkModalOpen(false)}
                onSaved={fetchData}
                currentMetrics={metrics}
            />
        </div>
    );
};
