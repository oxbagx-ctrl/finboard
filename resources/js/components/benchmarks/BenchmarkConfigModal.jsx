import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
    Sliders,
    X,
    RotateCcw,
    Save,
    AlertCircle,
    CheckCircle2,
    ShieldAlert,
    TrendingUp
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

export const evaluateStatusChip = (actualVal, targetVal, warningVal, higherIsBetter = true) => {
    if (actualVal == null || isNaN(actualVal)) {
        return { status: 'STD', label: 'Standard', className: 'text-zinc-400 bg-zinc-800 border-zinc-700' };
    }
    const val = Number(actualVal);
    const target = Number(targetVal);
    const warning = Number(warningVal);

    if (higherIsBetter) {
        if (val >= target) {
            return { status: 'OPT', label: 'Optymalny', className: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/80' };
        }
        if (val >= warning) {
            return { status: 'WARN', label: 'Ostrzeżenie', className: 'text-amber-400 bg-amber-950/60 border-amber-800/80' };
        }
        return { status: 'CRIT', label: 'Krytyczny', className: 'text-rose-400 bg-rose-950/60 border-rose-800/80' };
    } else {
        if (val <= target) {
            return { status: 'OPT', label: 'Optymalny', className: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/80' };
        }
        if (val <= warning) {
            return { status: 'WARN', label: 'Ostrzeżenie', className: 'text-amber-400 bg-amber-950/60 border-amber-800/80' };
        }
        return { status: 'CRIT', label: 'Krytyczny', className: 'text-rose-400 bg-rose-950/60 border-rose-800/80' };
    }
};

export const BenchmarkConfigModal = ({ isOpen, onClose, onSaved, currentMetrics = null }) => {
    const { activeCompany, isAdmin, isAdvisor } = useAuth();
    const { success, error } = useNotification();

    const [benchmarks, setBenchmarks] = useState(METRIC_DEFAULTS);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [resetting, setResetting] = useState(false);

    const canEdit = isAdmin || isAdvisor;

    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        const fetchBenchmarks = async () => {
            setLoading(true);
            try {
                const response = await apiClient.get('/finance/benchmarks');
                if (isMounted && response.data?.data) {
                    const fetchedList = response.data.data;
                    const merged = METRIC_DEFAULTS.map((def) => {
                        const found = fetchedList.find((b) => b.metric_type === def.metric_type);
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
                    setBenchmarks(merged);
                }
            } catch (err) {
                // Keep defaults if failed
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchBenchmarks();
        return () => {
            isMounted = false;
        };
    }, [isOpen, activeCompany?.id]);

    if (!isOpen) return null;

    const handleFieldChange = (metricType, field, value) => {
        setBenchmarks((prev) =>
            prev.map((item) => {
                if (item.metric_type === metricType) {
                    return { ...item, [field]: value === '' ? '' : Number(value) };
                }
                return item;
            })
        );
    };

    const handleSaveAll = async (e) => {
        if (e) e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                benchmarks: benchmarks.map((b) => ({
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
            if (onSaved) onSaved();
            onClose();
        } catch (err) {
            const msg = err.response?.data?.message || 'Wystąpił błąd podczas zapisywania benchmarków.';
            error(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleResetDefaults = async () => {
        if (!window.confirm('Czy na pewno chcesz przywrócić domyślne standardy rynkowe dla wszystkich wskaźników spółki?')) {
            return;
        }

        setResetting(true);
        try {
            await apiClient.post('/finance/benchmarks/reset');
            setBenchmarks(METRIC_DEFAULTS.map((d) => ({ ...d, is_custom: false })));
            success('Przywrócono domyślne standardy rynkowe.');
            window.dispatchEvent(new CustomEvent('finboard:benchmarks-updated'));
            if (onSaved) onSaved();
        } catch (err) {
            error('Nie udało się przywrócić wartości domyślnych.');
        } finally {
            setResetting(false);
        }
    };

    const getActualValue = (metricKey) => {
        if (!currentMetrics) return null;
        if (metricKey === 'current_ratio') return currentMetrics.liquidity?.current_ratio;
        if (metricKey === 'quick_ratio') return currentMetrics.liquidity?.quick_ratio;
        if (metricKey === 'debt_to_assets') return currentMetrics.solvency?.debt_to_assets;
        if (metricKey === 'gross_margin') return currentMetrics.pnl?.gross_margin_pct ?? (currentMetrics.pnl?.gross_margin ? currentMetrics.pnl.gross_margin * 100 : null);
        if (metricKey === 'ebitda_margin') return currentMetrics.pnl?.ebitda_margin_pct ?? (currentMetrics.pnl?.ebitda_margin ? currentMetrics.pnl.ebitda_margin * 100 : null);
        if (metricKey === 'operating_margin') return currentMetrics.pnl?.operating_margin_pct ?? (currentMetrics.pnl?.operating_margin ? currentMetrics.pnl.operating_margin * 100 : null);
        if (metricKey === 'net_margin') return currentMetrics.pnl?.net_margin_pct ?? (currentMetrics.pnl?.net_margin ? currentMetrics.pnl.net_margin * 100 : null);
        return null;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col font-mono">
                {/* Header */}
                <div className="p-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-200">
                            <Sliders className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-2">
                                <span>Konfigurator Celów i Benchmarków M&A</span>
                                <Badge variant="default" size="sm">{activeCompany?.code || 'PODMIOT'}</Badge>
                            </h2>
                            <p className="text-[11px] text-zinc-500 mt-0.5">
                                Spółka: <strong className="text-zinc-300 font-medium">{activeCompany?.name}</strong> | Standardy Due Diligence & Deal Advisory
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-zinc-500 hover:text-zinc-300 p-1.5 rounded transition-colors"
                        title="Zamknij"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Subheader info / role banner */}
                <div className="px-4 py-2 bg-zinc-950/50 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-zinc-400 gap-2">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        <span>
                            {canEdit
                                ? 'Tryb edycji Doradcy M&A: Zdefiniuj progi docelowe i ostrzegawcze'
                                : 'Tryb podglądu Klienta: Progi zdefiniowane przez Doradcę'}
                        </span>
                    </div>
                    {canEdit && (
                        <button
                            type="button"
                            onClick={handleResetDefaults}
                            disabled={resetting || saving}
                            className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-amber-400 transition-colors"
                        >
                            <RotateCcw className="w-3 h-3" />
                            <span>Przywróć domyślne rynkowe</span>
                        </button>
                    )}
                </div>

                {/* Form Body / Metric Rows */}
                <div className="p-4 overflow-y-auto flex-1 space-y-3">
                    {loading ? (
                        <div className="py-12 text-center text-zinc-500 text-xs">
                            Ładowanie konfiguracji progów benchmarkowych...
                        </div>
                    ) : (
                        benchmarks.map((item) => {
                            const actual = getActualValue(item.metric_key);
                            const chip = evaluateStatusChip(actual, item.target_value, item.warning_threshold, item.higher_is_better);

                            return (
                                <div
                                    key={item.metric_type}
                                    className="p-3.5 bg-zinc-950/40 border border-zinc-800/80 rounded-lg hover:border-zinc-700 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                                >
                                    {/* Left: Metric Info */}
                                    <div className="md:w-5/12">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-zinc-200">{item.label}</span>
                                            {item.is_custom ? (
                                                <span className="text-[9px] px-1 py-0.2 rounded bg-sky-950/60 border border-sky-800/60 text-sky-400 font-bold uppercase">
                                                    CEL DORADCY
                                                </span>
                                            ) : (
                                                <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-850 border border-zinc-750 text-zinc-400 font-bold uppercase">
                                                    STANDARD
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-zinc-500 mt-1 flex items-center gap-3">
                                            <span>Jednostka: <strong className="text-zinc-400">{item.unit}</strong></span>
                                            <span>Relacja: <strong className="text-zinc-400">{item.higher_is_better ? 'Większy = Lepszy (>=)' : 'Mniejszy = Lepszy (<=)'}</strong></span>
                                            {actual != null && (
                                                <span>Aktualnie: <strong className="text-zinc-200">{Number(actual).toFixed(2)}{item.unit}</strong></span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Middle: Inputs */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:w-5/12">
                                        <div>
                                            <label className="block text-[10px] uppercase text-zinc-500 mb-1">
                                                Cel Docelowy
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={item.target_value}
                                                    disabled={!canEdit || saving}
                                                    onChange={(e) => handleFieldChange(item.metric_type, 'target_value', e.target.value)}
                                                    className="w-full bg-zinc-900 border border-zinc-750 rounded px-2.5 py-1.5 text-xs text-zinc-100 font-mono text-right pr-6 focus:border-emerald-500 focus:outline-none disabled:opacity-60"
                                                />
                                                <span className="absolute right-2 top-1.5 text-[10px] text-zinc-500 pointer-events-none">
                                                    {item.unit}
                                                </span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] uppercase text-zinc-500 mb-1">
                                                Próg Ostrzegawczy
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={item.warning_threshold}
                                                    disabled={!canEdit || saving}
                                                    onChange={(e) => handleFieldChange(item.metric_type, 'warning_threshold', e.target.value)}
                                                    className="w-full bg-zinc-900 border border-zinc-750 rounded px-2.5 py-1.5 text-xs text-zinc-100 font-mono text-right pr-6 focus:border-amber-500 focus:outline-none disabled:opacity-60"
                                                />
                                                <span className="absolute right-2 top-1.5 text-[10px] text-zinc-500 pointer-events-none">
                                                    {item.unit}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="hidden sm:block">
                                            <label className="block text-[10px] uppercase text-zinc-500 mb-1">
                                                Próg Krytyczny
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={item.critical_threshold ?? ''}
                                                    disabled={!canEdit || saving}
                                                    onChange={(e) => handleFieldChange(item.metric_type, 'critical_threshold', e.target.value)}
                                                    placeholder="Opcjonalny"
                                                    className="w-full bg-zinc-900 border border-zinc-750 rounded px-2.5 py-1.5 text-xs text-zinc-100 font-mono text-right pr-6 focus:border-rose-500 focus:outline-none disabled:opacity-60 placeholder:text-zinc-600"
                                                />
                                                <span className="absolute right-2 top-1.5 text-[10px] text-zinc-500 pointer-events-none">
                                                    {item.unit}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Dynamic Status Chip */}
                                    <div className="md:w-2/12 flex items-center justify-end gap-2">
                                        <div className="text-right">
                                            <div className="text-[9px] uppercase text-zinc-500 mb-0.5">Podgląd Statusu</div>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${chip.className}`}>
                                                {chip.status} – {chip.label}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between">
                    <div className="text-[11px] text-zinc-500">
                        * Modyfikacje progów natychmiastowo aktualizują semafory statusów na Pulpicie Zarządczym i w Analityce.
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={onClose}
                            disabled={saving}
                            className="text-xs"
                        >
                            Anuluj
                        </Button>
                        {canEdit && (
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={handleSaveAll}
                                loading={saving}
                                className="text-xs font-semibold"
                            >
                                <Save className="w-3.5 h-3.5 mr-1.5" />
                                Zapisz Cele Benchmarków
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
