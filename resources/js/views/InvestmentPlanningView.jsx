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
import { Tooltip, InfoTooltip } from '../components/ui/Tooltip';
import { CreateProjectModal } from '../components/investments/CreateProjectModal';
import { CapexScheduleManager } from '../components/investments/CapexScheduleManager';
import { ReinvestmentManager } from '../components/investments/ReinvestmentManager';
import { FinancingStructureConfigurator } from '../components/investments/FinancingStructureConfigurator';
import { OperatingAssumptionsForm } from '../components/investments/OperatingAssumptionsForm';
import { SensitivityCockpitView } from '../components/investments/SensitivityCockpitView';
import { ThreeStatementGrid } from '../components/investments/ThreeStatementGrid';
import { ExitValuationOverlay } from '../components/investments/ExitValuationOverlay';
import { ExitWaterfallVisualizer } from '../components/investments/ExitWaterfallVisualizer';
import { BankingCovenantsStrip } from '../components/investments/BankingCovenantsStrip';
import { InvestmentReadinessScorecard } from '../components/investments/InvestmentReadinessScorecard';
import { CustomReportBuilder } from '../components/investments/CustomReportBuilder';
import { InvestmentDossierPdfGenerator } from '../components/investments/InvestmentDossierPdfGenerator';

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
                return (
                    <Tooltip content="Projekt zweryfikowany i zatwierdzony przez komitet inwestycyjny">
                        <Badge variant="brand">ZATWIERDZONY</Badge>
                    </Tooltip>
                );
            case 'active':
                return (
                    <Tooltip content="Projekt w fazie aktywnej realizacji i finansowania CAPEX">
                        <Badge variant="success">W REALIZACJI</Badge>
                    </Tooltip>
                );
            case 'completed':
                return (
                    <Tooltip content="Projekt zrealizowany, rozliczony i przekazany do eksploatacji">
                        <Badge variant="default">ZAKOŃCZONY</Badge>
                    </Tooltip>
                );
            case 'under_review':
                return (
                    <Tooltip content="Projekt w trakcie oceny ryzyk, analizy due diligence lub audytu">
                        <Badge variant="purple">W RECENZJI</Badge>
                    </Tooltip>
                );
            case 'draft':
            default:
                return (
                    <Tooltip content="Wstępna wersja robocza założeń projektowych i montażu dłużnego">
                        <Badge variant="warning">SZKIC (DRAFT)</Badge>
                    </Tooltip>
                );
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
        },
        {
            id: 'sensitivity',
            label: '2. Symulator What-If',
            sublabel: 'Analiza wrażliwości real-time w Web Workerze',
            icon: Activity,
        },
        {
            id: 'statements',
            label: '3. Model 15-letni & Wycena',
            sublabel: '3-Statement, DCF, WACC i Equity Waterfall',
            icon: FileSpreadsheet,
        },
        {
            id: 'dossier',
            label: '4. Scoring & Dossier PDF',
            sublabel: 'Test gotowości, kowenanty i raport inwestorski',
            icon: FileCheck2,
        },
    ];

    return (
        <div className="space-y-6 font-mono">
            {/* Top Bar: Title, Project Switcher, Action */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Tooltip content="Moduł doradztwa transakcyjnego, modelowania nakładów CAPEX i project finance">
                            <span className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase cursor-help">
                                MODUŁ DEAL ADVISORY & PROJECT FINANCE
                            </span>
                        </Tooltip>
                        <span className="text-zinc-400 dark:text-zinc-600">//</span>
                        <Tooltip content={`Aktywny profil podmiotu gospodarczego: ${activeCompany?.name || 'Spółka domyślna'}`}>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase cursor-help">
                                {activeCompany?.code || 'PODMIOT'}
                            </span>
                        </Tooltip>
                    </div>
                    <h1 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2.5">
                        <Tooltip content="Silnik wyceny i inżynierii finansowej CAPEX">
                            <span className="inline-flex">
                                <Calculator className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            </span>
                        </Tooltip>
                        <span>Planowanie Inwestycji i Montaż Finansowy</span>
                        <InfoTooltip
                            content="Kompleksowy moduł inżynierii finansowej Project Finance: wieloletnie harmonogramowanie nakładów CAPEX (zgodnie z KŚT), optymalizacja struktury długu (DSCR, LLCR, wskaźniki bankowe), 15-letni model 3-Statement (RZiS, Bilans, Cash Flow) oraz wycena DCF/WACC."
                            size="sm"
                        />
                    </h1>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Modelowanie 15-letnich nakładów CAPEX, amortyzacji KŚT, długu bankowego i wyceny DCF
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Project Selector (if projects exist) */}
                    {projects.length > 0 && (
                        <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-1.5">
                            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold">PROJEKT:</span>
                            <Tooltip content="Wybierz aktywny projekt inwestycyjny do analizy i edycji założeń">
                                <select
                                    value={selectedProjectId || ''}
                                    onChange={(e) => selectProject(e.target.value)}
                                    aria-label="Wybierz projekt"
                                    data-testid="project-selector"
                                    className="bg-transparent text-xs text-zinc-900 dark:text-zinc-100 font-semibold focus:outline-none cursor-pointer max-w-[200px] truncate"
                                >
                                    {projects.map((p) => (
                                        <option key={p.id} value={p.id} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                            </Tooltip>
                            {selectedProject && getStatusBadge(selectedProject.status)}
                        </div>
                    )}

                    <Tooltip content="Zainicjalizuj nowy projekt inwestycyjny z dedykowanym modelem CAPEX">
                        <Button
                            variant="primary"
                            icon={Plus}
                            onClick={() => setIsCreateModalOpen(true)}
                        >
                            Nowy Projekt
                        </Button>
                    </Tooltip>
                </div>
            </div>

            {/* Empty State when no projects exist */}
            {!loading && projects.length === 0 && (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-10 text-center max-w-2xl mx-auto shadow-sm my-8">
                    <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 mx-auto flex items-center justify-center text-zinc-500 dark:text-zinc-400 mb-4">
                        <Calculator className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
                    </div>
                    <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide mb-2">
                        Brak zdefiniowanych projektów inwestycyjnych
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-6 leading-relaxed">
                        Dla podmiotu <strong className="text-zinc-800 dark:text-zinc-200">{activeCompany?.name || 'wybranej spółki'}</strong> nie skonfigurowano jeszcze żadnego projektu inwestycyjnego. Zainicjalizuj projekt, aby rozpocząć definiowanie etapów CAPEX, montażu długu i symulacji 15-letnich sprawozdań.
                    </p>
                    <Tooltip content="Otwórz konfigurator i zdefiniuj pierwszy projekt inwestycyjny dla spółki">
                        <Button
                            variant="primary"
                            icon={Plus}
                            size="lg"
                            onClick={() => setIsCreateModalOpen(true)}
                        >
                            Zainicjalizuj Pierwszy Projekt
                        </Button>
                    </Tooltip>
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
                            tooltipContent="Łączna wartość nakładów inwestycyjnych (CAPEX netto) zdefiniowanych we wszystkich etapach harmonogramu realizacji projektu."
                        />
                        <MetricCard
                            title="WKŁAD WŁASNY (EQUITY)"
                            value={formatCurrency(equityTotal, currency)}
                            subtitle={capexTotal > 0 ? `${((equityTotal / capexTotal) * 100).toFixed(1)}% montażu` : '0.0%'}
                            icon={Coins}
                            tooltipContent="Środki własne inwestora zaangażowane w montaż finansowy projektu, stanowiące bazę do kalkulacji stóp zwrotu Equity IRR i MOIC."
                        />
                        <MetricCard
                            title="KREDYT BANKOWY"
                            value={formatCurrency(debtTotal, currency)}
                            subtitle={capexTotal > 0 ? `${((debtTotal / capexTotal) * 100).toFixed(1)}% montażu` : '0.0%'}
                            icon={Building2}
                            tooltipContent="Łączny wolumen długu uprzywilejowanego (senior debt) lub linii kredytowej zaciągniętej na sfinansowanie nakładów inwestycyjnych."
                        />
                        <MetricCard
                            title="DOTACJE & SUBSYDIA"
                            value={formatCurrency(grantTotal, currency)}
                            subtitle={capexTotal > 0 ? `${((grantTotal / capexTotal) * 100).toFixed(1)}% montażu` : '0.0%'}
                            icon={TrendingUp}
                            tooltipContent="Bezzwrotne dofinansowanie publiczne (unijne/krajowe) obniżające zapotrzebowanie na kapitał własny i dług komercyjny."
                        />
                        <MetricCard
                            title="HORYZONT MODELU"
                            value={`${selectedProject.planning_horizon_years || 15} LAT`}
                            subtitle={selectedProject.commercial_operation_date ? `COD: ${selectedProject.commercial_operation_date}` : 'Start: ' + (selectedProject.start_date || 'N/A')}
                            icon={Clock}
                            className="col-span-2 lg:col-span-1"
                            tooltipContent="Wieloletni horyzont prognozy finansowej (typowo 10–15 lat) uwzględniający fazę budowy, rozruchu oraz pełnej komercyjnej eksploatacji (COD)."
                        />
                    </div>

                    {/* Sub-tabs Navigation */}
                    <div className="border-b border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center gap-2 overflow-x-auto pb-px">
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <Tooltip key={tab.id} content={tab.sublabel} placement="bottom">
                                        <button
                                            onClick={() => setActiveTab(tab.id)}
                                            aria-label={`${tab.label} - ${tab.sublabel}`}
                                            className={`flex items-center gap-2.5 px-4 py-3 border-b-2 text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                                                isActive
                                                    ? 'border-emerald-500 text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-900/40'
                                                    : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/20'
                                            }`}
                                        >
                                            <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-500'}`} />
                                            <span>{tab.label}</span>
                                        </button>
                                    </Tooltip>
                                );
                            })}
                        </div>
                    </div>

                    {/* Tab Content Shell */}
                    <div className="mt-4">
                        {activeTab === 'assumptions' && (
                            <div className="space-y-6">
                                <div className="p-4 bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 rounded-lg flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-3">
                                        <Tooltip content="Konfiguracja założeń wejściowych">
                                            <div className="w-8 h-8 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                                <Sliders className="w-4 h-4" />
                                            </div>
                                        </Tooltip>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-zinc-900 dark:text-zinc-100 uppercase">
                                                    Konfigurator Założeń Projektu Finance
                                                </span>
                                                <InfoTooltip
                                                    content="Definiuj etapy wydatkowania nakładów CAPEX, metody amortyzacji podatkowej KŚT, strukturę kapitałową oraz dynamikę przychodów i kosztów operacyjnych."
                                                    size="xs"
                                                />
                                            </div>
                                            <p className="text-zinc-500 dark:text-zinc-400 text-[11px] mt-0.5">
                                                Wprowadzaj etapy CAPEX z klasyfikacją KŚT, konfiguruj instrumenty dłużne i definiuj prognozy operacyjne.
                                            </p>
                                        </div>
                                    </div>
                                    <Tooltip content="Sekcja definiowania parametrów bazowych przed uruchomieniem kalkulacji">
                                        <Badge variant="neutral">PARAMETRY WEJŚCIOWE</Badge>
                                    </Tooltip>
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
                            <div className="space-y-6">
                                <BankingCovenantsStrip />
                                <ExitValuationOverlay />
                                <ExitWaterfallVisualizer />
                                <ThreeStatementGrid />
                            </div>
                        )}

                        {activeTab === 'dossier' && (
                            <div className="space-y-6">
                                <InvestmentDossierPdfGenerator />
                                <InvestmentReadinessScorecard />
                                <CustomReportBuilder />
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Create Project Modal */}
            {isCreateModalOpen && (
                <CreateProjectModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    onSubmit={createProject}
                />
            )}
        </div>
    );
};
