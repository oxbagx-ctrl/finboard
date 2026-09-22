import React, { useState } from 'react';
import {
    Calculator,
    Plus,
    Calendar,
    Coins,
    Building2,
    Sliders,
    Layers,
    FileSpreadsheet,
    FileCheck2,
    Activity,
    Landmark,
    TrendingUp,
    ShieldAlert,
    Clock,
    CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useInvestmentProject } from '../context/InvestmentProjectContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, MetricCard } from '../components/ui/Card';
import { CreateProjectModal } from '../components/investments/CreateProjectModal';
import { CapexScheduleManager } from '../components/investments/CapexScheduleManager';
import { ReinvestmentManager } from '../components/investments/ReinvestmentManager';
import { FinancingStructureConfigurator } from '../components/investments/FinancingStructureConfigurator';
import { OperatingAssumptionsForm } from '../components/investments/OperatingAssumptionsForm';
import { SensitivityCockpitView } from '../components/investments/SensitivityCockpitView';
import { ThreeStatementGrid } from '../components/investments/ThreeStatementGrid';

export const InvestmentPlanningView = () => {
    const { activeCompany } = useAuth();
    const {
        projects,
        selectedProjectId,
        selectedProject,
        loading,
        activeTab,
        setActiveTab,
        selectProject,
        createProject,
    } = useInvestmentProject();

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const getStatusBadge = (status) => {
        switch (status) {
            case 'approved':
                return <Badge variant="brand">ZATWIERDZONY</Badge>;
            case 'active':
                return <Badge variant="success">W REALIZACJI</Badge>;
            case 'completed':
                return <Badge variant="default">ZAKOŃCZONY</Badge>;
            case 'under_review':
                return <Badge variant="purple">W RECENZJI</Badge>;
            case 'draft':
            default:
                return <Badge variant="warning">SZKIC (DRAFT)</Badge>;
        }
    };

    const formatCurrency = (val, currency = 'PLN') => {
        if (val === null || val === undefined) return '0,00 ' + currency;
        const num = typeof val === 'number' ? val : parseFloat(val);
        if (isNaN(num)) return '0,00 ' + currency;
        return new Intl.NumberFormat('pl-PL', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(num) + ' ' + currency;
    };

    const capexTotal = selectedProject?.budget?.total_net_capex
        ? parseFloat(selectedProject.budget.total_net_capex)
        : (selectedProject?.capex_stages?.reduce((acc, s) => acc + parseFloat(s.net_amount || 0), 0) || 0);

    const equityTotal = selectedProject?.financing_structure?.equity_amount
        ? parseFloat(selectedProject.financing_structure.equity_amount)
        : 0;

    const debtTotal = selectedProject?.financing_structure?.senior_debt_amount
        ? parseFloat(selectedProject.financing_structure.senior_debt_amount)
        : (selectedProject?.debt_facilities?.reduce((acc, d) => acc + parseFloat(d.principal || 0), 0) || 0);

    const grantTotal = selectedProject?.financing_structure?.grant_amount
        ? parseFloat(selectedProject.financing_structure.grant_amount)
        : 0;

    const currency = selectedProject?.currency || 'PLN';

    const tabs = [
        {
            id: 'assumptions',
            label: '1. Założenia & CAPEX',
            sublabel: 'Harmonogram etapów, montaż kapitałowy i driver OPEX',
            icon: Sliders,
            badge: 'FAZA 42',
        },
        {
            id: 'sensitivity',
            label: '2. Symulator What-If',
            sublabel: 'Analiza wrażliwości real-time w Web Workerze',
            icon: Activity,
            badge: 'FAZA 43',
        },
        {
            id: 'statements',
            label: '3. Model 15-letni & Wycena',
            sublabel: '3-Statement, DCF, WACC i Equity Waterfall',
            icon: FileSpreadsheet,
            badge: 'FAZA 44',
        },
        {
            id: 'dossier',
            label: '4. Scoring & Dossier PDF',
            sublabel: 'Test gotowości, kowenanty i raport inwestorski',
            icon: FileCheck2,
            badge: 'FAZA 45',
        },
    ];

    return (
        <div className="space-y-6 font-mono">
            {/* Top Bar: Title, Project Switcher, Action */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                            MODUŁ DEAL ADVISORY & PROJECT FINANCE
                        </span>
                        <span className="text-zinc-600">//</span>
                        <span className="text-[10px] text-emerald-400 font-semibold uppercase">
                            {activeCompany?.code || 'PODMIOT'}
                        </span>
                    </div>
                    <h1 className="text-base sm:text-lg font-bold text-zinc-100 tracking-tight flex items-center gap-2.5">
                        <Calculator className="w-5 h-5 text-emerald-400" />
                        <span>Planowanie Inwestycji i Montaż Finansowy</span>
                    </h1>
                    <p className="text-xs text-zinc-400 mt-0.5">
                        Modelowanie 15-letnich nakładów CAPEX, amortyzacji KŚT, długu bankowego i wyceny DCF
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Project Selector (if projects exist) */}
                    {projects.length > 0 && (
                        <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5">
                            <span className="text-[11px] text-zinc-400 uppercase font-semibold">PROJEKT:</span>
                            <select
                                value={selectedProjectId || ''}
                                onChange={(e) => selectProject(e.target.value)}
                                aria-label="Wybierz projekt"
                                data-testid="project-selector"
                                className="bg-transparent text-xs text-zinc-100 font-semibold focus:outline-none cursor-pointer max-w-[200px] truncate"
                            >
                                {projects.map((p) => (
                                    <option key={p.id} value={p.id} className="bg-zinc-900 text-zinc-100">
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                            {selectedProject && getStatusBadge(selectedProject.status)}
                        </div>
                    )}

                    <Button
                        variant="primary"
                        icon={Plus}
                        onClick={() => setIsCreateModalOpen(true)}
                    >
                        Nowy Projekt
                    </Button>
                </div>
            </div>

            {/* Empty State when no projects exist */}
            {!loading && projects.length === 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-10 text-center max-w-2xl mx-auto shadow-sm my-8">
                    <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 mx-auto flex items-center justify-center text-zinc-400 mb-4">
                        <Calculator className="w-6 h-6 text-zinc-300" />
                    </div>
                    <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wide mb-2">
                        Brak zdefiniowanych projektów inwestycyjnych
                    </h2>
                    <p className="text-xs text-zinc-400 max-w-md mx-auto mb-6 leading-relaxed">
                        Dla podmiotu <strong className="text-zinc-200">{activeCompany?.name || 'wybranej spółki'}</strong> nie skonfigurowano jeszcze żadnego projektu inwestycyjnego. Zainicjalizuj projekt, aby rozpocząć definiowanie etapów CAPEX, montażu długu i symulacji 15-letnich sprawozdań.
                    </p>
                    <Button
                        variant="primary"
                        icon={Plus}
                        size="lg"
                        onClick={() => setIsCreateModalOpen(true)}
                    >
                        Zainicjalizuj Pierwszy Projekt
                    </Button>
                </div>
            )}

            {/* Active Project View */}
            {selectedProject && (
                <>
                    {/* KPI Strip */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        <MetricCard
                            title="SUMARYCZNY CAPEX"
                            value={formatCurrency(capexTotal, currency)}
                            subtitle={`${selectedProject.capex_stages?.length || 0} etapów inwestycji`}
                            icon={Landmark}
                        />
                        <MetricCard
                            title="WKŁAD WŁASNY (EQUITY)"
                            value={formatCurrency(equityTotal, currency)}
                            subtitle={capexTotal > 0 ? `${((equityTotal / capexTotal) * 100).toFixed(1)}% montażu` : '0.0%'}
                            icon={Coins}
                        />
                        <MetricCard
                            title="KREDYT BANKOWY"
                            value={formatCurrency(debtTotal, currency)}
                            subtitle={capexTotal > 0 ? `${((debtTotal / capexTotal) * 100).toFixed(1)}% montażu` : '0.0%'}
                            icon={Building2}
                        />
                        <MetricCard
                            title="DOTACJE & SUBSYDIA"
                            value={formatCurrency(grantTotal, currency)}
                            subtitle={capexTotal > 0 ? `${((grantTotal / capexTotal) * 100).toFixed(1)}% montażu` : '0.0%'}
                            icon={TrendingUp}
                        />
                        <MetricCard
                            title="HORYZONT MODELU"
                            value={`${selectedProject.planning_horizon_years || 15} LAT`}
                            subtitle={selectedProject.commercial_operation_date ? `COD: ${selectedProject.commercial_operation_date}` : 'Start: ' + (selectedProject.start_date || 'N/A')}
                            icon={Clock}
                            className="col-span-2 lg:col-span-1"
                        />
                    </div>

                    {/* Sub-tabs Navigation */}
                    <div className="border-b border-zinc-800">
                        <div className="flex items-center gap-2 overflow-x-auto pb-px">
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-2.5 px-4 py-3 border-b-2 text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                                            isActive
                                                ? 'border-emerald-400 text-zinc-100 bg-zinc-900/40'
                                                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/20'
                                        }`}
                                    >
                                        <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
                                        <span>{tab.label}</span>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                                            isActive
                                                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                                                : 'bg-zinc-800 text-zinc-400'
                                        }`}>
                                            {tab.badge}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Tab Content Shell */}
                    <div className="mt-4">
                        {activeTab === 'assumptions' && (
                            <div className="space-y-6">
                                <div className="p-4 bg-zinc-900/70 border border-zinc-800 rounded-lg flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center text-emerald-400">
                                            <Sliders className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <span className="font-bold text-zinc-100 uppercase">
                                                Konfigurator Założeń Projektu Finance (Faza 42)
                                            </span>
                                            <p className="text-zinc-400 text-[11px] mt-0.5">
                                                Wprowadzaj etapy CAPEX z klasyfikacją KŚT, konfiguruj instrumenty dłużne i definiuj prognozy operacyjne.
                                            </p>
                                        </div>
                                    </div>
                                    <Badge variant="brand">WORK IN PROGRESS</Badge>
                                </div>

                                {/* Live CapexScheduleManager Component (Commit 208) */}
                                <CapexScheduleManager />

                                {/* Live ReinvestmentManager Component (Commit 214) */}
                                <ReinvestmentManager />

                                {/* Live FinancingStructureConfigurator Component (Commit 209) */}
                                <FinancingStructureConfigurator />

                                {/* Live OperatingAssumptionsForm Component (Commit 210) */}
                                <OperatingAssumptionsForm />
                            </div>
                        )}

                        {activeTab === 'sensitivity' && (
                            <SensitivityCockpitView />
                        )}

                        {activeTab === 'statements' && (
                            <ThreeStatementGrid />
                        )}

                        {activeTab === 'dossier' && (
                            <Card
                                title="Scoring Gotowości Inwestycyjnej & Dossier PDF (Faza 45)"
                                subtitle="Kompleksowy raport dla instytucji finansowych i inwestorów Private Equity"
                            >
                                <div className="text-xs text-zinc-400 space-y-3 py-4">
                                    <p>
                                        Moduł Fazy 45 umożliwi wygenerowanie instytucjonalnego memorandum inwestycyjnego:
                                    </p>
                                    <ul className="list-disc list-inside space-y-1 text-zinc-300 text-[11px]">
                                        <li>Matryca Investment Readiness Scorecard (kryteria formalno-prawne, techniczne, finansowe)</li>
                                        <li>Kompilator raportu PDF z wykresami spłat długu, profilami przepływów i pieczęcią SHA-256</li>
                                        <li>Gotowość do prezentacji w komitetach kredytowych banków i funduszy</li>
                                    </ul>
                                </div>
                            </Card>
                        )}
                    </div>
                </>
            )}

            {/* Create Project Modal */}
            <CreateProjectModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSubmit={createProject}
            />
        </div>
    );
};
