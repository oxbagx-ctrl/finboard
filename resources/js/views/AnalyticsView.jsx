import React, { useState, useEffect, useMemo, useCallback } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useDeal } from '../context/DealContext';
import { useNotification } from '../context/NotificationContext';
import { MetricCard } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { FinancialMultiplesStrip } from '../components/ui/FinancialMultiplesStrip';
import { evaluateStatusChip } from '../components/benchmarks/BenchmarkConfigModal';
import { PnlTrendChart } from '../components/charts/PnlTrendChart';
import { CostBreakdownChart } from '../components/charts/CostBreakdownChart';
import { LiquidityTrendChart } from '../components/charts/LiquidityTrendChart';
import { formatCurrency, formatPercent, formatRatio } from '../utils/formatters';
import {
    TrendingUp,
    BarChart3,
    PieChart,
    ShieldAlert,
    Building2,
    Calendar,
    Coins,
    Cpu,
    Activity,
    RefreshCw,
    Layers,
    ArrowUpRight,
    ArrowDownRight,
    Percent,
    Sliders,
    Wallet,
    DollarSign,
    Save,
    RotateCcw,
    CheckCircle2,
    AlertCircle,
    Target
} from 'lucide-react';

const METRIC_DEFAULTS = [
    {
        metric_type: 'CURRENT_RATIO',
        metric_key: 'current_ratio',
        label: 'Wskaźnik Płynności Bieżącej (Current Ratio)',
        unit: 'x',
        higher_is_better: true,
        target_value: 1.20,
        warning_threshold: 1.00,
        critical_threshold: 0.80,
    },
    {
        metric_type: 'QUICK_RATIO',
        metric_key: 'quick_ratio',
        label: 'Wskaźnik Płynności Szybkiej (Quick Ratio)',
        unit: 'x',
        higher_is_better: true,
        target_value: 1.00,
        warning_threshold: 0.80,
        critical_threshold: 0.60,
    },
    {
        metric_type: 'GROSS_MARGIN',
        metric_key: 'gross_margin',
        label: 'Marża Brutto ze Sprzedaży (Gross Margin)',
        unit: '%',
        higher_is_better: true,
        target_value: 30.0,
        warning_threshold: 20.0,
        critical_threshold: 10.0,
    },
    {
        metric_type: 'EBITDA_MARGIN',
        metric_key: 'ebitda_margin',
        label: 'Marża Operacyjna EBITDA (EBITDA Margin)',
        unit: '%',
        higher_is_better: true,
        target_value: 15.0,
        warning_threshold: 10.0,
        critical_threshold: 5.0,
    },
    {
        metric_type: 'OPERATING_MARGIN',
        metric_key: 'operating_margin',
        label: 'Marża Operacyjna EBIT (Operating Margin)',
        unit: '%',
        higher_is_better: true,
        target_value: 10.0,
        warning_threshold: 5.0,
        critical_threshold: 0.0,
    },
    {
        metric_type: 'NET_MARGIN',
        metric_key: 'net_margin',
        label: 'Marża Zysku Netto (Net Margin)',
        unit: '%',
        higher_is_better: true,
        target_value: 8.0,
        warning_threshold: 3.0,
        critical_threshold: 0.0,
    },
    {
        metric_type: 'DEBT_TO_ASSETS',
        metric_key: 'debt_to_assets',
        label: 'Wskaźnik Ogólnego Zadłużenia (Debt-to-Assets)',
        unit: 'x',
        higher_is_better: false,
        target_value: 0.60,
        warning_threshold: 0.80,
        critical_threshold: 1.00,
    },
];

export const AnalyticsView = () => {
    const { activeCompany, isAdmin, isAdvisor } = useAuth();
    const { dateRange, currency, convertAmount } = useDeal();
    const { error, success } = useNotification();

    const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'profitability' | 'liquidity' | 'breakdown' | 'benchmarks'
    const [breakdownType, setBreakdownType] = useState('EXPENSE'); // 'EXPENSE' | 'REVENUE'
    const [loading, setLoading] = useState(true);

    const [metrics, setMetrics] = useState(null);
    const [trends, setTrends] = useState([]);
    const [expenseBreakdown, setExpenseBreakdown] = useState([]);
    const [revenueBreakdown, setRevenueBreakdown] = useState([]);
    const [liquidityTrends, setLiquidityTrends] = useState([]);
    const [benchmarksList, setBenchmarksList] = useState(METRIC_DEFAULTS);
    const [savingBenchmarks, setSavingBenchmarks] = useState(false);
    const [resettingBenchmarks, setResettingBenchmarks] = useState(false);

    const canEditBenchmarks = isAdmin || isAdvisor;

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (dateRange?.startDate) params.start_date = dateRange.startDate;
            if (dateRange?.endDate) params.end_date = dateRange.endDate;

            const [metricsRes, trendsRes, expensesRes, revenuesRes, liquidityRes] = await Promise.all([
                apiClient.get('/finance/analytics/metrics', { params }).catch(() => ({ data: { data: null } })),
                apiClient.get('/finance/analytics/trends', { params }).catch(() => ({ data: { data: [] } })),
                apiClient.get('/finance/analytics/breakdown', { params: { ...params, record_type: 'EXPENSE', category_type: 'OPEX' } }).catch(() => ({ data: { data: [] } })),
                apiClient.get('/finance/analytics/breakdown', { params: { ...params, record_type: 'REVENUE' } }).catch(() => ({ data: { data: [] } })),
                apiClient.get('/finance/analytics/liquidity', { params }).catch(() => ({ data: { data: [] } })),
            ]);

            setMetrics(metricsRes.data?.data || null);
            setTrends(trendsRes.data?.data || []);
            setExpenseBreakdown(expensesRes.data?.data || []);
            setRevenueBreakdown(revenuesRes.data?.data || []);
            setLiquidityTrends(liquidityRes.data?.data || []);
        } catch (err) {
            error('Nie udało się pobrać danych analitycznych.');
        } finally {
            setLoading(false);
        }
    }, [dateRange?.startDate, dateRange?.endDate, error]);

    const fetchBenchmarksData = useCallback(async () => {
        try {
            const benchRes = await apiClient.get('/finance/benchmarks');
            const fetched = benchRes.data?.data || [];
            if (fetched.length > 0) {
                const merged = METRIC_DEFAULTS.map((def) => {
                    const found = fetched.find((b) => b.metric_type === def.metric_type);
                    if (found) {
                        return {
                            ...def,
                            ...found,
                            target_value: Number(found.target_value),
                            warning_threshold: Number(found.warning_threshold),
                            critical_threshold: found.critical_threshold != null ? Number(found.critical_threshold) : def.critical_threshold,
                            is_custom: found.is_custom ?? false,
                        };
                    }
                    return def;
                });
                setBenchmarksList(merged);
            }
        } catch (err) {
            // Keep defaults
        }
    }, []);

    useEffect(() => {
        fetchData();

        const handleCompanyChange = () => fetchData();
        const handleBenchmarksUpdated = () => {
            fetchData();
            if (activeTab === 'benchmarks') {
                fetchBenchmarksData();
            }
        };

        window.addEventListener('finboard:company-changed', handleCompanyChange);
        window.addEventListener('finboard:benchmarks-updated', handleBenchmarksUpdated);

        return () => {
            window.removeEventListener('finboard:company-changed', handleCompanyChange);
            window.removeEventListener('finboard:benchmarks-updated', handleBenchmarksUpdated);
        };
    }, [fetchData, activeTab, fetchBenchmarksData]);

    useEffect(() => {
        if (activeTab === 'benchmarks') {
            fetchBenchmarksData();
        }
    }, [activeTab, fetchBenchmarksData]);

    // Handle Benchmark Target input edits
    const handleBenchmarkChange = (metricType, field, value) => {
        setBenchmarksList((prev) =>
            prev.map((item) => {
                if (item.metric_type === metricType) {
                    return { ...item, [field]: value === '' ? '' : Number(value) };
                }
                return item;
            })
        );
    };

    // Save All Benchmarks
    const handleSaveAllBenchmarks = async () => {
        setSavingBenchmarks(true);
        try {
            const payload = {
                benchmarks: benchmarksList.map((b) => ({
                    metric_type: b.metric_type,
                    target_value: Number(b.target_value),
                    warning_threshold: Number(b.warning_threshold),
                    critical_threshold: b.critical_threshold !== '' && b.critical_threshold != null ? Number(b.critical_threshold) : null,
                    higher_is_better: b.higher_is_better,
                    description: b.description || null,
                })),
            };

            await apiClient.put('/finance/benchmarks', payload);
            success('Pomyślnie zaktualizowano cele benchmarkowe spółki.');
            window.dispatchEvent(new CustomEvent('finboard:benchmarks-updated'));
            fetchData();
        } catch (err) {
            const msg = err.response?.data?.message || 'Nie udało się zapisać celów benchmarkowych.';
            error(msg);
        } finally {
            setSavingBenchmarks(false);
        }
    };

    // Reset Benchmarks to Defaults
    const handleResetBenchmarks = async () => {
        if (!window.confirm('Czy na pewno chcesz przywrócić domyślne standardy rynkowe dla wszystkich celów spółki?')) {
            return;
        }
        setResettingBenchmarks(true);
        try {
            await apiClient.post('/finance/benchmarks/reset');
            setBenchmarksList(METRIC_DEFAULTS.map((d) => ({ ...d, is_custom: false })));
            success('Przywrócono domyślne standardy rynkowe.');
            window.dispatchEvent(new CustomEvent('finboard:benchmarks-updated'));
            fetchData();
        } catch (err) {
            error('Błąd podczas przywracania wartości domyślnych.');
        } finally {
            setResettingBenchmarks(false);
        }
    };

    // Metric Calculations
    const rawRevenue = Number(metrics?.pnl?.revenue?.amount || 0);
    const rawCogs = Number(metrics?.pnl?.cogs?.amount || 0);
    const rawGrossProfit = Number(metrics?.pnl?.gross_profit?.amount || (rawRevenue - rawCogs));
    const rawEbitda = Number(metrics?.pnl?.ebitda?.amount || 0);
    const rawEbit = Number(metrics?.pnl?.ebit?.amount || 0);
    const rawNetProfit = Number(metrics?.pnl?.net_profit?.amount || 0);
    const rawOpex = Number(metrics?.pnl?.opex?.amount || 0);

    const revenueVal = convertAmount(rawRevenue);
    const grossProfitVal = convertAmount(rawGrossProfit);
    const opexVal = convertAmount(rawOpex);
    const ebitdaVal = convertAmount(rawEbitda);
    const ebitVal = convertAmount(rawEbit);
    const netProfitVal = convertAmount(rawNetProfit);

    const currentRatio = metrics?.liquidity?.current_ratio != null
        ? Number(metrics.liquidity.current_ratio)
        : (metrics?.benchmarks?.current_ratio?.current_value != null ? Number(metrics.benchmarks.current_ratio.current_value) : 0);

    const quickRatio = metrics?.liquidity?.quick_ratio != null
        ? Number(metrics.liquidity.quick_ratio)
        : (metrics?.benchmarks?.quick_ratio?.current_value != null ? Number(metrics.benchmarks.quick_ratio.current_value) : 0);

    const debtRatio = metrics?.solvency?.debt_to_assets != null
        ? Number(metrics.solvency.debt_to_assets)
        : (metrics?.benchmarks?.debt_to_assets?.current_value != null ? Number(metrics.benchmarks.debt_to_assets.current_value) : 0);

    const rawWorkingCapital = metrics?.liquidity?.working_capital?.amount != null
        ? Number(metrics.liquidity.working_capital.amount)
        : (metrics?.balance_sheet?.current_assets?.amount != null && metrics?.balance_sheet?.current_liabilities?.amount != null
            ? Number(metrics.balance_sheet.current_assets.amount) - Number(metrics.balance_sheet.current_liabilities.amount)
            : 0);
    const workingCapitalVal = convertAmount(rawWorkingCapital);

    const ebitdaMargin = metrics?.pnl?.ebitda_margin_pct != null
        ? Number(metrics.pnl.ebitda_margin_pct) / 100
        : (metrics?.pnl?.ebitda_margin != null ? Number(metrics.pnl.ebitda_margin) : (rawRevenue > 0 ? rawEbitda / rawRevenue : 0));

    const operatingMargin = metrics?.pnl?.operating_margin_pct != null
        ? Number(metrics.pnl.operating_margin_pct) / 100
        : (metrics?.pnl?.operating_margin != null ? Number(metrics.pnl.operating_margin) : (rawRevenue > 0 ? rawEbit / rawRevenue : 0));

    const grossMargin = metrics?.pnl?.gross_margin_pct != null
        ? Number(metrics.pnl.gross_margin_pct) / 100
        : (metrics?.pnl?.gross_margin != null ? Number(metrics.pnl.gross_margin) : (rawRevenue > 0 ? rawGrossProfit / rawRevenue : 0));

    const netMargin = metrics?.pnl?.net_margin_pct != null
        ? Number(metrics.pnl.net_margin_pct) / 100
        : (metrics?.pnl?.net_margin != null ? Number(metrics.pnl.net_margin) : (rawRevenue > 0 ? rawNetProfit / rawRevenue : 0));

    // Dynamics from API
    const dynamics = metrics?.dynamics || {};
    const yoyRevenueGrowth = dynamics?.yoy?.revenue_growth_pct != null ? Number(dynamics.yoy.revenue_growth_pct) : null;
    const yoyEbitdaGrowth = dynamics?.yoy?.ebitda_growth_pct != null ? Number(dynamics.yoy.ebitda_growth_pct) : null;
    const yoyEbitGrowth = dynamics?.yoy?.ebit_growth_pct != null ? Number(dynamics.yoy.ebit_growth_pct) : null;
    const yoyNetProfitGrowth = dynamics?.yoy?.net_profit_growth_pct != null ? Number(dynamics.yoy.net_profit_growth_pct) : null;

    // Converted Trends for Charts
    const convertedTrends = useMemo(() => {
        return trends.map((item) => {
            const rev = convertAmount(item.revenue || 0);
            const opx = convertAmount(item.opex || 0);
            const ebt = convertAmount(item.ebitda || 0);
            const net = convertAmount(item.net_profit || 0);
            return {
                ...item,
                revenue: rev,
                opex: opx,
                ebitda: ebt,
                net_profit: net,
                ebitdaMargin: rev > 0 ? (ebt / rev) * 100 : 0,
                netMargin: rev > 0 ? (net / rev) * 100 : 0,
            };
        });
    }, [trends, convertAmount]);

    // Converted Breakdowns
    const activeBreakdown = breakdownType === 'EXPENSE' ? expenseBreakdown : revenueBreakdown;
    const convertedBreakdown = useMemo(() => {
        return activeBreakdown.map((item) => ({
            ...item,
            amount: convertAmount(item.amount || 0),
        }));
    }, [activeBreakdown, convertAmount]);

    const crBench = metrics?.benchmarks?.current_ratio;
    const qrBench = metrics?.benchmarks?.quick_ratio;
    const benchSummary = metrics?.benchmark_summary;

    const getMetricActualValue = (metricKey) => {
        if (metricKey === 'current_ratio') return currentRatio;
        if (metricKey === 'quick_ratio') return quickRatio;
        if (metricKey === 'debt_to_assets') return debtRatio;
        if (metricKey === 'gross_margin') return grossMargin * 100;
        if (metricKey === 'ebitda_margin') return ebitdaMargin * 100;
        if (metricKey === 'operating_margin') return operatingMargin * 100;
        if (metricKey === 'net_margin') return netMargin * 100;
        return null;
    };

    return (
        <div className="space-y-4">
            {/* Top Institutional Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-zinc-100 flex items-center gap-2 font-mono">
                            <span>{activeCompany?.name || 'Spółka Portfelowa'}</span>
                            <Badge variant="default" size="sm">{activeCompany?.code || 'PODMIOT'}</Badge>
                            <span className="text-zinc-600 font-normal">|</span>
                            <span className="text-zinc-400 font-normal text-[11px]">NIP: {activeCompany?.tax_id || '525-00-11-222'}</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 flex items-center gap-1.5 mt-0.5 font-mono">
                            <Calendar className="w-3 h-3 text-zinc-600" />
                            <span>ANALIZA FINANSOWA & TRENDY: {dateRange?.label?.toUpperCase() || 'CAŁA HISTORIA'}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
                        <Coins className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="text-zinc-300 text-[10px]">WALUTA: {currency}</span>
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={fetchData}
                        loading={loading}
                        className="text-xs font-mono"
                    >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Odśwież
                    </Button>
                </div>
            </div>

            {/* View Mode Navigation Tabs */}
            <div className="flex border-b border-zinc-800 bg-zinc-900/60 rounded-t-lg px-2 pt-2 gap-1 overflow-x-auto font-mono text-xs">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-3.5 py-2 border-b-2 font-semibold transition-colors whitespace-nowrap flex items-center gap-2 ${
                        activeTab === 'overview'
                            ? 'border-emerald-400 text-zinc-100 bg-zinc-850/50'
                            : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
                    }`}
                >
                    <BarChart3 className="w-3.5 h-3.5 text-zinc-400" />
                    Przegląd Kompleksowy
                </button>
                <button
                    onClick={() => setActiveTab('profitability')}
                    className={`px-3.5 py-2 border-b-2 font-semibold transition-colors whitespace-nowrap flex items-center gap-2 ${
                        activeTab === 'profitability'
                            ? 'border-emerald-400 text-zinc-100 bg-zinc-850/50'
                            : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
                    }`}
                >
                    <Percent className="w-3.5 h-3.5 text-zinc-400" />
                    Rentowność i Marże
                </button>
                <button
                    onClick={() => setActiveTab('liquidity')}
                    className={`px-3.5 py-2 border-b-2 font-semibold transition-colors whitespace-nowrap flex items-center gap-2 ${
                        activeTab === 'liquidity'
                            ? 'border-emerald-400 text-zinc-100 bg-zinc-850/50'
                            : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
                    }`}
                >
                    <ShieldAlert className="w-3.5 h-3.5 text-zinc-400" />
                    Płynność i Wskaźniki
                </button>
                <button
                    onClick={() => setActiveTab('breakdown')}
                    className={`px-3.5 py-2 border-b-2 font-semibold transition-colors whitespace-nowrap flex items-center gap-2 ${
                        activeTab === 'breakdown'
                            ? 'border-emerald-400 text-zinc-100 bg-zinc-850/50'
                            : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
                    }`}
                >
                    <Layers className="w-3.5 h-3.5 text-zinc-400" />
                    Dekompozycja Przychodów / Kosztów
                </button>
                <button
                    onClick={() => setActiveTab('benchmarks')}
                    className={`px-3.5 py-2 border-b-2 font-semibold transition-colors whitespace-nowrap flex items-center gap-2 ${
                        activeTab === 'benchmarks'
                            ? 'border-emerald-400 text-zinc-100 bg-zinc-850/50'
                            : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
                    }`}
                >
                    <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                    Cele i Benchmarki (M&A)
                </button>
            </div>

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
                <div className="space-y-4">
                    {/* Top Metric Cards */}
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
                            icon={Activity}
                            change={yoyEbitGrowth}
                            subtitle={`MARŻA: ${(operatingMargin * 100).toFixed(1)}%`}
                        />
                        <MetricCard
                            title="Zysk Netto (EAT)"
                            value={loading ? '...' : netProfitVal}
                            currency={currency}
                            icon={Wallet}
                            change={yoyNetProfitGrowth}
                            subtitle={`MARŻA: ${(netMargin * 100).toFixed(1)}%`}
                        />
                    </div>

                    {/* Bloomberg Multiples Strip */}
                    <FinancialMultiplesStrip
                        currentRatio={currentRatio}
                        quickRatio={quickRatio}
                        ebitdaMargin={ebitdaMargin}
                        operatingMargin={operatingMargin}
                        grossMargin={grossMargin}
                        netMargin={netMargin}
                        debtRatio={debtRatio}
                        benchmarks={metrics?.benchmarks}
                        onConfigure={() => setActiveTab('benchmarks')}
                    />

                    {/* Main Overview Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col">
                            <div className="border-b border-zinc-800 pb-3 mb-3">
                                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-2">
                                    <BarChart3 className="w-3.5 h-3.5 text-zinc-400" />
                                    Wielowymiarowy Trend Wynikowy P&L
                                </h3>
                                <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
                                    Porównanie miesięczne: Przychody vs Koszty Operacyjne vs Wynik EBITDA i Netto
                                </p>
                            </div>
                            <div className="flex-1 min-h-[300px]">
                                <PnlTrendChart
                                    data={convertedTrends}
                                    currency={currency}
                                />
                            </div>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col">
                            <div className="border-b border-zinc-800 pb-3 mb-3">
                                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-2">
                                    <Activity className="w-3.5 h-3.5 text-zinc-400" />
                                    Struktura Kosztów Operacyjnych
                                </h3>
                                <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
                                    Rozbicie według kategorii OPEX
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
                </div>
            )}

            {/* TAB 2: PROFITABILITY & MARGINS */}
            {activeTab === 'profitability' && (
                <div className="space-y-4">
                    {/* Margins Summary Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5 font-mono">
                            <div className="text-[10px] uppercase text-zinc-500">Marża Brutto ze Sprzedaży</div>
                            <div className="text-2xl font-bold text-zinc-100 mt-1 tabular-nums">
                                {(grossMargin * 100).toFixed(1)}%
                            </div>
                            <div className="text-[10px] text-zinc-400 mt-1">
                                Wartość brutto: {formatCurrency(grossProfitVal, currency)}
                            </div>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5 font-mono">
                            <div className="text-[10px] uppercase text-zinc-500">Marża Operacyjna EBITDA</div>
                            <div className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">
                                {(ebitdaMargin * 100).toFixed(1)}%
                            </div>
                            <div className="text-[10px] text-zinc-400 mt-1">
                                Wynik EBITDA: {formatCurrency(ebitdaVal, currency)}
                            </div>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5 font-mono">
                            <div className="text-[10px] uppercase text-zinc-500">Marża Operacyjna EBIT</div>
                            <div className="text-2xl font-bold text-sky-400 mt-1 tabular-nums">
                                {(operatingMargin * 100).toFixed(1)}%
                            </div>
                            <div className="text-[10px] text-zinc-400 mt-1">
                                Wynik EBIT: {formatCurrency(ebitVal, currency)}
                            </div>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5 font-mono">
                            <div className="text-[10px] uppercase text-zinc-500">Marża Zysku Netto</div>
                            <div className="text-2xl font-bold text-purple-400 mt-1 tabular-nums">
                                {(netMargin * 100).toFixed(1)}%
                            </div>
                            <div className="text-[10px] text-zinc-400 mt-1">
                                Zysk Netto: {formatCurrency(netProfitVal, currency)}
                            </div>
                        </div>
                    </div>

                    {/* Margins Data Table */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col font-mono">
                        <div className="border-b border-zinc-800 pb-3 mb-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-2">
                                <TrendingUp className="w-3.5 h-3.5 text-zinc-400" />
                                Dziennik Rentowności M&A – Szereg Czasowy
                            </h3>
                            <p className="text-[10px] text-zinc-500 mt-0.5">
                                Ewolucja rentowności na poszczególnych poziomach rachunku wyników
                            </p>
                        </div>

                        <div className="overflow-x-auto border border-zinc-800 rounded">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-zinc-950 text-[10px] uppercase text-zinc-400 border-b border-zinc-800">
                                    <tr>
                                        <th className="py-2.5 px-3">Okres (Miesiąc)</th>
                                        <th className="py-2.5 px-3 text-right">Przychody</th>
                                        <th className="py-2.5 px-3 text-right">Koszty OPEX</th>
                                        <th className="py-2.5 px-3 text-right">EBITDA</th>
                                        <th className="py-2.5 px-3 text-right">Marża EBITDA</th>
                                        <th className="py-2.5 px-3 text-right">Zysk Netto</th>
                                        <th className="py-2.5 px-3 text-right">Marża Netto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-850">
                                    {convertedTrends.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="py-8 text-center text-zinc-500">
                                                Brak danych trendów dla wskazanego okresu.
                                            </td>
                                        </tr>
                                    ) : (
                                        convertedTrends.map((t, i) => (
                                            <tr key={i} className="hover:bg-zinc-850/40 transition-colors">
                                                <td className="py-2 px-3 font-bold text-zinc-200">{t.label || t.month}</td>
                                                <td className="py-2 px-3 text-right text-emerald-400 tabular-nums">
                                                    {formatCurrency(t.revenue, currency)}
                                                </td>
                                                <td className="py-2 px-3 text-right text-rose-400 tabular-nums">
                                                    {formatCurrency(t.opex, currency)}
                                                </td>
                                                <td className="py-2 px-3 text-right text-sky-400 font-bold tabular-nums">
                                                    {formatCurrency(t.ebitda, currency)}
                                                </td>
                                                <td className="py-2 px-3 text-right tabular-nums text-zinc-300">
                                                    {t.ebitdaMargin.toFixed(1)}%
                                                </td>
                                                <td className="py-2 px-3 text-right font-bold tabular-nums text-purple-400">
                                                    {formatCurrency(t.net_profit, currency)}
                                                </td>
                                                <td className="py-2 px-3 text-right tabular-nums text-zinc-300">
                                                    {t.netMargin.toFixed(1)}%
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: LIQUIDITY & SOLVENCY */}
            {activeTab === 'liquidity' && (
                <div className="space-y-4">
                    {/* Liquidity KPI Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-mono uppercase text-zinc-400">Current Ratio (Wskaźnik Bieżący)</span>
                                <Badge
                                    variant={crBench?.status === 'OPT' || (!crBench && currentRatio >= 1.2) ? 'success' : (crBench?.status === 'CRIT' ? 'danger' : 'warning')}
                                    size="sm"
                                >
                                    {crBench?.status_label || (currentRatio >= 1.2 ? 'OPTYMALNA' : 'PODWYŻSZONE RYZYKO')}
                                </Badge>
                            </div>
                            <div className="text-3xl font-bold font-mono text-zinc-100 mt-2 tabular-nums">
                                {currentRatio > 0 ? `${currentRatio.toFixed(2)}x` : '—'}
                            </div>
                            <div className="text-[10px] font-mono text-zinc-500 mt-1">
                                {crBench?.target ? `Cel doradcy: min. ${crBench.target}x` : 'Benchmark bankowy: min. 1.20x'}
                            </div>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-mono uppercase text-zinc-400">Quick Ratio (Wskaźnik Szybki)</span>
                                <Badge
                                    variant={qrBench?.status === 'OPT' || (!qrBench && quickRatio >= 1.0) ? 'success' : (qrBench?.status === 'CRIT' ? 'danger' : 'warning')}
                                    size="sm"
                                >
                                    {qrBench?.status_label || (quickRatio >= 1.0 ? 'OPTYMALNA' : 'UWAGA')}
                                </Badge>
                            </div>
                            <div className="text-3xl font-bold font-mono text-amber-400 mt-2 tabular-nums">
                                {quickRatio > 0 ? `${quickRatio.toFixed(2)}x` : '—'}
                            </div>
                            <div className="text-[10px] font-mono text-zinc-500 mt-1">
                                {qrBench?.target ? `Cel doradcy: min. ${qrBench.target}x` : 'Benchmark bankowy: min. 1.00x'}
                            </div>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-mono uppercase text-zinc-400">Kapitał Obrotowy Netto (NWC)</span>
                                <Badge variant={workingCapitalVal >= 0 ? 'success' : 'danger'} size="sm">
                                    {workingCapitalVal >= 0 ? 'DODATNI' : 'UJEMNY'}
                                </Badge>
                            </div>
                            <div className="text-3xl font-bold font-mono text-emerald-400 mt-2 tabular-nums">
                                {formatCurrency(workingCapitalVal, currency)}
                            </div>
                            <div className="text-[10px] font-mono text-zinc-500 mt-1">
                                Aktywa obrotowe minus Zobowiązania krótkoterminowe
                            </div>
                        </div>
                    </div>

                    {/* Liquidity Trend Chart */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col">
                        <div className="border-b border-zinc-800 pb-3 mb-3">
                            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-2">
                                <ShieldAlert className="w-3.5 h-3.5 text-zinc-400" />
                                Ewolucja Płynności Finansowej (CR / QR)
                            </h3>
                            <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
                                Kształtowanie się relacji płynności bieżącej i szybkiej w czasie
                            </p>
                        </div>
                        <div className="h-[320px]">
                            <LiquidityTrendChart data={liquidityTrends} />
                        </div>
                    </div>

                    {/* Solvency & Commentary */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-xs">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-3">
                            <span className="font-bold text-zinc-200 uppercase">Komentarz Analityka M&A</span>
                            <span className={debtRatio <= 0.6 ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                                {benchSummary?.overall_status_label || (debtRatio <= 0.6 ? 'STABILNY / LOW RISK' : 'PODWYŻSZONE ZADŁUŻENIE')}
                            </span>
                        </div>
                        <p className="text-zinc-400 leading-relaxed text-[11px]">
                            Wskaźnik ogólnego zadłużenia (Debt-to-Assets) wynosi <strong className="text-zinc-200">{debtRatio > 0 ? debtRatio.toFixed(2) : '0.38'}x</strong>,
                            co wskazuje na {debtRatio <= 0.50 ? 'konserwatywną strukturę finansowania i wysoki bufor bezpieczeństwa kredytowego.' : 'umiarkowaną dźwignię finansową.'}
                            Wskaźniki płynności {currentRatio >= 1.2 ? 'utrzymują się powyżej progów ostrzegawczych, gwarantując pełną obsługę zobowiązań krótkoterminowych.' : 'wymagają monitorowania rotacji należności i poziomu zapasów.'}
                        </p>
                    </div>
                </div>
            )}

            {/* TAB 4: DECOMPOSITION (BREAKDOWN) */}
            {activeTab === 'breakdown' && (
                <div className="space-y-4">
                    {/* Switcher: Expenses vs Revenue */}
                    <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-mono uppercase text-zinc-400 font-semibold">Kierunek Przepływów:</span>
                            <div className="inline-flex rounded-md border border-zinc-800 bg-zinc-950 p-0.5 text-xs font-mono">
                                <button
                                    onClick={() => setBreakdownType('EXPENSE')}
                                    className={`px-3 py-1 rounded transition-colors ${
                                        breakdownType === 'EXPENSE'
                                            ? 'bg-rose-950/60 text-rose-300 font-bold border border-rose-800/60'
                                            : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                                >
                                    Koszty Operacyjne (OPEX)
                                </button>
                                <button
                                    onClick={() => setBreakdownType('REVENUE')}
                                    className={`px-3 py-1 rounded transition-colors ${
                                        breakdownType === 'REVENUE'
                                            ? 'bg-emerald-950/60 text-emerald-300 font-bold border border-emerald-800/60'
                                            : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                                >
                                    Przychody ze Sprzedaży (REV)
                                </button>
                            </div>
                        </div>

                        <div className="text-[11px] font-mono text-zinc-500">
                            Łącznie zidentyfikowanych pozycji: <strong className="text-zinc-300">{convertedBreakdown.length}</strong>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Donut Chart */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col">
                            <div className="border-b border-zinc-800 pb-3 mb-3">
                                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-2">
                                    <PieChart className="w-3.5 h-3.5 text-zinc-400" />
                                    Wykres Udziału Procentowego
                                </h3>
                                <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
                                    Dystrybucja według kategorii w horyzoncie analitycznym
                                </p>
                            </div>
                            <div className="flex-1 min-h-[300px]">
                                <CostBreakdownChart
                                    data={convertedBreakdown}
                                    currency={currency}
                                />
                            </div>
                        </div>

                        {/* High-Density Breakdown Table */}
                        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col">
                            <div className="border-b border-zinc-800 pb-3 mb-3">
                                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-2">
                                    <Layers className="w-3.5 h-3.5 text-zinc-400" />
                                    Tabela Pozycji Analitycznych
                                </h3>
                                <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
                                    Zestawienie sumaryczne w walucie {currency} z udziałem w sumie
                                </p>
                            </div>

                            <div className="overflow-x-auto border border-zinc-800 rounded flex-1">
                                <table className="w-full text-left font-mono text-xs">
                                    <thead className="bg-zinc-950 text-[10px] uppercase text-zinc-400 border-b border-zinc-800">
                                        <tr>
                                            <th className="py-2.5 px-3">Kod</th>
                                            <th className="py-2.5 px-3">Kategoria Analityczna</th>
                                            <th className="py-2.5 px-3 text-right">Kwota ({currency})</th>
                                            <th className="py-2.5 px-3 text-right">Udział %</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-850">
                                        {convertedBreakdown.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" className="py-8 text-center text-zinc-500">
                                                    Brak danych kategorii dla wybranego typu i okresu.
                                                </td>
                                            </tr>
                                        ) : (
                                            convertedBreakdown.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-zinc-850/40 transition-colors">
                                                    <td className="py-2 px-3 text-zinc-500 font-semibold">
                                                        {item.category_code || `CAT-${idx + 1}`}
                                                    </td>
                                                    <td className="py-2 px-3 text-zinc-200 font-medium">
                                                        {item.category_name}
                                                    </td>
                                                    <td className={`py-2 px-3 text-right font-bold tabular-nums ${
                                                        breakdownType === 'EXPENSE' ? 'text-rose-400' : 'text-emerald-400'
                                                    }`}>
                                                        {formatCurrency(item.amount, currency)}
                                                    </td>
                                                    <td className="py-2 px-3 text-right text-zinc-300 font-semibold tabular-nums">
                                                        {Number(item.percentage || 0).toFixed(1)}%
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 5: BENCHMARKS CONFIGURATION & STATUS CHIPS */}
            {activeTab === 'benchmarks' && (
                <div className="space-y-4 font-mono">
                    {/* Top Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5">
                            <div className="text-[10px] uppercase text-zinc-500">Ocena Zdrowia Spółki (Health Score)</div>
                            <div className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">
                                {benchSummary?.health_score != null ? `${benchSummary.health_score}%` : '85.7%'}
                            </div>
                            <div className="text-[10px] text-zinc-400 mt-1">
                                Status: <strong className="text-emerald-400">{benchSummary?.overall_status_label || 'OPTYMALNA'}</strong>
                            </div>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5">
                            <div className="text-[10px] uppercase text-zinc-500">Cele Spełnione (Optymalne)</div>
                            <div className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">
                                {benchSummary?.optimal_count != null ? benchSummary.optimal_count : 6} / {benchSummary?.total_evaluated != null ? benchSummary.total_evaluated : 7}
                            </div>
                            <div className="text-[10px] text-zinc-500 mt-1">
                                Status: OPT (Zgodność z wytycznymi)
                            </div>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5">
                            <div className="text-[10px] uppercase text-zinc-500">Próg Ostrzegawczy (Warning)</div>
                            <div className="text-2xl font-bold text-amber-400 mt-1 tabular-nums">
                                {benchSummary?.warning_count != null ? benchSummary.warning_count : 1}
                            </div>
                            <div className="text-[10px] text-zinc-500 mt-1">
                                Status: WARN (Wymaga obserwacji)
                            </div>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5">
                            <div className="text-[10px] uppercase text-zinc-500">Przekroczenia Krytyczne</div>
                            <div className="text-2xl font-bold text-rose-400 mt-1 tabular-nums">
                                {benchSummary?.critical_count != null ? benchSummary.critical_count : 0}
                            </div>
                            <div className="text-[10px] text-zinc-500 mt-1">
                                Status: CRIT (Wymaga interwencji)
                            </div>
                        </div>
                    </div>

                    {/* Matrix Management Card */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3 mb-4">
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-2">
                                    <Target className="w-4 h-4 text-emerald-400" />
                                    Macierz Celów i Benchmarków Finansowych (M&A Target Matrix)
                                </h3>
                                <p className="text-[10px] text-zinc-500 mt-0.5">
                                    {canEditBenchmarks
                                        ? 'TRYB EDYCJI DLA DORADCY: Skonfiguruj progi docelowe i ostrzegawcze z automatyczną ewaluacją statusów w czasie rzeczywistym'
                                        : 'TRYB PODGLĄDU DLA KLIENTA: Wskaźniki i kryteria docelowe zdefiniowane przez Doradcę M&A'}
                                </p>
                            </div>

                            {canEditBenchmarks && (
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={handleResetBenchmarks}
                                        disabled={resettingBenchmarks || savingBenchmarks}
                                        className="text-xs"
                                    >
                                        <RotateCcw className="w-3 h-3 mr-1.5" />
                                        Resetuj do Rynkowych
                                    </Button>
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={handleSaveAllBenchmarks}
                                        loading={savingBenchmarks}
                                        className="text-xs font-semibold"
                                    >
                                        <Save className="w-3.5 h-3.5 mr-1.5" />
                                        Zapisz Wszystkie Cele
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Interactive Benchmark Matrix Table */}
                        <div className="overflow-x-auto border border-zinc-800 rounded">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-zinc-950 text-[10px] uppercase text-zinc-400 border-b border-zinc-800">
                                    <tr>
                                        <th className="py-2.5 px-3">Wskaźnik Finansowy</th>
                                        <th className="py-2.5 px-3">Relacja</th>
                                        <th className="py-2.5 px-3 text-right">Wartość Bieżąca</th>
                                        <th className="py-2.5 px-3 text-center w-32">Cel Docelowy</th>
                                        <th className="py-2.5 px-3 text-center w-32">Próg Ostrzegawczy</th>
                                        <th className="py-2.5 px-3 text-center w-32">Próg Krytyczny</th>
                                        <th className="py-2.5 px-3 text-center">Status & Semafor</th>
                                        <th className="py-2.5 px-3 text-center">Źródło</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-850">
                                    {benchmarksList.map((item) => {
                                        const actual = getMetricActualValue(item.metric_key);
                                        const chip = evaluateStatusChip(actual, item.target_value, item.warning_threshold, item.higher_is_better);

                                        return (
                                            <tr key={item.metric_type} className="hover:bg-zinc-850/40 transition-colors">
                                                <td className="py-3 px-3">
                                                    <div className="font-bold text-zinc-200">{item.label}</div>
                                                    <div className="text-[10px] text-zinc-500 mt-0.5">
                                                        Klucz: <code className="text-zinc-400">{item.metric_type}</code> | Jednostka: <strong className="text-zinc-300">{item.unit}</strong>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3 text-[10px] text-zinc-400">
                                                    {item.higher_is_better ? (
                                                        <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                                                            <ArrowUpRight className="w-3.5 h-3.5" />
                                                            Większy (&gt;=)
                                                        </span>
                                                    ) : (
                                                        <span className="text-amber-400 flex items-center gap-1 font-semibold">
                                                            <ArrowDownRight className="w-3.5 h-3.5" />
                                                            Mniejszy (&lt;=)
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-3 text-right font-bold tabular-nums text-zinc-100 text-sm">
                                                    {actual != null ? `${Number(actual).toFixed(2)}${item.unit}` : '—'}
                                                </td>
                                                <td className="py-3 px-3 text-center">
                                                    {canEditBenchmarks ? (
                                                        <div className="relative inline-block w-24">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                aria-label={`Cel docelowy ${item.label}`}
                                                                value={item.target_value}
                                                                disabled={savingBenchmarks}
                                                                onChange={(e) => handleBenchmarkChange(item.metric_type, 'target_value', e.target.value)}
                                                                className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 font-mono text-right pr-5 focus:border-emerald-500 focus:outline-none disabled:opacity-60"
                                                            />
                                                            <span className="absolute right-1.5 top-1 text-[10px] text-zinc-500 pointer-events-none">
                                                                {item.unit}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-zinc-200 font-bold tabular-nums">
                                                            {Number(item.target_value).toFixed(2)}{item.unit}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-3 text-center">
                                                    {canEditBenchmarks ? (
                                                        <div className="relative inline-block w-24">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                aria-label={`Próg ostrzegawczy ${item.label}`}
                                                                value={item.warning_threshold}
                                                                disabled={savingBenchmarks}
                                                                onChange={(e) => handleBenchmarkChange(item.metric_type, 'warning_threshold', e.target.value)}
                                                                className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 font-mono text-right pr-5 focus:border-amber-500 focus:outline-none disabled:opacity-60"
                                                            />
                                                            <span className="absolute right-1.5 top-1 text-[10px] text-zinc-500 pointer-events-none">
                                                                {item.unit}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-zinc-300 tabular-nums">
                                                            {Number(item.warning_threshold).toFixed(2)}{item.unit}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-3 text-center">
                                                    {canEditBenchmarks ? (
                                                        <div className="relative inline-block w-24">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                aria-label={`Próg krytyczny ${item.label}`}
                                                                value={item.critical_threshold ?? ''}
                                                                disabled={savingBenchmarks}
                                                                placeholder="Opcj."
                                                                onChange={(e) => handleBenchmarkChange(item.metric_type, 'critical_threshold', e.target.value)}
                                                                className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 font-mono text-right pr-5 focus:border-rose-500 focus:outline-none disabled:opacity-60 placeholder:text-zinc-600"
                                                            />
                                                            <span className="absolute right-1.5 top-1 text-[10px] text-zinc-500 pointer-events-none">
                                                                {item.unit}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-zinc-400 tabular-nums">
                                                            {item.critical_threshold != null ? `${Number(item.critical_threshold).toFixed(2)}${item.unit}` : '—'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${chip.className}`}>
                                                        {chip.status} – {chip.label}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-center">
                                                    {item.is_custom ? (
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-950/60 border border-sky-800/60 text-sky-400 font-bold uppercase">
                                                            CEL DORADCY
                                                        </span>
                                                    ) : (
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-850 border border-zinc-750 text-zinc-400 font-bold uppercase">
                                                            STANDARD
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
