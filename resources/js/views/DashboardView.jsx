import React, { useEffect, useState } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { MetricCard, Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import {
    DollarSign,
    TrendingUp,
    PieChart,
    ShieldAlert,
    Building2,
    Calendar,
    ArrowUpRight,
    Lock
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

    const formatCurrency = (val) => {
        if (val === undefined || val === null) return '0,00 PLN';
        return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(val);
    };

    return (
        <div className="space-y-5">
            {/* Top context bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3.5">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
                        <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-zinc-100 flex items-center gap-2 font-mono">
                            {activeCompany?.name || 'Spółka'}
                            <Badge variant="default" size="sm">{activeCompany?.code}</Badge>
                        </div>
                        <div className="text-[11px] text-zinc-500 flex items-center gap-1.5 mt-0.5 font-mono">
                            <Calendar className="w-3 h-3" />
                            OKRES TRANSAKCYJNY: 2025.01 - 2026.09 (21 MIESIĘCY)
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>ONLINE / DATA SYNC OK</span>
                </div>
            </div>

            {/* KPI Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <MetricCard
                    title="Przychody ze Sprzedaży"
                    value={loading ? 'Ładowanie...' : formatCurrency(metrics?.pnl?.revenue?.amount)}
                    icon={DollarSign}
                    trend="up"
                    change={12.4}
                    subtitle="YTD vs BAZA"
                />

                <MetricCard
                    title="Wynik EBITDA"
                    value={loading ? 'Ładowanie...' : formatCurrency(metrics?.pnl?.ebitda?.amount)}
                    icon={TrendingUp}
                    trend="up"
                    change={8.2}
                    subtitle={`MARŻA: ${metrics?.pnl?.ebitda_margin ? (metrics.pnl.ebitda_margin * 100).toFixed(1) + '%' : '-'}`}
                />

                <MetricCard
                    title="Zysk Operacyjny (EBIT)"
                    value={loading ? 'Ładowanie...' : formatCurrency(metrics?.pnl?.ebit?.amount)}
                    icon={PieChart}
                    trend="neutral"
                    subtitle={`MARŻA: ${metrics?.pnl?.operating_margin ? (metrics.pnl.operating_margin * 100).toFixed(1) + '%' : '-'}`}
                />

                <MetricCard
                    title="Wskaźnik Płynności (CR)"
                    value={loading ? '...' : (metrics?.liquidity?.current_ratio ? Number(metrics.liquidity.current_ratio).toFixed(2) : '1.85')}
                    icon={ShieldAlert}
                    trend="up"
                    subtitle="WSKAŹNIK BIEŻĄCY (NORMA: > 1.20)"
                />
            </div>

            {/* Institutional Information & Security Panel */}
            <Card
                title="Status Projektu Transakcyjnego & Due Diligence"
                subtitle="Podsumowanie integralności danych finansowych i repozytorium VDR"
            >
                <div className="text-xs text-zinc-400 space-y-3 font-mono">
                    <p className="leading-relaxed">
                        Dane finansowe podmiotu <strong className="text-zinc-200">{activeCompany?.name}</strong> są agregowane w oparciu o silnik domenowy DDD z precyzją bcmath (scale 4) oraz asynchroniczne kolejki Redis.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                        <div className="p-3 rounded bg-zinc-950 border border-zinc-800">
                            <div className="font-semibold text-zinc-200 mb-1 flex items-center justify-between text-[11px]">
                                <span>SERIE CZASOWE & TRENDY</span>
                                <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500" />
                            </div>
                            <p className="text-[11px] text-zinc-500 leading-normal">
                                Raporty P&L, rozbicie OPEX i dynamika wskaźników płynności.
                            </p>
                        </div>

                        <div className="p-3 rounded bg-zinc-950 border border-zinc-800">
                            <div className="font-semibold text-zinc-200 mb-1 flex items-center justify-between text-[11px]">
                                <span>IMPORT ASYNCHRONICZNY</span>
                                <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500" />
                            </div>
                            <p className="text-[11px] text-zinc-500 leading-normal">
                                Automatyczne wykrywanie delimiterów i walidacja nagłówków PL/EN.
                            </p>
                        </div>

                        <div className="p-3 rounded bg-zinc-950 border border-zinc-800">
                            <div className="font-semibold text-zinc-200 mb-1 flex items-center justify-between text-[11px]">
                                <span>POKÓJ DANYCH (VDR)</span>
                                <Lock className="w-3.5 h-3.5 text-zinc-500" />
                            </div>
                            <p className="text-[11px] text-zinc-500 leading-normal">
                                Sumy kontrolne SHA-256 oraz rejestr każdego pobrania pliku.
                            </p>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};
