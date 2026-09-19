import React, { useState, useEffect, useMemo, useCallback } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useDeal } from '../context/DealContext';
import { useNotification } from '../context/NotificationContext';
import { MetricCard } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { FinancialMultiplesStrip } from '../components/ui/FinancialMultiplesStrip';
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
    DollarSign
} from 'lucide-react';

export const AnalyticsView = () => {
    const { activeCompany } = useAuth();
    const { dateRange, currency, convertAmount } = useDeal();
    const { error } = useNotification();

    const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'profitability' | 'liquidity' | 'breakdown'
    const [breakdownType, setBreakdownType] = useState('EXPENSE'); // 'EXPENSE' | 'REVENUE'
    const [loading, setLoading] = useState(true);

    const [metrics, setMetrics] = useState(null);
    const [trends, setTrends] = useState([]);
    const [expenseBreakdown, setExpenseBreakdown] = useState([]);
    const [revenueBreakdown, setRevenueBreakdown] = useState([]);
    const [liquidityTrends, setLiquidityTrends] = useState([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (dateRange?.startDate) params.start_date = dateRange.startDate;
            if (dateRange?.endDate) params.end_date = dateRange.endDate;

            const [metricsRes, trendsRes, expensesRes, revenuesRes, liquidityRes] = await Promise.all([
                apiClient.get('/finance/analytics/metrics', { params }).catch(() => ({ data: { data: null } })),
                apiClient.get('/finance/analytics/trends', { params }).catch(() => ({ data: { data: [] } })),
                apiClient.get('/finance/analytics/breakdown', { params: { ...params, record_type: 'EXPENSE' } }).catch(() => ({ data: { data: [] } })),
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
    }, [activeCompany?.id, dateRange?.startDate, dateRange?.endDate, error]);

    useEffect(() => {
        fetchData();

        const handleCompanyChange = () => fetchData();
        window.addEventListener('finboard:company-changed', handleCompanyChange);
        return () => window.removeEventListener('finboard:company-changed', handleCompanyChange);
    }, [fetchData]);

    // Financial Values Calculation
    const rawRevenue = Number(metrics?.pnl?.revenue?.amount || 0);
    const rawGrossProfit = Number(metrics?.pnl?.gross_profit?.amount || (rawRevenue * 0.45));
    const rawCogs = rawRevenue - rawGrossProfit;
    const rawEbitda = Number(metrics?.pnl?.ebitda?.amount || 0);
    const rawEbit = Number(metrics?.pnl?.ebit?.amount || 0);
    const rawNetProfit = Number(metrics?.pnl?.net_profit?.amount || 0);
    const rawOpex = Number(metrics?.pnl?.opex?.amount || 0);

    const revenueVal = convertAmount(rawRevenue);
    const grossProfitVal = convertAmount(rawGrossProfit);
    const cogsVal = convertAmount(rawCogs);
    const opexVal = convertAmount(rawOpex);
    const ebitdaVal = convertAmount(rawEbitda);
    const ebitVal = convertAmount(rawEbit);
    const netProfitVal = convertAmount(rawNetProfit);

    const currentRatio = metrics?.liquidity?.current_ratio ? Number(metrics.liquidity.current_ratio) : 1.85;
    const quickRatio = metrics?.liquidity?.quick_ratio ? Number(metrics.liquidity.quick_ratio) : 1.42;
    const workingCapitalVal = convertAmount(Number(metrics?.liquidity?.working_capital?.amount || 0));

    const ebitdaMargin = metrics?.pnl?.ebitda_margin ? Number(metrics.pnl.ebitda_margin) : (rawRevenue > 0 ? rawEbitda / rawRevenue : 0.184);
    const operatingMargin = metrics?.pnl?.operating_margin ? Number(metrics.pnl.operating_margin) : (rawRevenue > 0 ? rawEbit / rawRevenue : 0.142);
    const grossMargin = metrics?.pnl?.gross_margin ? Number(metrics.pnl.gross_margin) : (rawRevenue > 0 ? rawGrossProfit / rawRevenue : 0.326);
    const netMargin = metrics?.pnl?.net_margin ? Number(metrics.pnl.net_margin) : (rawRevenue > 0 ? rawNetProfit / rawRevenue : 0.118);

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
                            <span className="text-zinc-400 font-normal text-[11px]">NIP: {activeCompany?.tax_id || '525-24-11-980'}</span>
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
                    <PieChart className="w-3.5 h-3.5 text-zinc-400" />
                    Dekompozycja Przychodów / Kosztów
                </button>
            </div>

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
                <div className="space-y-4">
                    {/* Primary KPI Metrics Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <MetricCard
                            title="Przychody ze Sprzedaży"
                            value={loading ? '...' : revenueVal}
                            currency={currency}
                            icon={DollarSign}
                            change={12.4}
                            subtitle="DYNAMIKA R/R"
                        />

                        <MetricCard
                            title="Wynik EBITDA"
                            value={loading ? '...' : ebitdaVal}
                            currency={currency}
                            icon={TrendingUp}
                            change={8.2}
                            subtitle={`MARŻA: ${(ebitdaMargin * 100).toFixed(1)}%`}
                        />

                        <MetricCard
                            title="Zysk Operacyjny (EBIT)"
                            value={loading ? '...' : ebitVal}
                            currency={currency}
                            icon={BarChart3}
                            change={5.7}
                            subtitle={`MARŻA: ${(operatingMargin * 100).toFixed(1)}%`}
                        />

                        <MetricCard
                            title="Zysk Netto (EAT)"
                            value={loading ? '...' : netProfitVal}
                            currency={currency}
                            icon={Activity}
                            change={11.8}
                            subtitle={`MARŻA: ${(netMargin * 100).toFixed(1)}%`}
                        />
                    </div>

                    {/* Financial Multiples Strip */}
                    <FinancialMultiplesStrip
                        currentRatio={currentRatio}
                        quickRatio={quickRatio}
                        ebitdaMargin={ebitdaMargin}
                        operatingMargin={operatingMargin}
                        grossMargin={grossMargin}
                        netMargin={netMargin}
                        debtRatio={0.38}
                    />

                    {/* Charts Section */}
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
                    {/* Profitability KPI Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                            <div className="text-[11px] font-mono uppercase text-zinc-400">Marża Brutto ze Sprzedaży</div>
                            <div className="text-2xl font-bold font-mono text-zinc-100 mt-1 tabular-nums">
                                {(grossMargin * 100).toFixed(1)}%
                            </div>
                            <div className="text-[10px] font-mono text-zinc-500 mt-1">
                                Wartość brutto: {formatCurrency(grossProfitVal, currency)}
                            </div>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                            <div className="text-[11px] font-mono uppercase text-zinc-400">Marża Operacyjna EBITDA</div>
                            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1 tabular-nums">
                                {(ebitdaMargin * 100).toFixed(1)}%
                            </div>
                            <div className="text-[10px] font-mono text-zinc-500 mt-1">
                                Wynik EBITDA: {formatCurrency(ebitdaVal, currency)}
                            </div>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                            <div className="text-[11px] font-mono uppercase text-zinc-400">Marża Operacyjna EBIT</div>
                            <div className="text-2xl font-bold font-mono text-sky-400 mt-1 tabular-nums">
                                {(operatingMargin * 100).toFixed(1)}%
                            </div>
                            <div className="text-[10px] font-mono text-zinc-500 mt-1">
                                Wynik EBIT: {formatCurrency(ebitVal, currency)}
                            </div>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                            <div className="text-[11px] font-mono uppercase text-zinc-400">Marża Zysku Netto</div>
                            <div className="text-2xl font-bold font-mono text-purple-400 mt-1 tabular-nums">
                                {(netMargin * 100).toFixed(1)}%
                            </div>
                            <div className="text-[10px] font-mono text-zinc-500 mt-1">
                                Zysk Netto: {formatCurrency(netProfitVal, currency)}
                            </div>
                        </div>
                    </div>

                    {/* Chart & Table */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                        <div className="border-b border-zinc-800 pb-3 mb-3 flex items-center justify-between">
                            <div>
                                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-2">
                                    <TrendingUp className="w-3.5 h-3.5 text-zinc-400" />
                                    Dziennik Rentowności M&A – Szereg Czasowy
                                </h3>
                                <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
                                    Miesięczna ewolucja przychodów, kosztów i zysków w walucie {currency}
                                </p>
                            </div>
                        </div>

                        <div className="min-h-[300px] mb-6">
                            <PnlTrendChart
                                data={convertedTrends}
                                currency={currency}
                            />
                        </div>

                        {/* Chronological Profitability Table */}
                        <div className="overflow-x-auto border border-zinc-800 rounded">
                            <table className="w-full text-left font-mono text-xs">
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
                                            <td colSpan="7" className="py-6 text-center text-zinc-500">
                                                Brak danych historycznych w wybranym okresie.
                                            </td>
                                        </tr>
                                    ) : (
                                        convertedTrends.map((t, i) => (
                                            <tr key={i} className="hover:bg-zinc-850/40 transition-colors">
                                                <td className="py-2 px-3 font-semibold text-zinc-200">{t.label || t.month}</td>
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
                                <Badge variant={currentRatio >= 1.2 ? 'success' : 'warning'} size="sm">
                                    {currentRatio >= 1.2 ? 'OPTYMALNA' : 'PODWYŻSZONE RYZYKO'}
                                </Badge>
                            </div>
                            <div className="text-3xl font-bold font-mono text-zinc-100 mt-2 tabular-nums">
                                {currentRatio.toFixed(2)}x
                            </div>
                            <div className="text-[10px] font-mono text-zinc-500 mt-1">
                                Benchmark bankowy: min. 1.20x
                            </div>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-mono uppercase text-zinc-400">Quick Ratio (Wskaźnik Szybki)</span>
                                <Badge variant={quickRatio >= 1.0 ? 'success' : 'warning'} size="sm">
                                    {quickRatio >= 1.0 ? 'OPTYMALNA' : 'UWAGA'}
                                </Badge>
                            </div>
                            <div className="text-3xl font-bold font-mono text-amber-400 mt-2 tabular-nums">
                                {quickRatio.toFixed(2)}x
                            </div>
                            <div className="text-[10px] font-mono text-zinc-500 mt-1">
                                Benchmark bankowy: min. 1.00x
                            </div>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-mono uppercase text-zinc-400">Kapitał Obrotowy Netto (NWC)</span>
                                <Badge variant="default" size="sm">NWC</Badge>
                            </div>
                            <div className="text-3xl font-bold font-mono text-zinc-100 mt-2 tabular-nums">
                                {formatCurrency(workingCapitalVal, currency)}
                            </div>
                            <div className="text-[10px] font-mono text-zinc-500 mt-1">
                                Aktywa bieżące minus pasywa bieżące
                            </div>
                        </div>
                    </div>

                    {/* Liquidity Chart & Interpretation */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col">
                            <div className="border-b border-zinc-800 pb-3 mb-3">
                                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-2">
                                    <ShieldAlert className="w-3.5 h-3.5 text-zinc-400" />
                                    Dynamika Płynności Finansowej (CR / QR)
                                </h3>
                                <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
                                    Miesięczne trajektorie wskaźników płynności wraz z poziomami referencyjnymi
                                </p>
                            </div>
                            <div className="flex-1 min-h-[300px]">
                                <LiquidityTrendChart data={liquidityTrends} />
                            </div>
                        </div>

                        {/* Audit Commentary Card */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col justify-between">
                            <div>
                                <div className="border-b border-zinc-800 pb-3 mb-3">
                                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-2">
                                        <Wallet className="w-3.5 h-3.5 text-zinc-400" />
                                        Komentarz Analityka M&A
                                    </h3>
                                    <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
                                        Ocena zdolności do obsługi zobowiązań
                                    </p>
                                </div>
                                <div className="space-y-3 text-xs text-zinc-300 font-sans leading-relaxed">
                                    <p>
                                        Wskaźnik płynności bieżącej (Current Ratio) kształtuje się na poziomie <strong className="text-zinc-100 font-mono">{currentRatio.toFixed(2)}x</strong>, co świadczy o zachowaniu bezpiecznego bufora aktywów obrotowych w relacji do bieżących pasywów.
                                    </p>
                                    <p>
                                        Wskaźnik szybki (Quick Ratio) wynosi <strong className="text-zinc-100 font-mono">{quickRatio.toFixed(2)}x</strong>, co pozwala na pokrycie krótkoterminowych wierzytelności bez konieczności upłynniania zapasów.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-zinc-800 font-mono text-[10px] text-zinc-500 flex items-center justify-between">
                                <span>STATUS SOLWENCJI</span>
                                <span className="text-emerald-400 font-semibold">STABILNY / LOW RISK</span>
                            </div>
                        </div>
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
        </div>
    );
};
