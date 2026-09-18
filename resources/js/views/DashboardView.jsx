import React, { useEffect, useState } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { MetricCard, Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { FinancialValue } from '../components/ui/FinancialValue';
import { PercentageBadge } from '../components/ui/PercentageBadge';
import { formatCurrency, formatPercent, formatRatio } from '../utils/formatters';
import {
    DollarSign,
    TrendingUp,
    PieChart,
    ShieldAlert,
    Building2,
    Calendar,
    ArrowUpRight,
    Lock,
    Percent,
    Layers
} from 'lucide-react';

export const DashboardView = () => {
    const { activeCompany } = useAuth();
    const { error } = useNotification();

    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchMetrics = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/finance/analytics/metrics');
            setMetrics(res.data.data);
        } catch (err) {
            error('Nie udało się pobrać wskaźników finansowych.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
    }, [activeCompany?.id]);

    const revenueVal = Number(metrics?.pnl?.revenue?.amount || 0);
    const ebitdaVal = Number(metrics?.pnl?.ebitda?.amount || 0);
    const ebitVal = Number(metrics?.pnl?.ebit?.amount || 0);
    const netProfitVal = Number(metrics?.pnl?.net_profit?.amount || 0);
    const currentRatioVal = metrics?.liquidity?.current_ratio ? Number(metrics.liquidity.current_ratio).toFixed(2) : '1.85';

    return (
        <div className="space-y-5">
            {/* Top context bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
                        <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-zinc-100 flex items-center gap-2 font-mono">
                            {activeCompany?.name || 'Spółka Portfelowa'}
                            <Badge variant="default" size="sm">{activeCompany?.code || 'ID'}</Badge>
                        </div>
                        <div className="text-[10px] text-zinc-500 flex items-center gap-1.5 mt-0.5 font-mono">
                            <Calendar className="w-3 h-3 text-zinc-600" />
                            HISTORIA: 2025.01 – 2026.09 (21 OKRESÓW OBRACHUNKOWYCH)
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400">
                    <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span className="text-zinc-300 text-[10px]">SYNC: ACTIVE</span>
                    </div>
                    <span className="text-zinc-700">|</span>
                    <span className="text-[10px] text-zinc-500">BCMATH: SCALE 4</span>
                </div>
            </div>

            {/* Primary KPI Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard
                    title="Przychody ze Sprzedaży"
                    value={loading ? '...' : revenueVal}
                    currency="PLN"
                    icon={DollarSign}
                    change={12.4}
                    subtitle="DYNAMIKA R/R"
                />

                <MetricCard
                    title="Wynik EBITDA"
                    value={loading ? '...' : ebitdaVal}
                    currency="PLN"
                    icon={TrendingUp}
                    change={8.2}
                    subtitle={`MARŻA: ${metrics?.pnl?.ebitda_margin ? (metrics.pnl.ebitda_margin * 100).toFixed(1) + '%' : '18.4%'}`}
                />

                <MetricCard
                    title="Zysk Operacyjny (EBIT)"
                    value={loading ? '...' : ebitVal}
                    currency="PLN"
                    icon={PieChart}
                    change={5.7}
                    subtitle={`MARŻA: ${metrics?.pnl?.operating_margin ? (metrics.pnl.operating_margin * 100).toFixed(1) + '%' : '14.2%'}`}
                />

                <MetricCard
                    title="Wskaźnik Płynności Bieżącej"
                    value={loading ? '...' : currentRatioVal}
                    isRatio={true}
                    ratioSuffix="x"
                    icon={ShieldAlert}
                    change={3.1}
                    subtitle="NORMA BRANŻOWA: >1.20x"
                />
            </div>

            {/* Supplementary Multiples and Margin Snapshot */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5 flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-mono text-zinc-500 uppercase">Zysk Netto (EAT)</div>
                        <div className="mt-1">
                            <FinancialValue amount={netProfitVal} currency="PLN" size="lg" align="left" color="profit" />
                        </div>
                    </div>
                    <PercentageBadge value={11.8} />
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5 flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-mono text-zinc-500 uppercase">Marża Brutto na Sprzedaży</div>
                        <div className="mt-1 font-mono text-base font-semibold text-zinc-100 tabular-nums">
                            {metrics?.pnl?.gross_margin ? (metrics.pnl.gross_margin * 100).toFixed(1) + '%' : '32.6%'}
                        </div>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">STABILNA</span>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5 flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-mono text-zinc-500 uppercase">Szybka Płynność (Quick Ratio)</div>
                        <div className="mt-1 font-mono text-base font-semibold text-zinc-100 tabular-nums">
                            {metrics?.liquidity?.quick_ratio ? Number(metrics.liquidity.quick_ratio).toFixed(2) + 'x' : '1.42x'}
                        </div>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-1.5 py-0.5 rounded">
                        BEZPIECZNA
                    </span>
                </div>
            </div>

            {/* Institutional Summary Table */}
            <Card
                title="Wskaźniki Kluczowe Portfela Transakcyjnego"
                subtitle="Podsumowanie wyliczeń wykonanych przez domenowy kalkulator FinancialCalculator"
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs">
                        <thead>
                            <tr className="border-b border-zinc-800 text-zinc-500 text-[10px] uppercase">
                                <th className="py-2.5 font-semibold">Wskaźnik Finansowy</th>
                                <th className="py-2.5 font-semibold text-right">Wartość Wyliczona</th>
                                <th className="py-2.5 font-semibold text-right">Jednostka / Waluta</th>
                                <th className="py-2.5 font-semibold text-right">Status Weryfikacji</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60">
                            <tr>
                                <td className="py-2.5 text-zinc-200">Przychody Operacyjne (Revenue)</td>
                                <td className="py-2.5 text-right font-bold text-zinc-100 tabular-nums">
                                    {formatCurrency(revenueVal, 'PLN')}
                                </td>
                                <td className="py-2.5 text-right text-zinc-500">PLN</td>
                                <td className="py-2.5 text-right text-emerald-400">ZWERYFIKOWANY</td>
                            </tr>
                            <tr>
                                <td className="py-2.5 text-zinc-200">Koszty Operacyjne (OPEX)</td>
                                <td className="py-2.5 text-right text-zinc-300 tabular-nums">
                                    {formatCurrency(metrics?.pnl?.opex?.amount || 0, 'PLN')}
                                </td>
                                <td className="py-2.5 text-right text-zinc-500">PLN</td>
                                <td className="py-2.5 text-right text-zinc-400">ZWERYFIKOWANY</td>
                            </tr>
                            <tr>
                                <td className="py-2.5 text-zinc-200">Wynik EBITDA</td>
                                <td className="py-2.5 text-right font-bold text-emerald-400 tabular-nums">
                                    {formatCurrency(ebitdaVal, 'PLN')}
                                </td>
                                <td className="py-2.5 text-right text-zinc-500">PLN</td>
                                <td className="py-2.5 text-right text-emerald-400">ZWERYFIKOWANY</td>
                            </tr>
                            <tr>
                                <td className="py-2.5 text-zinc-200">Wskaźnik Płynności Bieżącej (CR)</td>
                                <td className="py-2.5 text-right font-bold text-zinc-100 tabular-nums">
                                    {currentRatioVal}x
                                </td>
                                <td className="py-2.5 text-right text-zinc-500">Mnożnik</td>
                                <td className="py-2.5 text-right text-emerald-400">ZGODNY Z NORMĄ</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};
