import React, { useState, useEffect, useMemo } from 'react';
import {
    DollarSign,
    Layers,
    Landmark,
    Percent,
    ShieldCheck,
    AlertCircle,
    CheckCircle2,
    Save,
    RotateCcw,
    Calendar,
    Building2,
    PieChart,
    Info,
    Sparkles
} from 'lucide-react';
import { useInvestmentProject } from '../../context/InvestmentProjectContext';
import { investmentProjectsApi } from '../../api/investmentProjects';
import { Tooltip, InfoTooltip } from '../ui/Tooltip';

const formatCurrency = (val, currency = 'PLN') => {
    return new Intl.NumberFormat('pl-PL', {
        style: 'currency',
        currency: currency,
        maximumFractionDigits: 2,
    }).format(Number(val) || 0);
};

export const FinancingStructureConfigurator = () => {
    const { selectedProject, loadProjectDetails } = useInvestmentProject();

    // Local form state
    const [equityContribution, setEquityContribution] = useState(0);
    const [sponsorSharePercent, setSponsorSharePercent] = useState(100);
    const [debtPrincipal, setDebtPrincipal] = useState(0);
    const [baseRateType, setBaseRateType] = useState('WIBOR_3M');
    const [baseRatePercent, setBaseRatePercent] = useState(5.85);
    const [marginPercent, setMarginPercent] = useState(2.00);
    const [tenorMonths, setTenorMonths] = useState(120);
    const [gracePeriodMonths, setGracePeriodMonths] = useState(0);
    const [amortizationType, setAmortizationType] = useState('ANNUITY');
    const [upfrontFeePercent, setUpfrontFeePercent] = useState(0);
    const [grantAmount, setGrantAmount] = useState(0);
    const [vatBridgeLoan, setVatBridgeLoan] = useState(0);

    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState(null);

    // Synchronize state when selectedProject changes
    useEffect(() => {
        if (!selectedProject) return;

        const fs = selectedProject.financing_structure || {};
        const df = (selectedProject.debt_facilities && selectedProject.debt_facilities[0]) || {};

        setEquityContribution(Number(fs.equity_contribution ?? 0));
        setGrantAmount(Number(fs.grant_amount ?? 0));
        setVatBridgeLoan(Number(fs.vat_bridge_loan ?? 0));

        setDebtPrincipal(Number(df.principal_amount ?? fs.bank_loan_amount ?? 0));
        setBaseRateType(df.base_rate_type || 'WIBOR_3M');
        setBaseRatePercent(Number(df.base_rate_percent ?? df.base_rate_value ?? 5.85));
        setMarginPercent(Number(df.margin_percent ?? df.interest_margin ?? 2.00));
        setTenorMonths(Number(df.tenor_months ?? 120));
        setGracePeriodMonths(Number(df.grace_period_months ?? 0));
        setAmortizationType(df.amortization_type || 'ANNUITY');
        setUpfrontFeePercent(Number(df.upfront_fee_percent ?? 0));
        setSaveSuccess(false);
        setSaveError(null);
    }, [selectedProject]);

    // Computed totals from project
    const totalCapex = useMemo(() => {
        if (!selectedProject?.capex_stages?.length) {
            return Number(selectedProject?.total_capex ?? 0);
        }
        return selectedProject.capex_stages.reduce(
            (sum, stage) => sum + (parseFloat(stage.net_amount) || 0),
            0
        );
    }, [selectedProject]);

    const currency = selectedProject?.currency || 'PLN';

    // Total sources of funding
    const totalFunding = equityContribution + debtPrincipal + grantAmount;
    const fundingGap = totalCapex - totalFunding;
    const isBalanced = Math.abs(fundingGap) < 1;
    const hasGap = fundingGap >= 1;
    const hasSurplus = fundingGap <= -1;

    // Percentages
    const equityPercentOfFunding = totalFunding > 0 ? (equityContribution / totalFunding) * 100 : 0;
    const debtPercentOfFunding = totalFunding > 0 ? (debtPrincipal / totalFunding) * 100 : 0;
    const grantPercentOfFunding = totalFunding > 0 ? (grantAmount / totalFunding) * 100 : 0;

    // Debt metrics
    const totalNominalRate = baseRatePercent + marginPercent;
    const tenorYears = (tenorMonths / 12).toFixed(1);

    // Sponsor vs Co-investor
    const sponsorEquity = (equityContribution * sponsorSharePercent) / 100;
    const coInvestorEquity = equityContribution - sponsorEquity;

    // Quick setters
    const handleSetEquityPercent = (pct) => {
        if (totalCapex > 0) {
            const val = Math.round((totalCapex * pct) / 100);
            setEquityContribution(val);
        }
    };

    const handleSetDebtPercent = (pct) => {
        if (totalCapex > 0) {
            const val = Math.round((totalCapex * pct) / 100);
            setDebtPrincipal(val);
        }
    };

    const handleAutoVatBridge = () => {
        if (totalCapex > 0) {
            // Standard Polish VAT 23%
            setVatBridgeLoan(Math.round(totalCapex * 0.23));
        }
    };

    const handleCoverGapWithEquity = () => {
        if (hasGap) {
            setEquityContribution((prev) => prev + fundingGap);
        }
    };

    const handleCoverGapWithDebt = () => {
        if (hasGap) {
            setDebtPrincipal((prev) => prev + fundingGap);
        }
    };

    const handleReset = () => {
        if (!selectedProject) return;
        const fs = selectedProject.financing_structure || {};
        const df = (selectedProject.debt_facilities && selectedProject.debt_facilities[0]) || {};

        setEquityContribution(Number(fs.equity_contribution ?? 0));
        setGrantAmount(Number(fs.grant_amount ?? 0));
        setVatBridgeLoan(Number(fs.vat_bridge_loan ?? 0));

        setDebtPrincipal(Number(df.principal_amount ?? fs.bank_loan_amount ?? 0));
        setBaseRateType(df.base_rate_type || 'WIBOR_3M');
        setBaseRatePercent(Number(df.base_rate_percent ?? df.base_rate_value ?? 5.85));
        setMarginPercent(Number(df.margin_percent ?? df.interest_margin ?? 2.00));
        setTenorMonths(Number(df.tenor_months ?? 120));
        setGracePeriodMonths(Number(df.grace_period_months ?? 0));
        setAmortizationType(df.amortization_type || 'ANNUITY');
        setUpfrontFeePercent(Number(df.upfront_fee_percent ?? 0));
        setSaveSuccess(false);
        setSaveError(null);
    };

    const handleSave = async () => {
        if (!selectedProject?.id) return;

        setIsSaving(true);
        setSaveSuccess(false);
        setSaveError(null);

        const payload = {
            financing_structure: {
                equity_contribution: equityContribution,
                sponsor_share_percent: sponsorSharePercent,
                bank_loan_amount: debtPrincipal,
                grant_amount: grantAmount,
                vat_bridge_loan: vatBridgeLoan,
            },
            debt_facilities: [
                {
                    facility_name: 'Kredyt Senioralny Bankowy',
                    facility_type: 'SENIOR_LOAN',
                    principal_amount: debtPrincipal,
                    currency: currency,
                    base_rate_type: baseRateType,
                    base_rate_percent: baseRatePercent,
                    margin_percent: marginPercent,
                    tenor_months: tenorMonths,
                    grace_period_months: gracePeriodMonths,
                    amortization_type: amortizationType,
                    upfront_fee_percent: upfrontFeePercent,
                }
            ]
        };

        try {
            await investmentProjectsApi.updateProject(selectedProject.id, payload);
            setSaveSuccess(true);
            await loadProjectDetails(selectedProject.id);
            setTimeout(() => setSaveSuccess(false), 3500);
        } catch (err) {
            const msg = err.response?.data?.message || 'Błąd podczas zapisywania struktury finansowania.';
            setSaveError(msg);
        } finally {
            setIsSaving(false);
        }
    };

    if (!selectedProject) {
        return (
            <div className="p-8 text-center text-zinc-400 bg-zinc-900/40 border border-zinc-800 rounded-xl">
                Wybierz projekt inwestycyjny, aby skonfigurować montaż finansowy.
            </div>
        );
    }

    return (
        <div className="space-y-6" data-testid="financing-structure-configurator">
            {/* Header / Summary Metrics Card */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                                <Layers className="w-5 h-5 text-indigo-400" />
                                Montaż Finansowy & Struktura Długu
                            </h3>
                            <InfoTooltip
                                content="Konfiguracja montażu finansowego (Capital Stack): optymalizacja proporcji długu do kapitału własnego (D/E), warunków transz kredytowych (tenor, marża, karencja, profil spłaty) oraz dotacji unijnych dla zapewnienia zbilansowania nakładów CAPEX."
                                ariaLabel="Informacje o montażu finansowym i strukturze długu"
                                size="xs"
                            />
                        </div>
                        <p className="text-sm text-zinc-400">
                            Konfiguracja źródeł kapitału (Capital Stack), warunków kredytowania, dotacji i bilansowanie luki finansowej.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {isBalanced && (
                            <Tooltip content="Pozyskany kapitał w 100% pokrywa zdefiniowane nakłady CAPEX">
                                <span tabIndex={0} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 cursor-help focus:outline-none">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Finansowanie w pełni zbilansowane (100%)
                                </span>
                            </Tooltip>
                        )}
                        {hasGap && (
                            <Tooltip content="Pozyskane finansowanie jest mniejsze niż łączne nakłady CAPEX. Wymagane zwiększenie equity, długu lub dotacji.">
                                <span tabIndex={0} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30 cursor-help focus:outline-none">
                                    <AlertCircle className="w-4 h-4" />
                                    Luka finansowa: {formatCurrency(fundingGap, currency)}
                                </span>
                            </Tooltip>
                        )}
                        {hasSurplus && (
                            <Tooltip content="Suma źródeł finansowania przewyższa zaplanowane nakłady CAPEX. Nadwyżka zasili rezerwę płynnościową.">
                                <span tabIndex={0} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/30 cursor-help focus:outline-none">
                                    <Info className="w-4 h-4" />
                                    Nadwyżka kapitału: {formatCurrency(Math.abs(fundingGap), currency)}
                                </span>
                            </Tooltip>
                        )}
                    </div>
                </div>

                {/* Key Metrics Bar */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-3.5">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-zinc-400">Nakłady CAPEX</span>
                            <InfoTooltip
                                content="Całkowity koszt realizacji inwestycji wynikający z harmonogramu etapów CAPEX."
                                ariaLabel="Informacje o nakładach CAPEX"
                                size="xs"
                            />
                        </div>
                        <span className="text-lg font-bold font-mono text-zinc-100">
                            {formatCurrency(totalCapex, currency)}
                        </span>
                        {totalCapex === 0 && (
                            <Tooltip content="Dodaj etapy w Harmonogramie CAPEX, aby skalkulować pełny bilans">
                                <span tabIndex={0} className="text-[10px] text-zinc-500 block mt-0.5 cursor-help focus:outline-none" title="Dodaj etapy w Harmonogramie CAPEX, aby skalkulować pełny bilans">
                                    Brak etapów w harmonogramie
                                </span>
                            </Tooltip>
                        )}
                    </div>

                    <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-3.5">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-zinc-400">Pozyskany Kapitał</span>
                            <InfoTooltip
                                content="Łączna suma zadeklarowanego wkładu własnego (Equity), długu bankowego (Senior Debt) oraz dotacji bezzwrotnych."
                                ariaLabel="Informacje o pozyskanym kapitale"
                                size="xs"
                            />
                        </div>
                        <span className="text-lg font-bold font-mono text-emerald-400">
                            {formatCurrency(totalFunding, currency)}
                        </span>
                    </div>

                    <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-3.5">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-zinc-400">Luka / Nadwyżka</span>
                            <InfoTooltip
                                content="Różnica pomiędzy pozyskanym finansowaniem a zapotrzebowaniem CAPEX. Wartość 0,00 oznacza pełne zbilansowanie montażu."
                                ariaLabel="Informacje o luce lub nadwyżce montażu"
                                size="xs"
                            />
                        </div>
                        <span className={`text-lg font-bold font-mono ${isBalanced ? 'text-zinc-400' : hasGap ? 'text-rose-400' : 'text-sky-400'}`}>
                            {hasGap ? `-${formatCurrency(fundingGap, currency)}` : hasSurplus ? `+${formatCurrency(Math.abs(fundingGap), currency)}` : '0,00 ' + currency}
                        </span>
                    </div>

                    <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-3.5">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-zinc-400">Oprocentowanie Długu</span>
                            <InfoTooltip
                                content="Nominalny łączny koszt długu senioralnego równy sumie stopy bazowej (np. WIBOR/EURIBOR) oraz marży bankowej."
                                ariaLabel="Informacje o oprocentowaniu długu"
                                size="xs"
                            />
                        </div>
                        <span className="text-lg font-bold font-mono text-amber-400">
                            {totalNominalRate.toFixed(2)}% <span className="text-xs font-normal text-zinc-500">nom.</span>
                        </span>
                    </div>
                </div>

                {/* Visual Capital Stack Stacked Bar */}
                <div className="mt-6">
                    <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                        <span className="font-medium">Struktura Źródeł Finansowania:</span>
                        <span>
                            {totalFunding > 0 ? `${totalFunding.toLocaleString('pl-PL')} ${currency} (100%)` : 'Brak danych'}
                        </span>
                    </div>

                    <div className="h-4 w-full bg-zinc-800 rounded-full overflow-hidden flex">
                        {equityPercentOfFunding > 0 && (
                            <Tooltip content={`Wkład własny (Equity): ${equityPercentOfFunding.toFixed(1)}% (${formatCurrency(equityContribution, currency)})`}>
                                <div
                                    tabIndex={0}
                                    style={{ width: `${equityPercentOfFunding}%` }}
                                    className="bg-emerald-500 h-full transition-all duration-300 cursor-help focus:outline-none"
                                    title={`Wkład własny (Equity): ${equityPercentOfFunding.toFixed(1)}%`}
                                />
                            </Tooltip>
                        )}
                        {debtPercentOfFunding > 0 && (
                            <Tooltip content={`Kredyt senioralny (Debt): ${debtPercentOfFunding.toFixed(1)}% (${formatCurrency(debtPrincipal, currency)})`}>
                                <div
                                    tabIndex={0}
                                    style={{ width: `${debtPercentOfFunding}%` }}
                                    className="bg-amber-500 h-full transition-all duration-300 cursor-help focus:outline-none"
                                    title={`Kredyt (Debt): ${debtPercentOfFunding.toFixed(1)}%`}
                                />
                            </Tooltip>
                        )}
                        {grantPercentOfFunding > 0 && (
                            <Tooltip content={`Dotacja bezzwrotna (Grant): ${grantPercentOfFunding.toFixed(1)}% (${formatCurrency(grantAmount, currency)})`}>
                                <div
                                    tabIndex={0}
                                    style={{ width: `${grantPercentOfFunding}%` }}
                                    className="bg-indigo-500 h-full transition-all duration-300 cursor-help focus:outline-none"
                                    title={`Dotacja (Grant): ${grantPercentOfFunding.toFixed(1)}%`}
                                />
                            </Tooltip>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs mt-2.5">
                        <Tooltip content={`Udział wkładu własnego w całym pozyskanym kapitale: ${equityPercentOfFunding.toFixed(1)}%`}>
                            <div tabIndex={0} className="flex items-center gap-1.5 cursor-help focus:outline-none">
                                <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
                                <span className="text-zinc-300">Wkład własny:</span>
                                <span className="font-mono text-zinc-200">{equityPercentOfFunding.toFixed(1)}%</span>
                            </div>
                        </Tooltip>
                        <Tooltip content={`Udział długu bankowego w całym pozyskanym kapitale: ${debtPercentOfFunding.toFixed(1)}%`}>
                            <div tabIndex={0} className="flex items-center gap-1.5 cursor-help focus:outline-none">
                                <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" />
                                <span className="text-zinc-300">Dług bankowy:</span>
                                <span className="font-mono text-zinc-200">{debtPercentOfFunding.toFixed(1)}%</span>
                            </div>
                        </Tooltip>
                        <Tooltip content={`Udział dotacji bezzwrotnych w całym pozyskanym kapitale: ${grantPercentOfFunding.toFixed(1)}%`}>
                            <div tabIndex={0} className="flex items-center gap-1.5 cursor-help focus:outline-none">
                                <span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" />
                                <span className="text-zinc-300">Dotacje:</span>
                                <span className="font-mono text-zinc-200">{grantPercentOfFunding.toFixed(1)}%</span>
                            </div>
                        </Tooltip>
                    </div>
                </div>
            </div>

            {/* Configurator Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Equity Section */}
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
                            <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-emerald-400" />
                                <h4 className="font-medium text-zinc-200">Wkład Własny (Equity)</h4>
                                <InfoTooltip
                                    content="Środki własne inwestora/sponsora angażowane w projekt. Mogą być dzielone pomiędzy sponsora a współinwestora finansowego."
                                    ariaLabel="Informacje o wkładzie własnym"
                                    size="xs"
                                />
                            </div>
                            <span
                                className={`text-xs font-mono font-semibold ${totalCapex > 0 ? 'text-emerald-400' : totalFunding > 0 ? 'text-emerald-400/90' : 'text-zinc-500'}`}
                                title={totalCapex === 0 && totalFunding > 0 ? 'Wartość względem pozyskanego kapitału (nakłady CAPEX projektu = 0,00 zł)' : undefined}
                            >
                                {totalCapex > 0
                                    ? `${((equityContribution / totalCapex) * 100).toFixed(1)}% CAPEX`
                                    : totalFunding > 0
                                    ? `${equityPercentOfFunding.toFixed(1)}% Kapitału`
                                    : '0.0% CAPEX'}
                            </span>
                        </div>

                        {/* Amount Input & Slider */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs text-zinc-400">
                                <div className="flex items-center gap-1.5">
                                    <span>Kwota Wkładu Własnego</span>
                                    <InfoTooltip
                                        content="Łączna kwota kapitału własnego przeznaczona na sfinansowanie wydatków inwestycyjnych."
                                        ariaLabel="Informacje o kwocie wkładu własnego"
                                        size="xs"
                                    />
                                </div>
                                <span className="font-mono text-zinc-300">{formatCurrency(equityContribution, currency)}</span>
                            </div>
                            <input
                                type="number"
                                aria-label="Kwota Wkładu Własnego"
                                value={equityContribution}
                                onChange={(e) => setEquityContribution(Math.max(0, parseFloat(e.target.value) || 0))}
                                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-100 font-mono text-sm focus:outline-none focus:border-emerald-500"
                            />
                            <input
                                type="range"
                                min={0}
                                max={Math.max(totalCapex, equityContribution, 1000000)}
                                step={10000}
                                value={equityContribution}
                                onChange={(e) => setEquityContribution(parseFloat(e.target.value) || 0)}
                                className="w-full accent-emerald-500 cursor-pointer"
                            />

                            {/* Quick Percent Buttons */}
                            <div className="flex flex-wrap gap-1.5 pt-1">
                                <Tooltip content="Ustaw wkład własny na poziomie 20% łącznych nakładów CAPEX">
                                    <span>
                                        <button
                                            type="button"
                                            disabled={totalCapex <= 0}
                                            title={totalCapex <= 0 ? 'Wymaga zdefiniowania etapów w Harmonogramie CAPEX' : undefined}
                                            onClick={() => handleSetEquityPercent(20)}
                                            className="px-2 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                            20% CAPEX
                                        </button>
                                    </span>
                                </Tooltip>
                                <Tooltip content="Ustaw wkład własny na poziomie 30% łącznych nakładów CAPEX">
                                    <span>
                                        <button
                                            type="button"
                                            disabled={totalCapex <= 0}
                                            title={totalCapex <= 0 ? 'Wymaga zdefiniowania etapów w Harmonogramie CAPEX' : undefined}
                                            onClick={() => handleSetEquityPercent(30)}
                                            className="px-2 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                            30% CAPEX
                                        </button>
                                    </span>
                                </Tooltip>
                                {hasGap && (
                                    <Tooltip content={`Zwiększ wkład własny o kwotę luki (${formatCurrency(fundingGap, currency)})`}>
                                        <span>
                                            <button
                                                type="button"
                                                onClick={handleCoverGapWithEquity}
                                                className="px-2 py-1 text-xs rounded bg-emerald-950/60 border border-emerald-600/40 text-emerald-300 hover:bg-emerald-900/60 transition-colors"
                                            >
                                                + Pokryj lukę ({formatCurrency(fundingGap, currency)})
                                            </button>
                                        </span>
                                    </Tooltip>
                                )}
                            </div>
                        </div>

                        {/* Sponsor vs Co-Investor Split */}
                        <div className="mt-6 pt-4 border-t border-zinc-800/80 space-y-3">
                            <div className="flex justify-between items-center text-xs text-zinc-400">
                                <div className="flex items-center gap-1.5">
                                    <span>Podział Inwestorów</span>
                                    <InfoTooltip
                                        content="Podział udziałów w kapitale własnym pomiędzy inwestora wiodącego (Sponsora) a zewnętrznego koinwestora kapitałowego."
                                        ariaLabel="Informacje o podziale inwestorów"
                                        size="xs"
                                    />
                                </div>
                                <span>Sponsor: {sponsorSharePercent}% / Finansowy: {100 - sponsorSharePercent}%</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={5}
                                value={sponsorSharePercent}
                                onChange={(e) => setSponsorSharePercent(parseInt(e.target.value, 10) || 0)}
                                className="w-full accent-emerald-400 cursor-pointer"
                            />
                            <div className="grid grid-cols-2 gap-2 text-xs bg-zinc-950/40 p-2.5 rounded border border-zinc-800/60">
                                <div>
                                    <span className="text-zinc-500 block">Sponsor:</span>
                                    <span className="font-mono text-zinc-200">{formatCurrency(sponsorEquity, currency)}</span>
                                </div>
                                <div>
                                    <span className="text-zinc-500 block">Współinwestor:</span>
                                    <span className="font-mono text-zinc-200">{formatCurrency(coInvestorEquity, currency)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Senior Debt Facility Section */}
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
                            <div className="flex items-center gap-2">
                                <Landmark className="w-4 h-4 text-amber-400" />
                                <h4 className="font-medium text-zinc-200">Kredyt Bankowy (Senior Debt)</h4>
                                <InfoTooltip
                                    content="Główny instrument dłużny finansujący fazę inwestycyjną, zabezpieczony na aktywach i przepływach projektu (Project Finance)."
                                    ariaLabel="Informacje o kredycie bankowym"
                                    size="xs"
                                />
                            </div>
                            <span
                                className={`text-xs font-mono font-semibold ${totalCapex > 0 ? 'text-amber-400' : totalFunding > 0 ? 'text-amber-400/90' : 'text-zinc-500'}`}
                                title={totalCapex === 0 && totalFunding > 0 ? 'Wartość względem pozyskanego kapitału (nakłady CAPEX projektu = 0,00 zł)' : undefined}
                            >
                                {totalCapex > 0
                                    ? `${((debtPrincipal / totalCapex) * 100).toFixed(1)}% LTV`
                                    : totalFunding > 0
                                    ? `${debtPercentOfFunding.toFixed(1)}% Kapitału`
                                    : '0.0% LTV'}
                            </span>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs text-zinc-400">
                                <div className="flex items-center gap-1.5">
                                    <span>Kwota Kredytu (Principal)</span>
                                    <InfoTooltip
                                        content="Nominalna wartość kapitału kredytowego udostępnionego przez bank w ramach transzy budowlano-inwestycyjnej."
                                        ariaLabel="Informacje o kwocie kredytu"
                                        size="xs"
                                    />
                                </div>
                                <span className="font-mono text-zinc-300">{formatCurrency(debtPrincipal, currency)}</span>
                            </div>
                            <input
                                type="number"
                                aria-label="Kwota Kredytu"
                                value={debtPrincipal}
                                onChange={(e) => setDebtPrincipal(Math.max(0, parseFloat(e.target.value) || 0))}
                                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-100 font-mono text-sm focus:outline-none focus:border-amber-500"
                            />
                            <input
                                type="range"
                                min={0}
                                max={Math.max(totalCapex, debtPrincipal, 1000000)}
                                step={10000}
                                value={debtPrincipal}
                                onChange={(e) => setDebtPrincipal(parseFloat(e.target.value) || 0)}
                                className="w-full accent-amber-500 cursor-pointer"
                            />

                            {/* Quick buttons */}
                            <div className="flex flex-wrap gap-1.5 pt-1">
                                <Tooltip content="Ustaw kwotę kredytu na poziomie 50% LTV łącznych nakładów CAPEX">
                                    <span>
                                        <button
                                            type="button"
                                            disabled={totalCapex <= 0}
                                            title={totalCapex <= 0 ? 'Wymaga zdefiniowania etapów w Harmonogramie CAPEX' : undefined}
                                            onClick={() => handleSetDebtPercent(50)}
                                            className="px-2 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                            50% LTV
                                        </button>
                                    </span>
                                </Tooltip>
                                <Tooltip content="Ustaw kwotę kredytu na poziomie 70% LTV łącznych nakładów CAPEX">
                                    <span>
                                        <button
                                            type="button"
                                            disabled={totalCapex <= 0}
                                            title={totalCapex <= 0 ? 'Wymaga zdefiniowania etapów w Harmonogramie CAPEX' : undefined}
                                            onClick={() => handleSetDebtPercent(70)}
                                            className="px-2 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                            70% LTV
                                        </button>
                                    </span>
                                </Tooltip>
                                {hasGap && (
                                    <Tooltip content={`Zwiększ kwotę długu o kwotę luki (${formatCurrency(fundingGap, currency)})`}>
                                        <span>
                                            <button
                                                type="button"
                                                onClick={handleCoverGapWithDebt}
                                                className="px-2 py-1 text-xs rounded bg-amber-950/60 border border-amber-600/40 text-amber-300 hover:bg-amber-900/60 transition-colors"
                                            >
                                                + Pokryj lukę ({formatCurrency(fundingGap, currency)})
                                            </button>
                                        </span>
                                    </Tooltip>
                                )}
                            </div>
                        </div>

                        {/* Debt Rates & Tenor */}
                        <div className="mt-5 pt-4 border-t border-zinc-800/80 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <div className="flex items-center gap-1 mb-1">
                                        <label className="text-xs text-zinc-400 block">Stopa Bazowa (%)</label>
                                        <InfoTooltip
                                            content="Wskaźnik referencyjny stopy procentowej (np. WIBOR 3M, EURIBOR 3M)."
                                            ariaLabel="Informacje o stopie bazowej"
                                            size="xs"
                                        />
                                    </div>
                                    <input
                                        type="number"
                                        step="0.05"
                                        value={baseRatePercent}
                                        onChange={(e) => setBaseRatePercent(parseFloat(e.target.value) || 0)}
                                        className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-zinc-100 font-mono text-xs focus:outline-none focus:border-amber-500"
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center gap-1 mb-1">
                                        <label className="text-xs text-zinc-400 block">Marża Banku (%)</label>
                                        <InfoTooltip
                                            content="Stała marża kredytowa naliczana ponad stopę bazową, ustalona w umowie kredytowej."
                                            ariaLabel="Informacje o marży banku"
                                            size="xs"
                                        />
                                    </div>
                                    <input
                                        type="number"
                                        step="0.05"
                                        value={marginPercent}
                                        onChange={(e) => setMarginPercent(parseFloat(e.target.value) || 0)}
                                        className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-zinc-100 font-mono text-xs focus:outline-none focus:border-amber-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <div className="flex items-center gap-1 mb-1">
                                        <label className="text-xs text-zinc-400 block">
                                            Okres (mies.) <span className="text-zinc-500">({tenorYears} lat)</span>
                                        </label>
                                        <InfoTooltip
                                            content="Całkowity horyzont trwania umowy kredytowej w miesiącach."
                                            ariaLabel="Informacje o okresie kredytowania"
                                            size="xs"
                                        />
                                    </div>
                                    <input
                                        type="number"
                                        min={12}
                                        max={360}
                                        value={tenorMonths}
                                        onChange={(e) => setTenorMonths(parseInt(e.target.value, 10) || 12)}
                                        className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-zinc-100 font-mono text-xs focus:outline-none focus:border-amber-500"
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center gap-1 mb-1">
                                        <label className="text-xs text-zinc-400 block">Karencja (mies.)</label>
                                        <InfoTooltip
                                            content="Okres odroczenia spłaty rat kapitałowych (w trakcie budowy i rozruchu instalacji)."
                                            ariaLabel="Informacje o okresie karencji"
                                            size="xs"
                                        />
                                    </div>
                                    <input
                                        type="number"
                                        min={0}
                                        max={60}
                                        value={gracePeriodMonths}
                                        onChange={(e) => setGracePeriodMonths(parseInt(e.target.value, 10) || 0)}
                                        className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-zinc-100 font-mono text-xs focus:outline-none focus:border-amber-500"
                                    />
                                </div>
                            </div>

                            {/* Amortization Type */}
                            <div>
                                <div className="flex items-center gap-1 mb-1.5">
                                    <label className="text-xs text-zinc-400 block">Profil Spłaty (Amortyzacja)</label>
                                    <InfoTooltip
                                        content="Metoda harmonogramowania rat kapitałowo-odsetkowych w okresie spłaty długu."
                                        ariaLabel="Informacje o profilu spłaty kredytu"
                                        size="xs"
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-1.5 text-xs">
                                    {[
                                        { id: 'ANNUITY', label: 'Annuity', desc: 'Równe raty', tip: 'Równe raty łącznego kapitału i odsetek (malejące odsetki, rosnący kapitał)' },
                                        { id: 'LINEAR', label: 'Linear', desc: 'Równy kapitał', tip: 'Równe raty kapitałowe (malejące łączne raty w czasie)' },
                                        { id: 'BULLET', label: 'Bullet', desc: 'Spłata na koniec', tip: 'Spłata całego kapitału na koniec okresu kredytowania' },
                                    ].map((type) => (
                                        <Tooltip key={type.id} content={type.tip}>
                                            <button
                                                type="button"
                                                onClick={() => setAmortizationType(type.id)}
                                                className={`p-1.5 rounded text-center border transition-all ${
                                                    amortizationType === type.id
                                                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-medium'
                                                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                                }`}
                                            >
                                                <div className="font-semibold">{type.label}</div>
                                                <div className="text-[10px] text-zinc-500">{type.desc}</div>
                                            </button>
                                        </Tooltip>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Grants & VAT Bridge Section */}
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-indigo-400" />
                                <h4 className="font-medium text-zinc-200">Dotacje & Kredyt Pomostowy VAT</h4>
                                <InfoTooltip
                                    content="Bezzwrotne dofinansowanie publiczne zmniejszające zapotrzebowanie na dług/equity oraz linia obrotowa VAT na czas budowy."
                                    ariaLabel="Informacje o dotacjach i kredycie VAT"
                                    size="xs"
                                />
                            </div>
                            <span
                                className={`text-xs font-mono font-semibold ${totalCapex > 0 ? 'text-indigo-400' : totalFunding > 0 ? 'text-indigo-400/90' : 'text-zinc-500'}`}
                                title={totalCapex === 0 && totalFunding > 0 ? 'Wartość względem pozyskanego kapitału (nakłady CAPEX projektu = 0,00 zł)' : undefined}
                            >
                                {totalCapex > 0
                                    ? `${((grantAmount / totalCapex) * 100).toFixed(1)}% Dotacji`
                                    : totalFunding > 0
                                    ? `${grantPercentOfFunding.toFixed(1)}% Kapitału`
                                    : '0.0% Dotacji'}
                            </span>
                        </div>

                        {/* Grant Amount */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs text-zinc-400">
                                <div className="flex items-center gap-1.5">
                                    <span>Dotacja Bezzwrotna (Grant)</span>
                                    <InfoTooltip
                                        content="Kwota dofinansowania z programów krajowych lub funduszy UE, która nie podlega zwrotowi."
                                        ariaLabel="Informacje o dotacji bezzwrotnej"
                                        size="xs"
                                    />
                                </div>
                                <span className="font-mono text-zinc-300">{formatCurrency(grantAmount, currency)}</span>
                            </div>
                            <input
                                type="number"
                                aria-label="Dotacja Bezzwrotna"
                                value={grantAmount}
                                onChange={(e) => setGrantAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-100 font-mono text-sm focus:outline-none focus:border-indigo-500"
                            />
                            <input
                                type="range"
                                min={0}
                                max={Math.max(totalCapex, 1000000)}
                                step={10000}
                                value={grantAmount}
                                onChange={(e) => setGrantAmount(parseFloat(e.target.value) || 0)}
                                className="w-full accent-indigo-500 cursor-pointer"
                            />
                        </div>

                        {/* VAT Bridge Loan */}
                        <div className="mt-5 pt-4 border-t border-zinc-800/80 space-y-3">
                            <div className="flex items-center justify-between text-xs text-zinc-400">
                                <div className="flex items-center gap-1.5">
                                    <span>Kredyt Pomostowy VAT (Revolving)</span>
                                    <InfoTooltip
                                        content="Odnawialna linia kredytowa przeznaczona wyłącznie na finansowanie podatku VAT naliczonego na fakturach wykonawców."
                                        ariaLabel="Informacje o kredycie pomostowym VAT"
                                        size="xs"
                                    />
                                </div>
                                <span className="font-mono text-zinc-300">{formatCurrency(vatBridgeLoan, currency)}</span>
                            </div>
                            <input
                                type="number"
                                aria-label="Kredyt Pomostowy VAT"
                                value={vatBridgeLoan}
                                onChange={(e) => setVatBridgeLoan(Math.max(0, parseFloat(e.target.value) || 0))}
                                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-100 font-mono text-sm focus:outline-none focus:border-indigo-500"
                            />
                            <Tooltip content="Automatycznie wylicz i ustaw 23% wartości CAPEX jako kredyt pomostowy VAT">
                                <span>
                                    <button
                                        type="button"
                                        disabled={totalCapex <= 0}
                                        title={totalCapex <= 0 ? 'Wymaga zdefiniowania etapów w Harmonogramie CAPEX' : undefined}
                                        onClick={handleAutoVatBridge}
                                        className="w-full py-1.5 px-3 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <Percent className="w-3.5 h-3.5 text-zinc-400" />
                                        Ustaw standardowy VAT 23% od CAPEX ({formatCurrency(totalCapex * 0.23, currency)})
                                    </button>
                                </span>
                            </Tooltip>

                            <div className="p-3 bg-zinc-950/40 rounded border border-zinc-800/60 text-xs text-zinc-400 space-y-1 mt-3">
                                <div className="font-medium text-zinc-300">Uwagi dotyczące VAT:</div>
                                <p className="text-[11px] leading-relaxed text-zinc-500">
                                    Kredyt obrotowy VAT nie wchodzi w trwały montaż kapitałowy projektu, lecz chroni płynność operacyjną na etapie budowy przed zwrotem podatku z US.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl">
                <div className="flex items-center gap-2">
                    {saveSuccess && (
                        <span className="text-sm text-emerald-400 flex items-center gap-1.5 animate-fadeIn">
                            <CheckCircle2 className="w-4 h-4" />
                            Struktura finansowania została pomyślnie zapisana.
                        </span>
                    )}
                    {saveError && (
                        <span className="text-sm text-rose-400 flex items-center gap-1.5 animate-fadeIn">
                            <AlertCircle className="w-4 h-4" />
                            {saveError}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Tooltip content="Przywróć ostatnio zapisaną strukturę finansowania">
                        <span>
                            <button
                                type="button"
                                onClick={handleReset}
                                disabled={isSaving}
                                aria-label="Resetuj parametry montażu finansowego"
                                className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Resetuj
                            </button>
                        </span>
                    </Tooltip>

                    <Tooltip content="Zapisz zaktualizowaną strukturę i montaż finansowy projektu">
                        <span>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving}
                                aria-label="Zapisz montaż finansowy"
                                className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                            >
                                {isSaving ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Zapisywanie...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        Zapisz Montaż Finansowy
                                    </>
                                )}
                            </button>
                        </span>
                    </Tooltip>
                </div>
            </div>
        </div>
    );
};
