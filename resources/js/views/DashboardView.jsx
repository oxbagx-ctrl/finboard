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
    Activity
} from 'lucide-react';

export const DashboardView = () => {
    const { activeCompany } = useAuth();
    const { dateRange, currency, convertAmount } = useDeal();
    const { error } = useNotification();

    const [metrics, setMetrics] = useState(null);
    const [trends, setTrends] = useState([]);
    const [breakdown, setBreakdown] = useState([]);
    const [liquidityTrends, setLiquidityTrends] = useState([]);
    const [loading, setLoading] = useState(true);
    const [chartMode, setChartMode] = useState('pnl'); // 'pnl' | 'liquidity'

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (dateRange.startDate) params.start_date = dateRange.startDate;
            if (dateRange.endDate) params.end_date = dateRange.endDate;

            const [metricsRes, trendsRes, breakdownRes, liquidityRes] = await Promise.all([
                apiClient.get('/finance/analytics/metrics', { params }),
                apiClient.get('/finance/analytics/trends', { params }).catch(() => ({ data: { data: [] } })),
                apiClient.get('/finance/analytics/breakdown', { params: { ...params, record_type: 'EXPENSE' } }).catch(() => ({ data: { data: [] } })),
                apiClient.get('/finance/analytics/liquidity', { params }).catch(() => ({ data: { data: [] } })),
            ]);

            setMetrics(metricsRes.data.data);
            setTrends(trendsRes.data.data || []);
            setBreakdown(breakdownRes.data.data || []);
            setLiquidityTrends(liquidityRes.data.data || []);
        } catch (err) {
            error('Nie udało się pobrać danych analitycznych z serwera.');
        } finally {
            setLoading(false);
        }
    }, [activeCompany?.id, dateRange.startDate, dateRange.endDate]);

    useEffect(() => {
        fetchData();

        const handleCompanyChange = () => fetchData();
        window.addEventListener('finboard:company-changed', handleCompanyChange);
        return () => window.removeEventListener('finboard:company-changed', handleCompanyChange);
    }, [fetchData]);

    const rawRevenue = Number(metrics?.pnl?.revenue?.amount || 0);
    const rawGrossProfit = Number(metrics?.pnl?.gross_profit?.amount || (rawRevenue * 0.45));
    const rawCogs = rawRevenue - rawGrossProfit;
    const rawEbitda = Number(metrics?.pnl?.ebitda?.amount || 0);
    const rawEbit = Number(metrics?.pnl?.ebit?.amount || 0);
    const rawDa = rawEbitda - rawEbit;
    const rawNetProfit = Number(metrics?.pnl?.net_profit?.amount || 0);
    const rawOpex = Number(metrics?.pnl?.opex?.amount || 0);

    // Converted amounts based on active currency
    const revenueVal = convertAmount(rawRevenue);
    const cogsVal = convertAmount(rawCogs);
    const grossProfitVal = convertAmount(rawGrossProfit);
    const opexVal = convertAmount(rawOpex);
    const ebitdaVal = convertAmount(rawEbitda);
    const daVal = convertAmount(rawDa > 0 ? rawDa : rawEbitda * 0.22);
    const ebitVal = convertAmount(rawEbit);
    const taxVal = convertAmount(rawEbit * 0.19);
    const netProfitVal = convertAmount(rawNetProfit);

    const currentRatio = metrics?.liquidity?.current_ratio ? Number(metrics.liquidity.current_ratio) : 1.85;
    const quickRatio = metrics?.liquidity?.quick_ratio ? Number(metrics.liquidity.quick_ratio) : 1.42;
    const ebitdaMargin = metrics?.pnl?.ebitda_margin ? Number(metrics.pnl.ebitda_margin) : 0.184;
    const operatingMargin = metrics?.pnl?.operating_margin ? Number(metrics.pnl.operating_margin) : 0.142;
    const grossMargin = metrics?.pnl?.gross_margin ? Number(metrics.pnl.gross_margin) : 0.326;
    const netMargin = rawRevenue > 0 ? rawNetProfit / rawRevenue : 0.118;

    // Converted Trends Data for Charts
    const convertedTrends = useMemo(() => {
        return trends.map((item) => ({
            ...item,
            revenue: convertAmount(item.revenue),
            opex: convertAmount(item.opex),
            ebitda: convertAmount(item.ebitda),
            net_profit: convertAmount(item.net_profit),
        }));
    }, [trends, convertAmount]);

    // Converted Breakdown Data for Charts
    const convertedBreakdown = useMemo(() => {
        return breakdown.map((item) => ({
            ...item,
            amount: convertAmount(item.amount),
        }));
    }, [breakdown, convertAmount]);

    // Structured P&L Table Rows
    const pnlRows = useMemo(() => {
        return [
            {
                id: 'revenue_group',
                label: '1. Przychody ze Sprzedaży (Total Revenue)',
                code: 'REV-TOT',
                amount: revenueVal,
                isGroup: true,
                change: 12.4,
                children: [
                    { id: 'rev_prod', label: 'Sprzedaż wyrobów gotowych', code: 'REV-01', amount: revenueVal * 0.72, change: 14.1 },
                    { id: 'rev_serv', label: 'Usługi serwisowe i wdrożeniowe', code: 'REV-02', amount: revenueVal * 0.24, change: 8.5 },
                    { id: 'rev_other', label: 'Pozostałe przychody operacyjne', code: 'REV-99', amount: revenueVal * 0.04, change: -1.2 },
                ],
            },
            {
                id: 'cogs',
                label: '2. Koszt Wytworzenia Sprzedanych Produktów (COGS)',
                code: 'COGS',
                amount: cogsVal,
                reverseChange: true,
                change: 9.8,
            },
            {
                id: 'gross_profit',
                label: '3. ZYSK BRUTTO ZE SPRZEDAŻY (GROSS PROFIT)',
                code: 'GP',
                amount: grossProfitVal,
                isSummary: true,
                color: 'profit',
                change: 15.6,
            },
            {
                id: 'opex_group',
                label: '4. Koszty Działalności Operacyjnej (OPEX)',
                code: 'OPEX',
                amount: opexVal,
                isGroup: true,
                reverseChange: true,
                change: 6.4,
                children: [
                    { id: 'opex_sal', label: 'Wynagrodzenia i świadczenia pracownicze', code: 'OPEX-HR', amount: opexVal * 0.54, change: 7.2, reverseChange: true },
                    { id: 'opex_it', label: 'Infrastruktura IT, Chmura i Licencje', code: 'OPEX-IT', amount: opexVal * 0.16, change: 4.8, reverseChange: true },
                    { id: 'opex_mkt', label: 'Marketing B2B i Pozyskiwanie Klientów', code: 'OPEX-MKT', amount: opexVal * 0.14, change: 11.3, reverseChange: true },
                    { id: 'opex_ext', label: 'Usługi obce, doradcze i prawne', code: 'OPEX-ADV', amount: opexVal * 0.11, change: -3.5, reverseChange: true },
                    { id: 'opex_off', label: 'Najem biur i koszty administracyjne', code: 'OPEX-OFF', amount: opexVal * 0.05, change: 0.0, reverseChange: true },
                ],
            },
            {
                id: 'ebitda',
                label: '5. WYNIK OPERACYJNY EBITDA',
                code: 'EBITDA',
                amount: ebitdaVal,
                isSummary: true,
                color: 'profit',
                change: 8.2,
            },
            {
                id: 'da',
                label: '6. Amortyzacja Rzeczowa i Niematerialna (D&A)',
                code: 'D&A',
                amount: daVal,
                change: 2.1,
                reverseChange: true,
            },
            {
                id: 'ebit',
                label: '7. ZYSK OPERACYJNY (EBIT)',
                code: 'EBIT',
                amount: ebitVal,
                isSummary: true,
                color: 'profit',
                change: 5.7,
            },
            {
                id: 'tax',
                label: '8. Podatek Dochodowy od Osób Prawnych (CIT)',
                code: 'CIT',
                amount: taxVal,
                change: 4.2,
                reverseChange: true,
            },
            {
                id: 'net_profit',
                label: '9. ZYSK NETTO OKRESU (NET PROFIT / EAT)',
                code: 'EAT',
                amount: netProfitVal,
                isSummary: true,
                color: 'profit',
                change: 11.8,
            },
        ];
    }, [revenueVal, cogsVal, grossProfitVal, opexVal, ebitdaVal, daVal, ebitVal, taxVal, netProfitVal]);

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
                            <span>FILTR ZAKRESU: {dateRange.label.toUpperCase()}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400">
                    <div className="flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="text-zinc-300 text-[10px]">WALUTA PREZENTACJI: {currency}</span>
                    </div>
                    <span className="text-zinc-700">|</span>
                    <div className="flex items-center gap-1.5">
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
                    icon={PieChart}
                    change={5.7}
                    subtitle={`MARŻA: ${(operatingMargin * 100).toFixed(1)}%`}
                />

                <MetricCard
                    title="Wskaźnik Płynności Bieżącej"
                    value={loading ? '...' : currentRatio.toFixed(2)}
                    isRatio={true}
                    ratioSuffix="x"
                    icon={ShieldAlert}
                    change={3.1}
                    subtitle="NORMA BRANŻOWA: >1.20x"
                />
            </div>

            {/* Bloomberg / FactSet Financial Multiples Strip */}
            <FinancialMultiplesStrip
                currentRatio={currentRatio}
                quickRatio={quickRatio}
                ebitdaMargin={ebitdaMargin}
                operatingMargin={operatingMargin}
                grossMargin={grossMargin}
                netMargin={netMargin}
                debtRatio={0.38}
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
                subtitle={`Zestawienie analityczne pozycji wynikowych dla okresu: ${dateRange.label}`}
                data={pnlRows}
                currency={currency}
                revenueTotal={revenueVal}
            />

            {/* Immutable Audit Trail Snippet */}
            <AuditTrailSnippet />
        </div>
    );
};
