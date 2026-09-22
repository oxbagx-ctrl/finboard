import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
    ClipboardCheck,
    ShieldCheck,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Clock,
    Scale,
    Wrench,
    TrendingUp,
    Landmark,
    FileSpreadsheet,
    Download,
    Save,
    RotateCcw,
    Search,
    Filter,
    FileCheck2,
    Sparkles,
    ChevronDown,
    ChevronRight,
    Info,
    ExternalLink
} from 'lucide-react';
import { useInvestmentProject } from '../../context/InvestmentProjectContext';
import { useNotification } from '../../context/NotificationContext';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
    calculateInvestmentReadiness,
    DEFAULT_READINESS_CRITERIA,
    READINESS_PRESETS,
    READINESS_PILLARS
} from '../../workers/financialCalculations';
import { getInvestmentWorkerClient } from '../../workers/InvestmentWorkerClient';

/**
 * Phase 45 Commit 222: InvestmentReadinessScorecard Component
 * Comprehensive Institutional Bankability & Readiness Matrix for Credit Committees and Deal Advisory
 */
export const InvestmentReadinessScorecard = ({
    project = null,
    simulationData = null,
    className = ''
}) => {
    const {
        selectedProject: contextProject,
        updateProject,
        loading: projectLoading
    } = useInvestmentProject();

    const { success, error: notifyError } = useNotification();
    const activeProject = project || contextProject;

    // Simulation Data for auto-checking DSCR, Zero-Variance and Equity
    const [workerSimulation, setWorkerSimulation] = useState(null);
    const [simLoading, setSimLoading] = useState(false);

    useEffect(() => {
        if (simulationData) {
            setWorkerSimulation(simulationData);
            return;
        }

        if (!activeProject) {
            setWorkerSimulation(null);
            return;
        }

        let isMounted = true;
        setSimLoading(true);

        const client = getInvestmentWorkerClient();
        const activeAssumptions = activeProject.operating_assumptions;

        client.simulate(activeProject, activeAssumptions, null, 15)
            .then((res) => {
                if (isMounted) setWorkerSimulation(res);
            })
            .catch((err) => {
                console.error('[InvestmentReadinessScorecard] Simulation fetch failed:', err);
            })
            .finally(() => {
                if (isMounted) setSimLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [activeProject, simulationData]);

    const activeSimulation = simulationData || workerSimulation;

    // Load initial criteria from project's saved scorecard or defaults
    const initialSavedCriteria = activeProject?.operating_assumptions?.readiness_scorecard?.criteria;

    const [criteria, setCriteria] = useState(() => {
        if (Array.isArray(initialSavedCriteria) && initialSavedCriteria.length > 0) {
            return initialSavedCriteria;
        }
        return DEFAULT_READINESS_CRITERIA.map(c => ({ ...c }));
    });

    const [activePillarFilter, setActivePillarFilter] = useState('all'); // 'all' | 'legal' | 'technical' | 'market' | 'financial' | 'cp_only' | 'gaps_only'
    const [searchQuery, setSearchQuery] = useState('');
    const [activePreset, setActivePreset] = useState('custom');
    const [saving, setSaving] = useState(false);
    const [expandedNotes, setExpandedNotes] = useState({});

    // Keep criteria in sync when switching projects
    useEffect(() => {
        const saved = activeProject?.operating_assumptions?.readiness_scorecard?.criteria;
        if (Array.isArray(saved) && saved.length > 0) {
            setCriteria(saved);
        } else {
            setCriteria(DEFAULT_READINESS_CRITERIA.map(c => ({ ...c })));
        }
        setActivePreset('custom');
    }, [activeProject?.id]);

    // Recalculate scorecard in real-time
    const scorecardResult = useMemo(() => {
        return calculateInvestmentReadiness(activeProject, activeSimulation, criteria);
    }, [activeProject, activeSimulation, criteria]);

    // Update single criterion status
    const handleStatusChange = useCallback((id, newStatus) => {
        setCriteria((prev) =>
            prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
        );
        setActivePreset('custom');
    }, []);

    // Update criterion audit notes
    const handleNotesChange = useCallback((id, newNotes) => {
        setCriteria((prev) =>
            prev.map((item) => (item.id === id ? { ...item, notes: newNotes } : item))
        );
    }, []);

    const toggleNotesExpanded = useCallback((id) => {
        setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }));
    }, []);

    // Apply Readiness Stage Preset
    const applyPreset = useCallback((presetKey) => {
        const preset = READINESS_PRESETS[presetKey];
        if (!preset) return;

        setActivePreset(presetKey);
        setCriteria((prev) =>
            prev.map((item) => {
                const override = preset.statusOverrides[item.id];
                return override ? { ...item, status: override } : item;
            })
        );
    }, []);

    // Reset to Default Matrix
    const resetToDefaults = useCallback(() => {
        setCriteria(DEFAULT_READINESS_CRITERIA.map(c => ({ ...c })));
        setActivePreset('custom');
        success('Przywrócono domyślną matrycę kryteriów bankowalności.');
    }, [success]);

    // Save Scorecard to Project (operating_assumptions.readiness_scorecard)
    const handleSaveScorecard = async () => {
        if (!activeProject?.id || !updateProject) return;

        setSaving(true);
        try {
            const currentAssumptions = activeProject.operating_assumptions || {};
            const payload = {
                operating_assumptions: {
                    ...currentAssumptions,
                    readiness_scorecard: {
                        overallScore: scorecardResult.overallScore,
                        bankabilityStatus: scorecardResult.bankabilityStatus,
                        savedAt: new Date().toISOString(),
                        criteria
                    }
                }
            };

            await updateProject(activeProject.id, payload);
            success('Ocena gotowości inwestycyjnej (Readiness Scorecard) została zapisana w projekcie.');
        } catch (err) {
            console.error('[InvestmentReadinessScorecard] Save failed:', err);
            notifyError('Wystąpił błąd podczas zapisywania oceny gotowości.');
        } finally {
            setSaving(false);
        }
    };

    // Export Scorecard to CSV
    const exportToCsv = () => {
        const headers = [
            'Filar',
            'Kod Kryterium',
            'Nazwa Wymogu',
            'Opis Audytowy',
            'Waga (Pkt)',
            'Status',
            'Warunek Zawieszający (CP)',
            'Punkty Przyznane',
            'Notatki Audytora'
        ];

        const rows = criteria.map((c) => {
            const earned = c.status === 'passed' ? c.weight : (c.status === 'in_progress' ? c.weight * 0.5 : 0);
            return [
                `"${READINESS_PILLARS[c.pillar]?.title || c.pillar}"`,
                `"${c.id}"`,
                `"${c.name.replace(/"/g, '""')}"`,
                `"${c.description.replace(/"/g, '""')}"`,
                c.weight,
                `"${c.status}"`,
                c.isConditionPrecedent ? 'TAK' : 'NIE',
                earned,
                `"${(c.notes || '').replace(/"/g, '""')}"`
            ].join(';');
        });

        const summaryRow = [
            '"PODSUMOWANIE"',
            '""',
            `"WYNIK ŁĄCZNY: ${scorecardResult.overallScore}/100 PKT"`,
            `"STATUS: ${scorecardResult.statusLabel}"`,
            scorecardResult.totalMaxPoints,
            '""',
            `"CP: ${scorecardResult.conditionsPrecedent.passedCount}/${scorecardResult.conditionsPrecedent.totalCount}"`,
            scorecardResult.totalEarnedPoints,
            '""'
        ].join(';');

        const csvContent = '\uFEFF' + [headers.join(';'), ...rows, summaryRow].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute(
            'download',
            `readiness-scorecard-${activeProject?.name ? activeProject.name.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'project'}.csv`
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Filtered criteria list
    const filteredCriteria = useMemo(() => {
        return criteria.filter((item) => {
            // Pillar filter
            if (activePillarFilter === 'cp_only' && !item.isConditionPrecedent) {
                return false;
            }
            if (activePillarFilter === 'gaps_only' && (item.status === 'passed' || item.status === 'na')) {
                return false;
            }
            if (['legal', 'technical', 'market', 'financial'].includes(activePillarFilter) && item.pillar !== activePillarFilter) {
                return false;
            }

            // Search filter
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase().trim();
                const matchName = item.name.toLowerCase().includes(query);
                const matchDesc = item.description.toLowerCase().includes(query);
                const matchNotes = (item.notes || '').toLowerCase().includes(query);
                if (!matchName && !matchDesc && !matchNotes) {
                    return false;
                }
            }

            return true;
        });
    }, [criteria, activePillarFilter, searchQuery]);

    if (!activeProject) {
        return (
            <div className="p-8 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-500 font-mono text-center">
                Brak aktywnego projektu do oceny gotowości inwestycyjnej.
            </div>
        );
    }

    const {
        overallScore,
        bankabilityStatus,
        statusLabel,
        recommendation,
        pillars,
        conditionsPrecedent,
        redFlags
    } = scorecardResult;

    // Status Styling & Colors
    const getStatusTheme = () => {
        switch (bankabilityStatus) {
            case 'bankable':
                return {
                    border: 'border-emerald-500/40',
                    bg: 'bg-emerald-500/10',
                    text: 'text-emerald-400',
                    progress: 'bg-emerald-500',
                    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                    icon: CheckCircle2,
                };
            case 'conditional':
                return {
                    border: 'border-amber-500/40',
                    bg: 'bg-amber-500/10',
                    text: 'text-amber-400',
                    progress: 'bg-amber-500',
                    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                    icon: AlertTriangle,
                };
            case 'in_preparation':
                return {
                    border: 'border-orange-500/40',
                    bg: 'bg-orange-500/10',
                    text: 'text-orange-400',
                    progress: 'bg-orange-500',
                    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
                    icon: Clock,
                };
            case 'unbankable':
            default:
                return {
                    border: 'border-rose-500/40',
                    bg: 'bg-rose-500/10',
                    text: 'text-rose-400',
                    progress: 'bg-rose-500',
                    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
                    icon: XCircle,
                };
        }
    };

    const statusTheme = getStatusTheme();
    const StatusIcon = statusTheme.icon;

    return (
        <div className={`space-y-6 font-mono ${className}`} data-testid="investment-readiness-scorecard">
            {/* Top Bar: Title, Presets, Actions */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                        <ClipboardCheck className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                AUDYT INWESTYCYJNY & BANKOWALNOŚĆ (LMA)
                            </span>
                            <span className="text-zinc-600">//</span>
                            <span className="text-[10px] text-emerald-400 font-semibold uppercase">
                                INVESTMENT READINESS SCORECARD
                            </span>
                        </div>
                        <h2 className="text-sm sm:text-base font-bold text-zinc-100 flex items-center gap-2">
                            <span>Karta Oceny Gotowości Inwestycyjnej</span>
                            <span className="text-zinc-500 text-xs font-normal">| {activeProject.name}</span>
                        </h2>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Preset Stage Selector */}
                    <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg p-1 text-[11px]">
                        <span className="text-[10px] text-zinc-500 uppercase px-1.5">Preset:</span>
                        {Object.entries(READINESS_PRESETS).map(([key, p]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => applyPreset(key)}
                                className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                                    activePreset === key
                                        ? 'bg-zinc-800 text-zinc-100 font-bold shadow-xs'
                                        : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                                title={p.description}
                            >
                                {p.label.split(' ')[0]}
                            </button>
                        ))}
                    </div>

                    {/* Reset Button */}
                    <button
                        type="button"
                        onClick={resetToDefaults}
                        className="p-1.5 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 rounded-md transition-colors"
                        title="Przywróć domyślne kryteria"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>

                    {/* Export CSV */}
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={exportToCsv}
                        className="gap-1.5 text-xs"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span>Eksportuj CSV</span>
                    </Button>

                    {/* Save Scorecard */}
                    <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleSaveScorecard}
                        disabled={saving || projectLoading}
                        className="gap-1.5 text-xs"
                    >
                        <Save className="w-3.5 h-3.5" />
                        <span>{saving ? 'Zapisywanie...' : 'Zapisz Ocenę'}</span>
                    </Button>
                </div>
            </div>

            {/* Main Scorecard Institutional Banner */}
            <div className={`p-5 sm:p-6 rounded-xl border ${statusTheme.border} ${statusTheme.bg} bg-opacity-40 shadow-xl transition-all`}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* Left: Overall Score Dial & Status */}
                    <div className="flex items-center gap-5">
                        <div className="relative w-24 h-24 shrink-0 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex flex-col items-center justify-center shadow-inner">
                            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">SCORE</span>
                            <span className={`text-3xl font-extrabold tracking-tight ${statusTheme.text}`} data-testid="overall-score-display">
                                {overallScore}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-medium">/ 100 pkt</span>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs font-bold tracking-wider ${statusTheme.badge}`} data-testid="bankability-badge">
                                    <StatusIcon className="w-4 h-4" />
                                    <span>{statusLabel}</span>
                                </span>
                                <span className="text-[11px] text-zinc-400">
                                    ({scorecardResult.totalEarnedPoints} / {scorecardResult.totalMaxPoints} pkt ważonych)
                                </span>
                            </div>

                            <p className="text-xs text-zinc-300 max-w-2xl leading-relaxed">
                                {recommendation}
                            </p>
                        </div>
                    </div>

                    {/* Right: Quick Bankability Gauges */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
                        {/* Conditions Precedent Tile */}
                        <div className="bg-zinc-950/80 border border-zinc-800 rounded-lg p-2.5 text-center min-w-[110px]">
                            <div className="text-[10px] text-zinc-500 uppercase font-semibold">Warunki CP</div>
                            <div className="text-sm font-bold text-zinc-100 mt-0.5">
                                {conditionsPrecedent.passedCount} / {conditionsPrecedent.totalCount}
                            </div>
                            <div className={`text-[10px] mt-0.5 font-medium ${conditionsPrecedent.pendingCount === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {conditionsPrecedent.pendingCount === 0 ? 'Wszystkie spełnione' : `${conditionsPrecedent.pendingCount} w toku / brak`}
                            </div>
                        </div>

                        {/* Critical Red Flags Tile */}
                        <div className="bg-zinc-950/80 border border-zinc-800 rounded-lg p-2.5 text-center min-w-[110px]">
                            <div className="text-[10px] text-zinc-500 uppercase font-semibold">Red Flags</div>
                            <div className={`text-sm font-bold mt-0.5 ${redFlags.length === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {redFlags.length}
                            </div>
                            <div className="text-[10px] text-zinc-400 mt-0.5 font-medium">
                                {redFlags.length === 0 ? 'Brak blokad' : 'Krytyczne braki'}
                            </div>
                        </div>

                        {/* Automated Verification Status */}
                        <div className="bg-zinc-950/80 border border-zinc-800 rounded-lg p-2.5 text-center min-w-[110px] col-span-2 sm:col-span-1">
                            <div className="text-[10px] text-zinc-500 uppercase font-semibold">Model 3-State</div>
                            <div className="text-sm font-bold text-emerald-400 mt-0.5 flex items-center justify-center gap-1">
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>LMA Sync</span>
                            </div>
                            <div className="text-[10px] text-zinc-400 mt-0.5">
                                Zero-Variance OK
                            </div>
                        </div>
                    </div>
                </div>

                {/* Progress Bar under Banner */}
                <div className="mt-5 pt-4 border-t border-zinc-800/80 flex items-center gap-4">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 shrink-0">POSTĘP DOJRZAŁOŚCI:</span>
                    <div className="w-full bg-zinc-950 rounded-full h-2.5 overflow-hidden border border-zinc-800/60 flex">
                        <div
                            className={`h-full transition-all duration-300 ${statusTheme.progress}`}
                            style={{ width: `${overallScore}%` }}
                        />
                    </div>
                    <span className="text-xs font-bold text-zinc-200 shrink-0">{overallScore}%</span>
                </div>
            </div>

            {/* 4 Pillar Breakdown Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(pillars).map(([pKey, pScore]) => {
                    const getPillarIcon = () => {
                        switch (pKey) {
                            case 'legal': return Scale;
                            case 'technical': return Wrench;
                            case 'market': return TrendingUp;
                            case 'financial': return Landmark;
                            default: return FileCheck2;
                        }
                    };
                    const PIcon = getPillarIcon();

                    const isCompliant = pScore.status === 'compliant';
                    const isWarning = pScore.status === 'warning';

                    return (
                        <div
                            key={pKey}
                            onClick={() => setActivePillarFilter(activePillarFilter === pKey ? 'all' : pKey)}
                            className={`p-4 rounded-xl border transition-all cursor-pointer ${
                                activePillarFilter === pKey
                                    ? 'bg-zinc-850 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/30'
                                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
                                        isCompliant ? 'bg-emerald-500/10 text-emerald-400' : isWarning ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'
                                    }`}>
                                        <PIcon className="w-4 h-4" />
                                    </div>
                                    <span className="text-xs font-bold text-zinc-200 uppercase tracking-wide">
                                        {pKey}
                                    </span>
                                </div>
                                <span className={`text-xs font-extrabold ${isCompliant ? 'text-emerald-400' : isWarning ? 'text-amber-400' : 'text-rose-400'}`}>
                                    {pScore.percentage}%
                                </span>
                            </div>

                            <div className="text-[11px] font-semibold text-zinc-300 truncate mb-1">
                                {pScore.title.split(' ')[0]}
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-2">
                                <span>Punkty: {pScore.earnedPoints} / {pScore.maxPoints}</span>
                                <span>Spełnione: {pScore.passedCount}/{pScore.criteriaCount}</span>
                            </div>

                            <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-300 ${
                                        isCompliant ? 'bg-emerald-500' : isWarning ? 'bg-amber-500' : 'bg-rose-500'
                                    }`}
                                    style={{ width: `${pScore.percentage}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Interactive Criteria Audit Section */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
                {/* Section Controls Toolbar */}
                <div className="p-4 bg-zinc-950/60 border-b border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setActivePillarFilter('all')}
                            className={`px-2.5 py-1 text-xs rounded transition-all cursor-pointer ${
                                activePillarFilter === 'all'
                                    ? 'bg-zinc-800 text-zinc-100 font-bold shadow-xs'
                                    : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            Wszystkie ({criteria.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActivePillarFilter('legal')}
                            className={`px-2.5 py-1 text-xs rounded transition-all cursor-pointer ${
                                activePillarFilter === 'legal'
                                    ? 'bg-zinc-800 text-zinc-100 font-bold shadow-xs'
                                    : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            Formalno-Prawne (4)
                        </button>
                        <button
                            type="button"
                            onClick={() => setActivePillarFilter('technical')}
                            className={`px-2.5 py-1 text-xs rounded transition-all cursor-pointer ${
                                activePillarFilter === 'technical'
                                    ? 'bg-zinc-800 text-zinc-100 font-bold shadow-xs'
                                    : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            Techniczne (4)
                        </button>
                        <button
                            type="button"
                            onClick={() => setActivePillarFilter('market')}
                            className={`px-2.5 py-1 text-xs rounded transition-all cursor-pointer ${
                                activePillarFilter === 'market'
                                    ? 'bg-zinc-800 text-zinc-100 font-bold shadow-xs'
                                    : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            Rynkowe (4)
                        </button>
                        <button
                            type="button"
                            onClick={() => setActivePillarFilter('financial')}
                            className={`px-2.5 py-1 text-xs rounded transition-all cursor-pointer ${
                                activePillarFilter === 'financial'
                                    ? 'bg-zinc-800 text-zinc-100 font-bold shadow-xs'
                                    : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            Finansowe (4)
                        </button>
                        <button
                            type="button"
                            onClick={() => setActivePillarFilter('cp_only')}
                            className={`px-2.5 py-1 text-xs rounded transition-all cursor-pointer flex items-center gap-1 ${
                                activePillarFilter === 'cp_only'
                                    ? 'bg-amber-950/60 text-amber-300 font-bold border border-amber-800/80'
                                    : 'text-amber-400/80 hover:text-amber-300'
                            }`}
                        >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Tylko CP ({conditionsPrecedent.totalCount})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActivePillarFilter('gaps_only')}
                            className={`px-2.5 py-1 text-xs rounded transition-all cursor-pointer flex items-center gap-1 ${
                                activePillarFilter === 'gaps_only'
                                    ? 'bg-rose-950/60 text-rose-300 font-bold border border-rose-800/80'
                                    : 'text-rose-400/80 hover:text-rose-300'
                            }`}
                        >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Braki & Do Poprawy</span>
                        </button>
                    </div>

                    {/* Search Input */}
                    <div className="relative w-full md:w-64">
                        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Szukaj kryterium audytowego..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
                        />
                    </div>
                </div>

                {/* Criteria Table */}
                <div className="overflow-x-auto">
                    <table data-testid="criteria-table" className="w-full text-left border-collapse text-xs font-mono">
                        <thead className="bg-zinc-950 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
                            <tr>
                                <th className="py-2.5 px-3 w-12 text-center">#</th>
                                <th className="py-2.5 px-3 min-w-[240px]">Kryterium / Wymóg Audytowy</th>
                                <th className="py-2.5 px-3 min-w-[300px]">Specyfikacja & Wytyczne LMA</th>
                                <th className="py-2.5 px-3 w-20 text-center">Waga</th>
                                <th className="py-2.5 px-3 w-28 text-center">Warunek CP</th>
                                <th className="py-2.5 px-3 min-w-[260px] text-center">Status Ewaluacji</th>
                                <th className="py-2.5 px-3 w-16 text-center">Uwagi</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-zinc-850 text-zinc-300">
                            {filteredCriteria.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-8 text-center text-zinc-500">
                                        Brak kryteriów odpowiadających wybranym filtrom.
                                    </td>
                                </tr>
                            ) : (
                                filteredCriteria.map((item, idx) => {
                                    const isNotesOpen = expandedNotes[item.id];

                                    return (
                                        <React.Fragment key={item.id}>
                                            <tr className="hover:bg-zinc-850/40 transition-colors">
                                                {/* Index & Pillar tag */}
                                                <td className="py-3 px-3 text-center text-zinc-500 text-[11px]">
                                                    {idx + 1}
                                                </td>

                                                {/* Name */}
                                                <td className="py-3 px-3 font-semibold text-zinc-100">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 uppercase">
                                                            {item.pillar}
                                                        </span>
                                                        <span>{item.name}</span>
                                                    </div>
                                                </td>

                                                {/* Description */}
                                                <td className="py-3 px-3 text-zinc-400 text-[11px] leading-relaxed">
                                                    {item.description}
                                                    {item.autoKey && (
                                                        <span className="inline-flex items-center gap-1 ml-2 text-[10px] text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/50" title="Kryterium ewaluowane automatycznie z parametrów modelu">
                                                            <Sparkles className="w-2.5 h-2.5" />
                                                            Auto-Sync
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Weight */}
                                                <td className="py-3 px-3 text-center font-bold text-zinc-300">
                                                    {item.weight} pkt
                                                </td>

                                                {/* CP Badge */}
                                                <td className="py-3 px-3 text-center">
                                                    {item.isConditionPrecedent ? (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/80">
                                                            <ShieldCheck className="w-3 h-3" />
                                                            CP
                                                        </span>
                                                    ) : (
                                                        <span className="text-zinc-600 text-[10px]">—</span>
                                                    )}
                                                </td>

                                                {/* Status Selector Buttons */}
                                                <td className="py-3 px-3 text-center">
                                                    <div className="inline-flex items-center bg-zinc-950 p-1 rounded-lg border border-zinc-800 gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleStatusChange(item.id, 'passed')}
                                                            className={`px-2 py-1 text-[11px] font-semibold rounded transition-all cursor-pointer ${
                                                                item.status === 'passed'
                                                                    ? 'bg-emerald-600 text-white shadow-xs'
                                                                    : 'text-zinc-400 hover:text-emerald-300'
                                                            }`}
                                                            title="Spełniony (100% punktów)"
                                                        >
                                                            Spełniony
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleStatusChange(item.id, 'in_progress')}
                                                            className={`px-2 py-1 text-[11px] font-semibold rounded transition-all cursor-pointer ${
                                                                item.status === 'in_progress'
                                                                    ? 'bg-amber-600 text-white shadow-xs'
                                                                    : 'text-zinc-400 hover:text-amber-300'
                                                            }`}
                                                            title="W toku / Częściowy (50% punktów)"
                                                        >
                                                            W toku
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleStatusChange(item.id, 'failed')}
                                                            className={`px-2 py-1 text-[11px] font-semibold rounded transition-all cursor-pointer ${
                                                                item.status === 'failed'
                                                                    ? 'bg-rose-600 text-white shadow-xs'
                                                                    : 'text-zinc-400 hover:text-rose-300'
                                                            }`}
                                                            title="Niespełniony (0 punktów)"
                                                        >
                                                            Brak
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleStatusChange(item.id, 'na')}
                                                            className={`px-2 py-1 text-[11px] font-semibold rounded transition-all cursor-pointer ${
                                                                item.status === 'na'
                                                                    ? 'bg-zinc-700 text-zinc-100 shadow-xs'
                                                                    : 'text-zinc-500 hover:text-zinc-300'
                                                            }`}
                                                            title="Nie dotyczy"
                                                        >
                                                            N/D
                                                        </button>
                                                    </div>
                                                </td>

                                                {/* Notes Toggle */}
                                                <td className="py-3 px-3 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleNotesExpanded(item.id)}
                                                        className={`p-1.5 rounded transition-colors ${
                                                            item.notes ? 'text-emerald-400 bg-emerald-950/30' : 'text-zinc-500 hover:text-zinc-300'
                                                        }`}
                                                        title="Dodaj lub edytuj notatkę audytową"
                                                    >
                                                        <Info className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>

                                            {/* Expandable Notes Sub-row */}
                                            {isNotesOpen && (
                                                <tr className="bg-zinc-950/60 border-t border-b border-zinc-800/60">
                                                    <td colSpan={7} className="py-2.5 px-4">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-[11px] text-zinc-400 shrink-0 uppercase font-semibold">
                                                                Notatka Audytora / Komitetu:
                                                            </span>
                                                            <input
                                                                type="text"
                                                                placeholder="Wpisz uzasadnienie, sygnaturę decyzji lub uwagi do weryfikacji..."
                                                                value={item.notes || ''}
                                                                onChange={(e) => handleNotesChange(item.id, e.target.value)}
                                                                className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Conditions Precedent (CPs) Checklist Summary Card */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                            <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-zinc-100">
                                Warunki Zawieszające przed Wypłatą Finansowania (Conditions Precedent - CPs)
                            </h3>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Zestawienie wymogów formalno-prawnych i technicznych LMA, których spełnienie warunkuje podpisanie umowy i uruchomienie kredytu.
                            </p>
                        </div>
                    </div>

                    <div className="text-right">
                        <span className="text-xs text-zinc-400 font-semibold">Status CPs: </span>
                        <span className={`text-sm font-bold ${conditionsPrecedent.pendingCount === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {conditionsPrecedent.passedCount} z {conditionsPrecedent.totalCount} spełnionych
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
                    {conditionsPrecedent.items.map((cp) => (
                        <div
                            key={cp.id}
                            className={`p-2.5 rounded-lg border flex items-center justify-between gap-3 text-xs ${
                                cp.status === 'passed'
                                    ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                                    : cp.status === 'in_progress'
                                    ? 'bg-amber-950/20 border-amber-800/40 text-amber-300'
                                    : 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                            }`}
                        >
                            <div className="flex items-center gap-2 truncate">
                                {cp.status === 'passed' ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                ) : cp.status === 'in_progress' ? (
                                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                                ) : (
                                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                                )}
                                <span className="font-semibold truncate">{cp.name}</span>
                            </div>

                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-zinc-950/60 border border-zinc-800 shrink-0">
                                {cp.status === 'passed' ? 'SPEŁNIONY' : cp.status === 'in_progress' ? 'W TOKU' : 'WYMAGANY'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
