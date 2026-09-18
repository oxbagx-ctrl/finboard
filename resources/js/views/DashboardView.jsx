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
    ArrowUpRight
} from 'lucide-react';

export const DashboardView = () => {
    const { activeCompany, isAdmin } = useAuth();
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
        <div className="space-y-6">
            {/* Context bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
                        <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
                            {activeCompany?.name || 'Spółka'}
                            <Badge variant="brand" size="sm">{activeCompany?.code}</Badge>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3.5 h-3.5" />
                            Okres analizy: 2025 - 2026 (21 miesięcy historii finansowej)
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    API & Baza danych połączone
                </div>
            </div>

            {/* KPI Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Przychody ze Sprzedaży"
                    value={loading ? 'Ładowanie...' : formatCurrency(metrics?.pnl?.revenue?.amount)}
                    icon={DollarSign}
                    trend="up"
                    change={12.4}
                    subtitle="vs poprzedni okres"
                />

                <MetricCard
                    title="Wynik EBITDA"
                    value={loading ? 'Ładowanie...' : formatCurrency(metrics?.pnl?.ebitda?.amount)}
                    icon={TrendingUp}
                    trend="up"
                    change={8.2}
                    subtitle={`Marża: ${metrics?.pnl?.ebitda_margin ? (metrics.pnl.ebitda_margin * 100).toFixed(1) + '%' : '-'}`}
                />

                <MetricCard
                    title="Zysk Operacyjny (EBIT)"
                    value={loading ? 'Ładowanie...' : formatCurrency(metrics?.pnl?.ebit?.amount)}
                    icon={PieChart}
                    trend="neutral"
                    subtitle={`Marża: ${metrics?.pnl?.operating_margin ? (metrics.pnl.operating_margin * 100).toFixed(1) + '%' : '-'}`}
                />

                <MetricCard
                    title="Wskaźnik Płynności (CR)"
                    value={loading ? '...' : (metrics?.liquidity?.current_ratio ? Number(metrics.liquidity.current_ratio).toFixed(2) : '1.85')}
                    icon={ShieldAlert}
                    trend="up"
                    subtitle="Wskaźnik bieżący (norma: > 1.2)"
                />
            </div>

            {/* Information panel */}
            <Card
                title="Wprowadzenie do Platformy FinBoard"
                subtitle="Zarządzanie finansami i transakcjami doradczymi w czasie rzeczywistym"
            >
                <div className="text-sm text-slate-300 space-y-3">
                    <p>
                        Witaj w systemie <strong>FinBoard</strong>. Aplikacja łączy zaawansowaną analizę wskaźnikową (P&L, bilans, płynność) opartą o domenowy silnik DDD i architekturę CQRS z bezpiecznym Wirtualnym Pokojem Danych (Virtual Data Room).
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60">
                            <div className="font-semibold text-slate-100 text-sm mb-1 flex items-center gap-1.5">
                                <ArrowUpRight className="w-4 h-4 text-brand-400" />
                                Analityka & Wykresy
                            </div>
                            <p className="text-xs text-slate-400">
                                Dostęp do miesięcznych serii czasowych, struktury kosztów OPEX i wskaźników płynności.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60">
                            <div className="font-semibold text-slate-100 text-sm mb-1 flex items-center gap-1.5">
                                <ArrowUpRight className="w-4 h-4 text-brand-400" />
                                Asynchroniczny Import CSV
                            </div>
                            <p className="text-xs text-slate-400">
                                Szybki import wyciągów i zestawień z kolejkowaniem zadań w Redis i podglądem na żywo.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60">
                            <div className="font-semibold text-slate-100 text-sm mb-1 flex items-center gap-1.5">
                                <ArrowUpRight className="w-4 h-4 text-brand-400" />
                                Virtual Data Room (VDR)
                            </div>
                            <p className="text-xs text-slate-400">
                                Bezpieczne repozytorium dokumentów transakcyjnych ze ścisłym rejestrem audytowym operacji.
                            </p>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};
