import React, { useState } from 'react';
import {
    Plus,
    Layers,
    Calendar,
    Tag,
    Edit2,
    Trash2,
    CheckCircle2,
    Clock,
    AlertCircle,
    Landmark,
    TrendingUp,
    Percent
} from 'lucide-react';
import { useInvestmentProject } from '../../context/InvestmentProjectContext';
import { useNotification } from '../../context/NotificationContext';
import { investmentProjectsApi } from '../../api/investmentProjects';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { Tooltip, InfoTooltip } from '../ui/Tooltip';
import { CapexStageModal } from './CapexStageModal';
import { CapexStageDeleteModal } from './CapexStageDeleteModal';
import { getKstByCode } from '../../constants/kstClassifications';

export const CapexScheduleManager = () => {
    const { selectedProject, loadProjectDetails, refreshProjects } = useInvestmentProject();
    const { success, error: notifyError } = useNotification();

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingStage, setEditingStage] = useState(null);
    const [deletingStage, setDeletingStage] = useState(null);

    const stages = selectedProject?.capex_stages || [];
    const sortedStages = [...stages].sort((a, b) => {
        const orderA = a.stage_order || a.order_index || 0;
        const orderB = b.stage_order || b.order_index || 0;
        return orderA - orderB;
    });

    const currency = selectedProject?.currency || 'PLN';

    const formatCurrency = (val) => {
        if (val === null || val === undefined) return '0,00 ' + currency;
        const num = typeof val === 'number' ? val : parseFloat(val);
        if (isNaN(num)) return '0,00 ' + currency;
        return new Intl.NumberFormat('pl-PL', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(num) + ' ' + currency;
    };

    // Calculate totals
    const totalNetCapex = sortedStages.reduce((sum, s) => sum + parseFloat(s.net_amount || 0), 0);
    const totalGrantEligible = sortedStages.reduce((sum, s) => {
        if (s.is_grant_eligible || s.eligible_for_grant) {
            const amount = s.grant_eligible_amount !== null && s.grant_eligible_amount !== undefined
                ? parseFloat(s.grant_eligible_amount)
                : parseFloat(s.net_amount || 0);
            return sum + amount;
        }
        return sum;
    }, 0);

    // Calculate weighted KŚT rate
    const weightedKstNumerator = sortedStages.reduce((sum, s) => {
        const net = parseFloat(s.net_amount || 0);
        const kstObj = getKstByCode(s.kst_code);
        const rate = s.kst_annual_rate !== undefined ? parseFloat(s.kst_annual_rate) : kstObj.rate;
        return sum + (net * rate);
    }, 0);

    const weightedKstRate = totalNetCapex > 0 ? (weightedKstNumerator / totalNetCapex) : 0;

    // Estimate completion date from start date and duration
    const getCompletionDate = (startDateStr, durationMonths) => {
        if (!startDateStr) return '—';
        try {
            const d = new Date(startDateStr);
            if (isNaN(d.getTime())) return '—';
            d.setMonth(d.getMonth() + (parseInt(durationMonths, 10) || 1));
            return d.toISOString().split('T')[0];
        } catch {
            return '—';
        }
    };

    // Handlers
    const handleAddStage = async (stageData) => {
        if (!selectedProject?.id) return;
        try {
            await investmentProjectsApi.addCapexStage(selectedProject.id, stageData);
            success('Etap CAPEX został pomyślnie dodany.');
            await loadProjectDetails(selectedProject.id);
            await refreshProjects();
        } catch (err) {
            const msg = err.response?.data?.message || 'Błąd podczas dodawania etapu CAPEX.';
            notifyError(msg);
            throw err;
        }
    };

    const handleUpdateStage = async (stageData) => {
        if (!selectedProject?.id || !editingStage?.id) return;
        try {
            await investmentProjectsApi.updateCapexStage(selectedProject.id, editingStage.id, stageData);
            success('Etap CAPEX został pomyślnie zaktualizowany.');
            await loadProjectDetails(selectedProject.id);
            await refreshProjects();
        } catch (err) {
            const msg = err.response?.data?.message || 'Błąd podczas aktualizacji etapu CAPEX.';
            notifyError(msg);
            throw err;
        }
    };

    const handleDeleteStage = async () => {
        if (!selectedProject?.id || !deletingStage?.id) return;
        try {
            await investmentProjectsApi.deleteCapexStage(selectedProject.id, deletingStage.id);
            success('Etap CAPEX został pomyślnie usunięty.');
            await loadProjectDetails(selectedProject.id);
            await refreshProjects();
        } catch (err) {
            const msg = err.response?.data?.message || 'Błąd podczas usuwania etapu CAPEX.';
            notifyError(msg);
            throw err;
        }
    };

    return (
        <div className="space-y-6 font-mono">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <Tooltip content="Harmonogram rzeczowo-finansowy nakładów CAPEX">
                        <div
                            tabIndex={0}
                            className="w-9 h-9 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-emerald-400 cursor-help focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                            <Layers className="w-5 h-5" />
                        </div>
                    </Tooltip>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">
                                Harmonogram Etapów CAPEX & Środki Trwałe KŚT
                            </h2>
                            <InfoTooltip
                                content="Harmonogram rzeczowo-finansowy Project Finance. Zdefiniuj poszczególne etapy nakładów inwestycyjnych z przypisaną klasyfikacją KŚT, datami realizacji oraz kwalifikowalnością dotacyjną dla automatycznej amortyzacji i modelowania cash flow."
                                ariaLabel="Informacje o harmonogramie etapów CAPEX i KŚT"
                                size="xs"
                            />
                        </div>
                        <p className="text-[11px] text-zinc-400">
                            Podział nakładów, czas trwania, klasyfikacja amortyzacji i kwalifikowalność dotacyjna
                        </p>
                    </div>
                </div>

                <Tooltip content="Otwórz formularz dodawania nowego etapu nakładów inwestycyjnych">
                    <span>
                        <Button
                            variant="primary"
                            icon={Plus}
                            onClick={() => setIsAddModalOpen(true)}
                            aria-label="Dodaj Etap CAPEX"
                        >
                            Dodaj Etap CAPEX
                        </Button>
                    </span>
                </Tooltip>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase font-semibold mb-1">
                        <div className="flex items-center gap-1.5">
                            <span>NAKŁADY NETTO (SUMA)</span>
                            <InfoTooltip
                                content="Łączna suma nakładów inwestycyjnych netto ze wszystkich etapów harmonogramu."
                                ariaLabel="Informacje o sumie nakładów netto"
                                size="xs"
                            />
                        </div>
                        <Tooltip content="Suma nakładów CAPEX netto">
                            <span tabIndex={0} className="cursor-help focus:outline-none focus:text-emerald-300">
                                <Landmark className="w-3.5 h-3.5 text-emerald-400" />
                            </span>
                        </Tooltip>
                    </div>
                    <div className="text-base font-bold text-zinc-100">
                        {formatCurrency(totalNetCapex)}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1">
                        {sortedStages.length} {sortedStages.length === 1 ? 'etap nakładów' : 'etapów nakładów'}
                    </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase font-semibold mb-1">
                        <div className="flex items-center gap-1.5">
                            <span>WYDATKI KWALIFIKOWANE</span>
                            <InfoTooltip
                                content="Wartość nakładów kwalifikujących się do dofinansowania dotacyjnego lub wsparcia ze środków publicznych."
                                ariaLabel="Informacje o wydatkach kwalifikowanych"
                                size="xs"
                            />
                        </div>
                        <Tooltip content="Baza kosztów kwalifikowanych do dotacji">
                            <span tabIndex={0} className="cursor-help focus:outline-none focus:text-blue-300">
                                <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                            </span>
                        </Tooltip>
                    </div>
                    <div className="text-base font-bold text-zinc-100">
                        {formatCurrency(totalGrantEligible)}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1">
                        {totalNetCapex > 0 ? `${((totalGrantEligible / totalNetCapex) * 100).toFixed(1)}% bazy dotacyjnej` : '0.0%'}
                    </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase font-semibold mb-1">
                        <div className="flex items-center gap-1.5">
                            <span>ŚREDNIA STAWKA KŚT</span>
                            <InfoTooltip
                                content="Średnioroczna stawka amortyzacji bilansowo-podatkowej ważona wielkością nakładów netto poszczególnych etapów."
                                ariaLabel="Informacje o średniej stawce KŚT"
                                size="xs"
                            />
                        </div>
                        <Tooltip content="Ważona stawka amortyzacji KŚT">
                            <span tabIndex={0} className="cursor-help focus:outline-none focus:text-amber-300">
                                <Percent className="w-3.5 h-3.5 text-amber-400" />
                            </span>
                        </Tooltip>
                    </div>
                    <div className="text-base font-bold text-zinc-100">
                        {weightedKstRate.toFixed(2)}% / ROK
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1">
                        Ważona wartością netto etapów
                    </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase font-semibold mb-1">
                        <div className="flex items-center gap-1.5">
                            <span>STATUS HARMONOGRAMU</span>
                            <InfoTooltip
                                content="Status kompletności harmonogramu nakładów CAPEX i gotowości do projekcji wieloletniej."
                                ariaLabel="Informacje o statusie harmonogramu"
                                size="xs"
                            />
                        </div>
                        <Tooltip content="Status harmonogramu rzeczowo-finansowego">
                            <span tabIndex={0} className="cursor-help focus:outline-none focus:text-purple-300">
                                <Clock className="w-3.5 h-3.5 text-purple-400" />
                            </span>
                        </Tooltip>
                    </div>
                    <div className="text-base font-bold text-zinc-100">
                        {sortedStages.length > 0 ? 'SKONFIGUROWANY' : 'BRAK ETAPÓW'}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1">
                        {sortedStages.length > 0 ? `Start: ${sortedStages[0].start_date || 'N/A'}` : 'Wymaga definicji'}
                    </div>
                </div>
            </div>

            {/* Stages Table */}
            {sortedStages.length === 0 ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 mx-auto flex items-center justify-center text-zinc-400 mb-3">
                        <Layers className="w-5 h-5 text-zinc-300" />
                    </div>
                    <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wide mb-1">
                        Brak zdefiniowanych etapów CAPEX w tym projekcie
                    </h3>
                    <p className="text-[11px] text-zinc-400 max-w-md mx-auto mb-4 leading-relaxed">
                        Dodaj poszczególne etapy nakładów (np. prace ziemne, budowa hali, zakup maszyn) i przypisz im właściwe stawki amortyzacji KŚT.
                    </p>
                    <Tooltip content="Rozpocznij definicję pierwszego etapu prac i nakładów inwestycyjnych">
                        <span>
                            <Button
                                variant="primary"
                                icon={Plus}
                                onClick={() => setIsAddModalOpen(true)}
                                aria-label="Dodaj Pierwszy Etap CAPEX"
                            >
                                Dodaj Pierwszy Etap CAPEX
                            </Button>
                        </span>
                    </Tooltip>
                </div>
            ) : (
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-zinc-800 bg-zinc-950/80 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                                    <th className="py-3 px-4 w-12 text-center">
                                        <Tooltip content="Liczba porządkowa / kolejność realizacji etapu">
                                            <span tabIndex={0} className="cursor-help focus:outline-none focus:text-zinc-200">LP</span>
                                        </Tooltip>
                                    </th>
                                    <th className="py-3 px-4">
                                        <Tooltip content="Nazwa zadania lub pozycji inwestycyjnej w harmonogramie">
                                            <span tabIndex={0} className="cursor-help focus:outline-none focus:text-zinc-200">NAZWA ETAPU</span>
                                        </Tooltip>
                                    </th>
                                    <th className="py-3 px-4">
                                        <Tooltip content="Grupa Klasyfikacji Środków Trwałych i roczna stawka amortyzacji">
                                            <span tabIndex={0} className="cursor-help focus:outline-none focus:text-zinc-200">KLASYFIKACJA KŚT</span>
                                        </Tooltip>
                                    </th>
                                    <th className="py-3 px-4 text-right">
                                        <Tooltip content="Wartość nakładów netto bez VAT w walucie projektu">
                                            <span tabIndex={0} className="cursor-help focus:outline-none focus:text-zinc-200">KWOTA NETTO</span>
                                        </Tooltip>
                                    </th>
                                    <th className="py-3 px-4">
                                        <Tooltip content="Data startu etapu oraz moment przyjęcia do używania (OT)">
                                            <span tabIndex={0} className="cursor-help focus:outline-none focus:text-zinc-200">HARMONOGRAM (START → OT)</span>
                                        </Tooltip>
                                    </th>
                                    <th className="py-3 px-4 text-center">
                                        <Tooltip content="Kwalifikowalność do dofinansowania dotacyjnego">
                                            <span tabIndex={0} className="cursor-help focus:outline-none focus:text-zinc-200">DOTACJA</span>
                                        </Tooltip>
                                    </th>
                                    <th className="py-3 px-4 text-right w-24">
                                        <Tooltip content="Dostępne operacje edycji i usuwania etapu">
                                            <span tabIndex={0} className="cursor-help focus:outline-none focus:text-zinc-200">AKCJE</span>
                                        </Tooltip>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60">
                                {sortedStages.map((stage, idx) => {
                                    const kstObj = getKstByCode(stage.kst_code);
                                    const kstRate = stage.kst_annual_rate !== undefined ? stage.kst_annual_rate : kstObj.rate;
                                    const completionDate = stage.completion_date || getCompletionDate(stage.start_date, stage.duration_months);
                                    const isGrant = stage.is_grant_eligible || stage.eligible_for_grant;

                                    return (
                                        <tr key={stage.id || idx} className="hover:bg-zinc-850/40 transition-colors">
                                            <td className="py-3 px-4 text-center text-zinc-500 font-mono text-[11px]">
                                                {stage.stage_order || stage.order_index || (idx + 1)}
                                            </td>
                                            <td className="py-3 px-4 font-semibold text-zinc-100">
                                                <div className="flex items-center gap-2">
                                                    <span>{stage.stage_name}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-semibold text-zinc-200 text-[11px]">
                                                        {stage.kst_code}
                                                    </span>
                                                    <Tooltip content={`Roczna stawka amortyzacji KŚT: ${kstRate}%`}>
                                                        <span>
                                                            <Badge variant="brand" size="sm">
                                                                {kstRate}%
                                                            </Badge>
                                                        </span>
                                                    </Tooltip>
                                                </div>
                                                <div className="text-[10px] text-zinc-500 truncate max-w-xs">
                                                    {kstObj.name}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-right font-bold text-emerald-400 font-mono">
                                                {stage.formatted_net_amount || formatCurrency(stage.net_amount)}
                                            </td>
                                            <td className="py-3 px-4 text-[11px] text-zinc-300">
                                                <div className="flex items-center gap-1.5 font-mono">
                                                    <span>{stage.start_date || 'N/A'}</span>
                                                    <span className="text-zinc-600">→</span>
                                                    <span>{completionDate}</span>
                                                </div>
                                                <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                                                    Czas trwania: {stage.duration_months || 1} mies.
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                {isGrant ? (
                                                    <Tooltip content={`Wydatki kwalifikowane: ${stage.grant_eligible_amount !== null && stage.grant_eligible_amount !== undefined ? formatCurrency(stage.grant_eligible_amount) : '100% kwoty netto'}`}>
                                                        <span>
                                                            <Badge variant="success" size="sm">
                                                                TAK ({stage.grant_eligible_amount !== null && stage.grant_eligible_amount !== undefined ? formatCurrency(stage.grant_eligible_amount) : '100%'})
                                                            </Badge>
                                                        </span>
                                                    </Tooltip>
                                                ) : (
                                                    <Tooltip content="Etap niekwalifikowany do wsparcia dotacyjnego">
                                                        <span>
                                                            <Badge variant="default" size="sm">NIE</Badge>
                                                        </span>
                                                    </Tooltip>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <Tooltip content={`Edytuj etap: ${stage.stage_name}`}>
                                                        <button
                                                            onClick={() => setEditingStage(stage)}
                                                            title="Edytuj etap"
                                                            aria-label={`Edytuj etap ${stage.stage_name}`}
                                                            className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </Tooltip>
                                                    <Tooltip content={`Usuń etap: ${stage.stage_name}`}>
                                                        <button
                                                            onClick={() => setDeletingStage(stage)}
                                                            title="Usuń etap"
                                                            aria-label={`Usuń etap ${stage.stage_name}`}
                                                            className="p-1.5 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-1 focus:ring-rose-500"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </Tooltip>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Visual Mini Progress Timeline */}
            {sortedStages.length > 0 && totalNetCapex > 0 && (
                <Card
                    title="Struktura Nakładów CAPEX wg Etapów"
                    subtitle="Względny udział poszczególnych etapów w całkowitym budżecie inwestycyjnym"
                >
                    <div className="space-y-3 pt-2">
                        {/* Stacked bar */}
                        <div className="w-full h-3.5 bg-zinc-950 rounded-full overflow-hidden flex border border-zinc-800">
                            {sortedStages.map((stage, idx) => {
                                const net = parseFloat(stage.net_amount || 0);
                                const pct = (net / totalNetCapex) * 100;
                                const colors = [
                                    'bg-emerald-500',
                                    'bg-blue-500',
                                    'bg-purple-500',
                                    'bg-amber-500',
                                    'bg-cyan-500',
                                    'bg-rose-500',
                                ];
                                const color = colors[idx % colors.length];

                                return (
                                    <Tooltip
                                        key={stage.id || idx}
                                        content={`${stage.stage_name}: ${pct.toFixed(1)}% (${formatCurrency(stage.net_amount)})`}
                                    >
                                        <div
                                            tabIndex={0}
                                            style={{ width: `${pct}%` }}
                                            title={`${stage.stage_name}: ${pct.toFixed(1)}%`}
                                            aria-label={`${stage.stage_name}: ${pct.toFixed(1)}%`}
                                            className={`${color} h-full transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-white`}
                                        />
                                    </Tooltip>
                                );
                            })}
                        </div>

                        {/* Legend */}
                        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px]">
                            {sortedStages.map((stage, idx) => {
                                const net = parseFloat(stage.net_amount || 0);
                                const pct = (net / totalNetCapex) * 100;
                                const dotColors = [
                                    'bg-emerald-500',
                                    'bg-blue-500',
                                    'bg-purple-500',
                                    'bg-amber-500',
                                    'bg-cyan-500',
                                    'bg-rose-500',
                                ];
                                const color = dotColors[idx % dotColors.length];

                                return (
                                    <Tooltip
                                        key={stage.id || idx}
                                        content={`Udział w budżecie: ${pct.toFixed(1)}% (${formatCurrency(stage.net_amount)})`}
                                    >
                                        <div tabIndex={0} className="flex items-center gap-1.5 cursor-help focus:outline-none">
                                            <span className={`w-2 h-2 rounded-full ${color}`} />
                                            <span className="text-zinc-300 truncate max-w-[150px]">{stage.stage_name}</span>
                                            <span className="text-zinc-500">({pct.toFixed(1)}%)</span>
                                        </div>
                                    </Tooltip>
                                );
                            })}
                        </div>
                    </div>
                </Card>
            )}

            {/* Modals */}
            <CapexStageModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSubmit={handleAddStage}
                projectCurrency={currency}
                projectStartDate={selectedProject?.start_date}
            />

            <CapexStageModal
                isOpen={!!editingStage}
                onClose={() => setEditingStage(null)}
                onSubmit={handleUpdateStage}
                initialData={editingStage}
                projectCurrency={currency}
                projectStartDate={selectedProject?.start_date}
            />

            <CapexStageDeleteModal
                isOpen={!!deletingStage}
                stage={deletingStage}
                onClose={() => setDeletingStage(null)}
                onConfirm={handleDeleteStage}
            />
        </div>
    );
};

export default CapexScheduleManager;
