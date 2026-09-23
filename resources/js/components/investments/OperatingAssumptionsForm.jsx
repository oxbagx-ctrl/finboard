import React, { useState, useEffect, useMemo } from 'react';
import {
    Activity,
    TrendingUp,
    Users,
    Clock,
    DollarSign,
    Percent,
    Sliders,
    Plus,
    Trash2,
    Save,
    RotateCcw,
    CheckCircle2,
    AlertCircle,
    Info,
    ShieldCheck,
    Receipt
} from 'lucide-react';
import { useInvestmentProject } from '../../context/InvestmentProjectContext';
import { investmentProjectsApi } from '../../api/investmentProjects';

const formatCurrency = (val, currency = 'PLN') => {
    return new Intl.NumberFormat('pl-PL', {
        style: 'currency',
        currency: currency,
        maximumFractionDigits: 2,
    }).format(Number(val) || 0);
};

const getDefaultAssumptions = (project = null) => {
    const wcd = project?.working_capital_days;
    return {
        revenueLines: [],
        revenueGrowthRate: 2.5,
        capacityRampUp: { 1: 100, 2: 100, 3: 100 },
        variableCostPercent: 0.0,
        annualFixedCostsBase: 0,
        fixedCostGrowthRate: 2.5,
        dso: Number(wcd?.dso ?? project?.dso ?? 30),
        dpo: Number(wcd?.dpo ?? project?.dpo ?? 30),
        dio: Number(wcd?.dio ?? project?.dio ?? 0),
        headcountMatrix: [],
        payrollGrowthRate: 3.0,
        citRatePercent: 19.0,
        taxLossCarryForward: true,
        taxLossOffsetCap: 50.0,
    };
};

const parseProjectAssumptions = (project) => {
    const defaults = getDefaultAssumptions(project);
    if (!project) return defaults;

    const oa = project.operating_assumptions || {};

    let revLines = defaults.revenueLines;
    const rawRev = oa.revenue_lines ?? oa.revenueLines;
    if (Array.isArray(rawRev) && rawRev.length > 0) {
        revLines = rawRev;
    } else if (oa.annual_revenue_base && Number(oa.annual_revenue_base) > 0) {
        revLines = [
            {
                id: 'rev-1',
                name: 'Przychody operacyjne bazowe',
                unit: 'usł.',
                volume: 1,
                price: Number(oa.annual_revenue_base),
                total: Number(oa.annual_revenue_base)
            }
        ];
    }

    let hcMatrix = defaults.headcountMatrix;
    const rawHc = oa.headcount_matrix ?? oa.headcountMatrix;
    if (Array.isArray(rawHc) && rawHc.length > 0) {
        hcMatrix = rawHc;
    }

    let rampUp = defaults.capacityRampUp;
    if (oa.capacity_ramp_up && typeof oa.capacity_ramp_up === 'object') {
        rampUp = {
            1: Number(oa.capacity_ramp_up[1] ?? oa.capacity_ramp_up['1'] ?? 100),
            2: Number(oa.capacity_ramp_up[2] ?? oa.capacity_ramp_up['2'] ?? 100),
            3: Number(oa.capacity_ramp_up[3] ?? oa.capacity_ramp_up['3'] ?? 100),
        };
    }

    return {
        revenueLines: revLines,
        revenueGrowthRate: oa.revenue_growth_rate_percent !== undefined ? Number(oa.revenue_growth_rate_percent) : defaults.revenueGrowthRate,
        capacityRampUp: rampUp,
        variableCostPercent: oa.variable_cost_percent !== undefined ? Number(oa.variable_cost_percent) : defaults.variableCostPercent,
        annualFixedCostsBase: oa.annual_fixed_costs_base !== undefined ? Number(oa.annual_fixed_costs_base) : defaults.annualFixedCostsBase,
        fixedCostGrowthRate: oa.fixed_cost_growth_rate_percent !== undefined ? Number(oa.fixed_cost_growth_rate_percent) : defaults.fixedCostGrowthRate,
        dso: oa.dso !== undefined ? Number(oa.dso) : defaults.dso,
        dpo: oa.dpo !== undefined ? Number(oa.dpo) : defaults.dpo,
        dio: oa.dio !== undefined ? Number(oa.dio) : defaults.dio,
        headcountMatrix: hcMatrix,
        payrollGrowthRate: oa.payroll_growth_rate_percent !== undefined ? Number(oa.payroll_growth_rate_percent) : defaults.payrollGrowthRate,
        citRatePercent: oa.cit_rate_percent !== undefined ? Number(oa.cit_rate_percent) : defaults.citRatePercent,
        taxLossCarryForward: oa.tax_loss_carry_forward_enabled !== undefined ? Boolean(oa.tax_loss_carry_forward_enabled) : defaults.taxLossCarryForward,
        taxLossOffsetCap: oa.tax_loss_offset_cap_percent !== undefined ? Number(oa.tax_loss_offset_cap_percent) : defaults.taxLossOffsetCap,
    };
};

export const OperatingAssumptionsForm = () => {
    const { selectedProject, loadProjectDetails } = useInvestmentProject();

    const [activeSubTab, setActiveSubTab] = useState('revenues');

    // Revenue lines & Ramp-up
    const [revenueLines, setRevenueLines] = useState([]);
    const [revenueGrowthRate, setRevenueGrowthRate] = useState(2.5);
    const [capacityRampUp, setCapacityRampUp] = useState({ 1: 100, 2: 100, 3: 100 });

    // OPEX drivers
    const [variableCostPercent, setVariableCostPercent] = useState(0.0);
    const [annualFixedCostsBase, setAnnualFixedCostsBase] = useState(0);
    const [fixedCostGrowthRate, setFixedCostGrowthRate] = useState(2.5);

    // Working Capital (NWC)
    const [dso, setDso] = useState(30);
    const [dpo, setDpo] = useState(30);
    const [dio, setDio] = useState(0);

    // Headcount matrix & Payroll
    const [headcountMatrix, setHeadcountMatrix] = useState([]);
    const [payrollGrowthRate, setPayrollGrowthRate] = useState(3.0);

    // CIT Taxes & Loss offset
    const [citRatePercent, setCitRatePercent] = useState(19.0);
    const [taxLossCarryForward, setTaxLossCarryForward] = useState(true);
    const [taxLossOffsetCap, setTaxLossOffsetCap] = useState(50.0);

    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState(null);

    // Load and synchronize state from selectedProject.operating_assumptions with clean fallback
    useEffect(() => {
        if (!selectedProject) return;

        const parsed = parseProjectAssumptions(selectedProject);
        setRevenueLines(parsed.revenueLines);
        setRevenueGrowthRate(parsed.revenueGrowthRate);
        setCapacityRampUp(parsed.capacityRampUp);
        setVariableCostPercent(parsed.variableCostPercent);
        setAnnualFixedCostsBase(parsed.annualFixedCostsBase);
        setFixedCostGrowthRate(parsed.fixedCostGrowthRate);
        setDso(parsed.dso);
        setDpo(parsed.dpo);
        setDio(parsed.dio);
        setHeadcountMatrix(parsed.headcountMatrix);
        setPayrollGrowthRate(parsed.payrollGrowthRate);
        setCitRatePercent(parsed.citRatePercent);
        setTaxLossCarryForward(parsed.taxLossCarryForward);
        setTaxLossOffsetCap(parsed.taxLossOffsetCap);

        setSaveSuccess(false);
        setSaveError(null);
    }, [selectedProject]);

    // Computed totals
    const currency = selectedProject?.currency || 'PLN';

    const calculatedAnnualRevenueBase = useMemo(() => {
        return revenueLines.reduce((sum, line) => sum + (Number(line.total) || 0), 0);
    }, [revenueLines]);

    const calculatedAnnualPayrollBase = useMemo(() => {
        return headcountMatrix.reduce((sum, item) => sum + (Number(item.annualCost) || 0), 0);
    }, [headcountMatrix]);

    const totalFte = useMemo(() => {
        return headcountMatrix.reduce((sum, item) => sum + (Number(item.fte) || 0), 0);
    }, [headcountMatrix]);

    const calculatedVariableCosts = calculatedAnnualRevenueBase * (variableCostPercent / 100);
    const calculatedEbitda = calculatedAnnualRevenueBase - calculatedVariableCosts - annualFixedCostsBase - calculatedAnnualPayrollBase;
    const calculatedEbitdaMargin = calculatedAnnualRevenueBase > 0 ? (calculatedEbitda / calculatedAnnualRevenueBase) * 100 : 0;

    // Cash Conversion Cycle: CCC = DIO + DSO - DPO
    const cashConversionCycle = dio + dso - dpo;

    // Revenue line handlers
    const handleAddRevenueLine = () => {
        const newLine = {
            id: `rev-${Date.now()}`,
            name: 'Nowa linia przychodowa',
            unit: 'szt.',
            volume: 1000,
            price: 100,
            total: 100000,
        };
        setRevenueLines([...revenueLines, newLine]);
    };

    const handleUpdateRevenueLine = (id, field, value) => {
        setRevenueLines(revenueLines.map(line => {
            if (line.id !== id) return line;
            const updated = { ...line, [field]: value };
            if (field === 'volume' || field === 'price') {
                const vol = field === 'volume' ? Number(value) || 0 : Number(line.volume) || 0;
                const pr = field === 'price' ? Number(value) || 0 : Number(line.price) || 0;
                updated.total = vol * pr;
            }
            return updated;
        }));
    };

    const handleRemoveRevenueLine = (id) => {
        setRevenueLines(revenueLines.filter(line => line.id !== id));
    };

    // Headcount matrix handlers
    const handleAddHeadcountRole = () => {
        const newRole = {
            id: `hc-${Date.now()}`,
            role: 'Nowe stanowisko operacyjne',
            fte: 1,
            grossSalary: 8000,
            employerCostRate: 20.48,
            annualCost: Math.round(1 * 8000 * 1.2048 * 12),
        };
        setHeadcountMatrix([...headcountMatrix, newRole]);
    };

    const handleUpdateHeadcountRole = (id, field, value) => {
        setHeadcountMatrix(headcountMatrix.map(item => {
            if (item.id !== id) return item;
            const updated = { ...item, [field]: value };
            if (field === 'fte' || field === 'grossSalary' || field === 'employerCostRate') {
                const f = field === 'fte' ? Number(value) || 0 : Number(item.fte) || 0;
                const gs = field === 'grossSalary' ? Number(value) || 0 : Number(item.grossSalary) || 0;
                const ec = field === 'employerCostRate' ? Number(value) || 0 : Number(item.employerCostRate) || 0;
                updated.annualCost = Math.round(f * gs * (1 + (ec / 100)) * 12);
            }
            return updated;
        }));
    };

    const handleRemoveHeadcountRole = (id) => {
        setHeadcountMatrix(headcountMatrix.filter(item => item.id !== id));
    };

    const handleReset = () => {
        if (!selectedProject) return;
        const parsed = parseProjectAssumptions(selectedProject);
        setRevenueLines(parsed.revenueLines);
        setRevenueGrowthRate(parsed.revenueGrowthRate);
        setCapacityRampUp(parsed.capacityRampUp);
        setVariableCostPercent(parsed.variableCostPercent);
        setAnnualFixedCostsBase(parsed.annualFixedCostsBase);
        setFixedCostGrowthRate(parsed.fixedCostGrowthRate);
        setDso(parsed.dso);
        setDpo(parsed.dpo);
        setDio(parsed.dio);
        setHeadcountMatrix(parsed.headcountMatrix);
        setPayrollGrowthRate(parsed.payrollGrowthRate);
        setCitRatePercent(parsed.citRatePercent);
        setTaxLossCarryForward(parsed.taxLossCarryForward);
        setTaxLossOffsetCap(parsed.taxLossOffsetCap);
        setSaveError(null);
    };

    const handleSave = async () => {
        if (!selectedProject) return;
        setIsSaving(true);
        setSaveError(null);
        setSaveSuccess(false);

        const payload = {
            operating_assumptions: {
                annual_revenue_base: calculatedAnnualRevenueBase,
                revenue_growth_rate_percent: Number(revenueGrowthRate) || 0,
                variable_cost_percent: Number(variableCostPercent) || 0,
                annual_fixed_costs_base: Number(annualFixedCostsBase) || 0,
                fixed_cost_growth_rate_percent: Number(fixedCostGrowthRate) || 0,
                annual_payroll_base: calculatedAnnualPayrollBase,
                payroll_growth_rate_percent: Number(payrollGrowthRate) || 0,
                dso: Number(dso) || 0,
                dpo: Number(dpo) || 0,
                dio: Number(dio) || 0,
                capacity_ramp_up: {
                    1: Number(capacityRampUp[1] || 60),
                    2: Number(capacityRampUp[2] || 85),
                    3: Number(capacityRampUp[3] || 100),
                },
                cit_rate_percent: Number(citRatePercent) || 19,
                tax_loss_carry_forward_enabled: taxLossCarryForward,
                tax_loss_offset_cap_percent: Number(taxLossOffsetCap) || 50,
                revenue_lines: revenueLines,
                headcount_matrix: headcountMatrix,
            },
        };

        try {
            await investmentProjectsApi.updateProject(selectedProject.id, payload);
            setSaveSuccess(true);
            await loadProjectDetails(selectedProject.id);
            setTimeout(() => setSaveSuccess(false), 3500);
        } catch (err) {
            const msg = err.response?.data?.message || 'Błąd podczas zapisywania założeń operacyjnych.';
            setSaveError(msg);
        } finally {
            setIsSaving(false);
        }
    };

    if (!selectedProject) {
        return (
            <div className="p-8 text-center text-zinc-400 bg-zinc-900/40 border border-zinc-800 rounded-xl">
                Wybierz projekt inwestycyjny, aby skonfigurować założenia operacyjne.
            </div>
        );
    }

    return (
        <div className="space-y-6" data-testid="operating-assumptions-form">
            {/* Header & KPI Summary Strip */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
                    <div>
                        <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-emerald-400" />
                            Założenia Operacyjne & Model P&L
                        </h3>
                        <p className="text-sm text-zinc-400">
                            Konfiguracja strumieni przychodowych, driverów OPEX, rotacji kapitału obrotowego (NWC) oraz matrycy zatrudnienia.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                            <Clock className="w-3.5 h-3.5 text-emerald-400" />
                            COD: {selectedProject.commercial_operation_date || 'Nieustalona'}
                        </span>
                    </div>
                </div>

                {/* KPI Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-3.5">
                        <span className="text-xs text-zinc-400 block mb-1">Przychody Bazowe (Rok)</span>
                        <span className="text-lg font-bold font-mono text-zinc-100">
                            {formatCurrency(calculatedAnnualRevenueBase, currency)}
                        </span>
                    </div>

                    <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-3.5">
                        <span className="text-xs text-zinc-400 block mb-1">EBITDA Bazowa (Marża)</span>
                        <span className={`text-lg font-bold font-mono ${calculatedEbitda >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {formatCurrency(calculatedEbitda, currency)}
                            <span className="text-xs font-normal text-zinc-400 ml-1.5">
                                ({calculatedEbitdaMargin.toFixed(1)}%)
                            </span>
                        </span>
                    </div>

                    <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-3.5">
                        <span className="text-xs text-zinc-400 block mb-1">Cykl Konwersji (CCC)</span>
                        <span className={`text-lg font-bold font-mono ${cashConversionCycle <= 45 ? 'text-emerald-400' : cashConversionCycle <= 90 ? 'text-amber-400' : 'text-rose-400'}`}>
                            {cashConversionCycle} dni
                        </span>
                    </div>

                    <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-3.5">
                        <span className="text-xs text-zinc-400 block mb-1">Zespół & Płace (FTE)</span>
                        <span className="text-lg font-bold font-mono text-indigo-400">
                            {totalFte} FTE
                            <span className="text-xs font-normal text-zinc-400 ml-1.5">
                                ({formatCurrency(calculatedAnnualPayrollBase, currency)})
                            </span>
                        </span>
                    </div>
                </div>

                {/* Sub-Tabs Navigation */}
                <div className="flex border-b border-zinc-800 mt-6 gap-2 overflow-x-auto text-xs">
                    {[
                        { id: 'revenues', label: '1. Przychody & Ramp-Up', icon: TrendingUp },
                        { id: 'opex', label: '2. Koszty OPEX', icon: Sliders },
                        { id: 'nwc', label: '3. Kapitał Obrotowy (NWC)', icon: Clock },
                        { id: 'payroll', label: '4. Matryca Etatów', icon: Users },
                        { id: 'taxes', label: '5. Podatki & CIT', icon: Receipt },
                    ].map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeSubTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveSubTab(tab.id)}
                                className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors whitespace-nowrap ${
                                    isActive
                                        ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                                        : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Sub-Tab 1: Revenues & Ramp-up */}
            {activeSubTab === 'revenues' && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-semibold text-zinc-100 flex items-center gap-2 text-sm">
                                <TrendingUp className="w-4 h-4 text-emerald-400" />
                                Linie Przychodowe & Wzrost Organiczny
                            </h4>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Zdefiniuj strumienie operacyjne projektu. Suma wartości stanowi roczną bazę przychodów COD.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleAddRevenueLine}
                            className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-sm font-medium"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Dodaj Strumień
                        </button>
                    </div>

                    {/* Revenue Lines Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-zinc-300">
                            <thead className="bg-zinc-950/80 text-zinc-400 border-b border-zinc-800 font-mono">
                                <tr>
                                    <th className="py-2.5 px-3">Nazwa Strumienia</th>
                                    <th className="py-2.5 px-3 w-28">Jednostka</th>
                                    <th className="py-2.5 px-3 w-32">Wolumen</th>
                                    <th className="py-2.5 px-3 w-36">Cena Jedn. ({currency})</th>
                                    <th className="py-2.5 px-3 w-40 text-right">Roczna Wartość</th>
                                    <th className="py-2.5 px-2 w-12 text-center">Akcja</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60 font-mono">
                                {revenueLines.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-center text-zinc-500">
                                            <div className="flex flex-col items-center justify-center gap-1.5">
                                                <TrendingUp className="w-6 h-6 text-zinc-600 mb-1" />
                                                <p className="font-semibold text-zinc-400 text-xs">Brak zdefiniowanych strumieni przychodowych</p>
                                                <p className="text-[11px] text-zinc-500">Kliknij „Dodaj Strumień”, aby zdefiniować model sprzedaży projektu.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    revenueLines.map(line => (
                                        <tr key={line.id} className="hover:bg-zinc-850/40">
                                            <td className="py-2 px-3">
                                                <input
                                                    type="text"
                                                    aria-label="Nazwa Strumienia"
                                                    value={line.name}
                                                    onChange={(e) => handleUpdateRevenueLine(line.id, 'name', e.target.value)}
                                                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                                                />
                                            </td>
                                            <td className="py-2 px-3">
                                                <input
                                                    type="text"
                                                    aria-label="Jednostka"
                                                    value={line.unit}
                                                    onChange={(e) => handleUpdateRevenueLine(line.id, 'unit', e.target.value)}
                                                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                                                />
                                            </td>
                                            <td className="py-2 px-3">
                                                <input
                                                    type="number"
                                                    aria-label="Wolumen"
                                                    value={line.volume}
                                                    onChange={(e) => handleUpdateRevenueLine(line.id, 'volume', e.target.value)}
                                                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                                                />
                                            </td>
                                            <td className="py-2 px-3">
                                                <input
                                                    type="number"
                                                    aria-label="Cena Jednostkowa"
                                                    step="0.01"
                                                    value={line.price}
                                                    onChange={(e) => handleUpdateRevenueLine(line.id, 'price', e.target.value)}
                                                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                                                />
                                            </td>
                                            <td className="py-2 px-3 text-right font-bold text-emerald-400">
                                                {formatCurrency(line.total, currency)}
                                            </td>
                                            <td className="py-2 px-2 text-center">
                                                <button
                                                    type="button"
                                                    aria-label="Usuń linię"
                                                    onClick={() => handleRemoveRevenueLine(line.id)}
                                                    className="p-1 text-zinc-500 hover:text-rose-400 transition-colors"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot className="bg-zinc-950/90 border-t border-zinc-800 font-mono">
                                <tr>
                                    <td colSpan={4} className="py-2.5 px-3 text-right font-semibold text-zinc-300">
                                        Łączna Baza Przychodów COD:
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-bold text-emerald-400 text-sm">
                                        {formatCurrency(calculatedAnnualRevenueBase, currency)}
                                    </td>
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Ramp-up & Growth Rate */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-800">
                        <div className="bg-zinc-950/60 p-4 rounded-lg border border-zinc-800/80 space-y-3">
                            <label className="text-xs text-zinc-300 font-medium flex justify-between">
                                <span>Roczna Stopa Wzrostu Przychodów (%)</span>
                                <span className="font-mono text-emerald-400">{revenueGrowthRate.toFixed(1)}%</span>
                            </label>
                            <input
                                type="range"
                                min={-10}
                                max={25}
                                step={0.5}
                                value={revenueGrowthRate}
                                onChange={(e) => setRevenueGrowthRate(parseFloat(e.target.value) || 0)}
                                className="w-full accent-emerald-500 cursor-pointer"
                            />
                            <p className="text-[11px] text-zinc-500">
                                Dynamika indeksacji cen lub wzrostu wolumenu sprzedaży w kolejnych latach operacyjnych.
                            </p>
                        </div>

                        <div className="bg-zinc-950/60 p-4 rounded-lg border border-zinc-800/80 space-y-3">
                            <span className="text-xs text-zinc-300 font-medium block">
                                Profil Dojścia do Pełnej Mocy (Ramp-Up %)
                            </span>
                            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                                <div>
                                    <span className="text-[11px] text-zinc-500 block mb-1">Rok 1 (COD)</span>
                                    <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1">
                                        <input
                                            type="number"
                                            min={10}
                                            max={100}
                                            value={capacityRampUp[1] || 60}
                                            onChange={(e) => setCapacityRampUp({ ...capacityRampUp, 1: parseInt(e.target.value, 10) || 0 })}
                                            className="w-full bg-transparent text-zinc-100 text-xs focus:outline-none"
                                        />
                                        <span className="text-zinc-500 text-[10px]">%</span>
                                    </div>
                                </div>
                                <div>
                                    <span className="text-[11px] text-zinc-500 block mb-1">Rok 2</span>
                                    <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1">
                                        <input
                                            type="number"
                                            min={10}
                                            max={100}
                                            value={capacityRampUp[2] || 85}
                                            onChange={(e) => setCapacityRampUp({ ...capacityRampUp, 2: parseInt(e.target.value, 10) || 0 })}
                                            className="w-full bg-transparent text-zinc-100 text-xs focus:outline-none"
                                        />
                                        <span className="text-zinc-500 text-[10px]">%</span>
                                    </div>
                                </div>
                                <div>
                                    <span className="text-[11px] text-zinc-500 block mb-1">Rok 3+</span>
                                    <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1">
                                        <input
                                            type="number"
                                            min={10}
                                            max={100}
                                            value={capacityRampUp[3] || 100}
                                            onChange={(e) => setCapacityRampUp({ ...capacityRampUp, 3: parseInt(e.target.value, 10) || 0 })}
                                            className="w-full bg-transparent text-zinc-100 text-xs focus:outline-none"
                                        />
                                        <span className="text-zinc-500 text-[10px]">%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Sub-Tab 2: OPEX Drivers */}
            {activeSubTab === 'opex' && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-6">
                    <div>
                        <h4 className="font-semibold text-zinc-100 flex items-center gap-2 text-sm">
                            <Sliders className="w-4 h-4 text-amber-400" />
                            Drivery Kosztów Operacyjnych (OPEX)
                        </h4>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            Parametryzacja kosztów zmiennych bezpośrednich oraz bazy kosztów stałych operacji (O&M, ubezpieczenia, podatki od nieruchomości).
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Variable Costs */}
                        <div className="bg-zinc-950/60 p-5 rounded-lg border border-zinc-800/80 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-zinc-200">Koszty Zmienne (% Przychodów)</span>
                                <span className="font-mono text-amber-400 font-bold text-sm">{variableCostPercent.toFixed(1)}%</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={90}
                                step={0.5}
                                value={variableCostPercent}
                                onChange={(e) => setVariableCostPercent(parseFloat(e.target.value) || 0)}
                                className="w-full accent-amber-500 cursor-pointer"
                            />
                            <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800/80 text-xs flex justify-between items-center">
                                <span className="text-zinc-400">Szacowane koszty zmienne COD:</span>
                                <span className="font-mono font-bold text-zinc-200">{formatCurrency(calculatedVariableCosts, currency)}</span>
                            </div>
                            <p className="text-[11px] text-zinc-500">
                                Obejmują surowce, media technologiczne, opłaty przesyłowe i zmienne koszty eksploatacji bezpośrednio proporcjonalne do wolumenu sprzedaży.
                            </p>
                        </div>

                        {/* Fixed Costs */}
                        <div className="bg-zinc-950/60 p-5 rounded-lg border border-zinc-800/80 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-zinc-200">Roczne Koszty Stałe Bazowe</span>
                                <span className="font-mono text-zinc-100 font-bold text-sm">{formatCurrency(annualFixedCostsBase, currency)}</span>
                            </div>
                            <input
                                type="number"
                                aria-label="Roczne Koszty Stałe Bazowe"
                                value={annualFixedCostsBase}
                                onChange={(e) => setAnnualFixedCostsBase(Math.max(0, parseFloat(e.target.value) || 0))}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 font-mono text-sm focus:outline-none focus:border-amber-500"
                            />

                            <div className="pt-2 border-t border-zinc-800 space-y-2">
                                <label className="text-xs text-zinc-400 flex justify-between">
                                    <span>Eskalacja Inflacyjna Kosztów Stałych (%)</span>
                                    <span className="font-mono text-amber-400">{fixedCostGrowthRate.toFixed(1)}%</span>
                                </label>
                                <input
                                    type="range"
                                    min={0}
                                    max={15}
                                    step={0.5}
                                    value={fixedCostGrowthRate}
                                    onChange={(e) => setFixedCostGrowthRate(parseFloat(e.target.value) || 0)}
                                    className="w-full accent-amber-500 cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Sub-Tab 3: Working Capital (NWC) */}
            {activeSubTab === 'nwc' && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-6">
                    <div>
                        <h4 className="font-semibold text-zinc-100 flex items-center gap-2 text-sm">
                            <Clock className="w-4 h-4 text-sky-400" />
                            Cykl Rotacji Kapitału Obrotowego (NWC)
                        </h4>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            Dni rotacji należności (DSO), zobowiązań handlowych (DPO) oraz zapasów (DIO) determinujące zapotrzebowanie na kapitał obrotowy w bilansie.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* DSO */}
                        <div className="bg-zinc-950/60 p-4 rounded-lg border border-zinc-800/80 space-y-3">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-zinc-200">DSO (Należności)</span>
                                <span className="font-mono text-sky-400 font-bold">{dso} dni</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={180}
                                value={dso}
                                onChange={(e) => setDso(parseInt(e.target.value, 10) || 0)}
                                className="w-full accent-sky-500 cursor-pointer"
                            />
                            <p className="text-[11px] text-zinc-500">
                                Średni czas spływu należności od odbiorców faktur sprzedażowych (Days Sales Outstanding).
                            </p>
                        </div>

                        {/* DPO */}
                        <div className="bg-zinc-950/60 p-4 rounded-lg border border-zinc-800/80 space-y-3">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-zinc-200">DPO (Zobowiązania)</span>
                                <span className="font-mono text-emerald-400 font-bold">{dpo} dni</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={180}
                                value={dpo}
                                onChange={(e) => setDpo(parseInt(e.target.value, 10) || 0)}
                                className="w-full accent-emerald-500 cursor-pointer"
                            />
                            <p className="text-[11px] text-zinc-500">
                                Średni termin płatności wobec dostawców i podwykonawców (Days Payable Outstanding).
                            </p>
                        </div>

                        {/* DIO */}
                        <div className="bg-zinc-950/60 p-4 rounded-lg border border-zinc-800/80 space-y-3">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-zinc-200">DIO (Zapasy)</span>
                                <span className="font-mono text-amber-400 font-bold">{dio} dni</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={180}
                                value={dio}
                                onChange={(e) => setDio(parseInt(e.target.value, 10) || 0)}
                                className="w-full accent-amber-500 cursor-pointer"
                            />
                            <p className="text-[11px] text-zinc-500">
                                Rotacja zapasów części zamiennych, paliwa lub surowców (Days Inventory Outstanding).
                            </p>
                        </div>
                    </div>

                    {/* Cash Conversion Cycle Display */}
                    <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                                <Info className="w-4 h-4 text-indigo-400" />
                                Cykl Konwersji Gotówki (Cash Conversion Cycle):
                            </span>
                            <p className="text-[11px] text-zinc-500">
                                Wzór: CCC = DIO ({dio}d) + DSO ({dso}d) - DPO ({dpo}d) = <strong>{cashConversionCycle} dni</strong>.
                            </p>
                        </div>
                        <div className="text-right font-mono">
                            <span className={`text-xl font-bold ${cashConversionCycle <= 45 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {cashConversionCycle} dni
                            </span>
                            <span className="text-[11px] text-zinc-500 block">
                                {cashConversionCycle <= 30 ? 'Optymalna efektywność NWC' : 'Wymaga zaangażowania kapitału obrotowego'}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Sub-Tab 4: Headcount Matrix & Payroll */}
            {activeSubTab === 'payroll' && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-semibold text-zinc-100 flex items-center gap-2 text-sm">
                                <Users className="w-4 h-4 text-indigo-400" />
                                Matryca Etatów & Koszty Wynagrodzeń (Payroll)
                            </h4>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Struktura zatrudnienia, płace brutto oraz narzuty ubezpieczeń społecznych pracodawcy (ZUS / PPK).
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleAddHeadcountRole}
                            className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-sm font-medium"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Dodaj Stanowisko
                        </button>
                    </div>

                    {/* Headcount Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-zinc-300">
                            <thead className="bg-zinc-950/80 text-zinc-400 border-b border-zinc-800 font-mono">
                                <tr>
                                    <th className="py-2.5 px-3">Stanowisko / Rola</th>
                                    <th className="py-2.5 px-3 w-24">Etaty (FTE)</th>
                                    <th className="py-2.5 px-3 w-36">Brutto / m-c ({currency})</th>
                                    <th className="py-2.5 px-3 w-32">Narzut (%)</th>
                                    <th className="py-2.5 px-3 w-40 text-right">Roczny Koszt Pracodawcy</th>
                                    <th className="py-2.5 px-2 w-12 text-center">Akcja</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60 font-mono">
                                {headcountMatrix.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-center text-zinc-500">
                                            <div className="flex flex-col items-center justify-center gap-1.5">
                                                <Users className="w-6 h-6 text-zinc-600 mb-1" />
                                                <p className="font-semibold text-zinc-400 text-xs">Brak zdefiniowanych stanowisk operacyjnych</p>
                                                <p className="text-[11px] text-zinc-500">Kliknij „Dodaj Stanowisko”, aby zaplanować strukturę zatrudnienia.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    headcountMatrix.map(role => (
                                        <tr key={role.id} className="hover:bg-zinc-850/40">
                                            <td className="py-2 px-3">
                                                <input
                                                    type="text"
                                                    aria-label="Nazwa Stanowiska"
                                                    value={role.role}
                                                    onChange={(e) => handleUpdateHeadcountRole(role.id, 'role', e.target.value)}
                                                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                                                />
                                            </td>
                                            <td className="py-2 px-3">
                                                <input
                                                    type="number"
                                                    aria-label="Liczba Etatów"
                                                    min={0.5}
                                                    step={0.5}
                                                    value={role.fte}
                                                    onChange={(e) => handleUpdateHeadcountRole(role.id, 'fte', e.target.value)}
                                                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                                                />
                                            </td>
                                            <td className="py-2 px-3">
                                                <input
                                                    type="number"
                                                    aria-label="Wynagrodzenie Brutto"
                                                    value={role.grossSalary}
                                                    onChange={(e) => handleUpdateHeadcountRole(role.id, 'grossSalary', e.target.value)}
                                                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                                                />
                                            </td>
                                            <td className="py-2 px-3">
                                                <input
                                                    type="number"
                                                    aria-label="Narzut Pracodawcy"
                                                    step={0.1}
                                                    value={role.employerCostRate}
                                                    onChange={(e) => handleUpdateHeadcountRole(role.id, 'employerCostRate', e.target.value)}
                                                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                                                />
                                            </td>
                                            <td className="py-2 px-3 text-right font-bold text-indigo-300">
                                                {formatCurrency(role.annualCost, currency)}
                                            </td>
                                            <td className="py-2 px-2 text-center">
                                                <button
                                                    type="button"
                                                    aria-label="Usuń stanowisko"
                                                    onClick={() => handleRemoveHeadcountRole(role.id)}
                                                    className="p-1 text-zinc-500 hover:text-rose-400 transition-colors"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot className="bg-zinc-950/90 border-t border-zinc-800 font-mono">
                                <tr>
                                    <td className="py-2.5 px-3 font-semibold text-zinc-300">
                                        Razem: {totalFte} FTE
                                    </td>
                                    <td colSpan={3} className="py-2.5 px-3 text-right font-semibold text-zinc-300">
                                        Łączny Roczny Fundusz Płac:
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-bold text-indigo-400 text-sm">
                                        {formatCurrency(calculatedAnnualPayrollBase, currency)}
                                    </td>
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Payroll Escalation */}
                    <div className="bg-zinc-950/60 p-4 rounded-lg border border-zinc-800/80 space-y-3">
                        <label className="text-xs text-zinc-300 font-medium flex justify-between">
                            <span>Roczna Stopa Wzrostu Wynagrodzeń (%)</span>
                            <span className="font-mono text-indigo-400">{payrollGrowthRate.toFixed(1)}%</span>
                        </label>
                        <input
                            type="range"
                            min={0}
                            max={15}
                            step={0.5}
                            value={payrollGrowthRate}
                            onChange={(e) => setPayrollGrowthRate(parseFloat(e.target.value) || 0)}
                            className="w-full accent-indigo-500 cursor-pointer"
                        />
                        <p className="text-[11px] text-zinc-500">
                            Przewidywana presja płacowa i roczna indeksacja wynagrodzeń pracowników w okresie 15 lat.
                        </p>
                    </div>
                </div>
            )}

            {/* Sub-Tab 5: Taxes & CIT */}
            {activeSubTab === 'taxes' && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-6">
                    <div>
                        <h4 className="font-semibold text-zinc-100 flex items-center gap-2 text-sm">
                            <Receipt className="w-4 h-4 text-emerald-400" />
                            Podatek Dochodowy (CIT) & Tarcza Podatkowa
                        </h4>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            Parametry fiskalne kalkulacji podatku dochodowego CIT oraz rozliczanie strat podatkowych z etapu inwestycyjnego.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* CIT Rate */}
                        <div className="bg-zinc-950/60 p-5 rounded-lg border border-zinc-800/80 space-y-4">
                            <span className="text-xs font-semibold text-zinc-200 block">Stawka Podatku CIT</span>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                {[
                                    { rate: 19.0, label: '19% Standardowy', desc: 'Standardowa stawka CIT w Polsce' },
                                    { rate: 9.0, label: '9% Preferencyjny', desc: 'Dla małych podatników i startupów' },
                                ].map(option => (
                                    <button
                                        key={option.rate}
                                        type="button"
                                        onClick={() => setCitRatePercent(option.rate)}
                                        className={`p-3 rounded-lg border text-left transition-all ${
                                            citRatePercent === option.rate
                                                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                        }`}
                                    >
                                        <div className="font-bold font-mono text-sm">{option.label}</div>
                                        <div className="text-[11px] text-zinc-500 mt-1">{option.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tax Loss Carry Forward */}
                        <div className="bg-zinc-950/60 p-5 rounded-lg border border-zinc-800/80 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-zinc-200">Rozliczanie Strat Podatkowych</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={taxLossCarryForward}
                                        onChange={(e) => setTaxLossCarryForward(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                                </label>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-zinc-400 flex justify-between">
                                    <span>Limit Rocznego Odliczenia Stranty (%)</span>
                                    <span className="font-mono text-emerald-400">{taxLossOffsetCap.toFixed(0)}%</span>
                                </label>
                                <input
                                    type="range"
                                    min={10}
                                    max={100}
                                    step={10}
                                    disabled={!taxLossCarryForward}
                                    value={taxLossOffsetCap}
                                    onChange={(e) => setTaxLossOffsetCap(parseFloat(e.target.value) || 50)}
                                    className="w-full accent-emerald-500 cursor-pointer disabled:opacity-40"
                                />
                            </div>

                            <p className="text-[11px] text-zinc-500 leading-relaxed">
                                Zgodnie z art. 7 ust. 5 ustawy o CIT strata z lat ubiegłych może obniżyć dochód w najbliższych kolejno po sobie następujących 5 latach podatkowych, z limitem do 50% kwoty straty w jednym roku.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Actions Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl">
                <div className="flex items-center gap-2">
                    {saveSuccess && (
                        <span className="text-sm text-emerald-400 flex items-center gap-1.5 animate-fadeIn">
                            <CheckCircle2 className="w-4 h-4" />
                            Założenia operacyjne zostały pomyślnie zapisane.
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
                    <button
                        type="button"
                        onClick={handleReset}
                        disabled={isSaving}
                        className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Resetuj
                    </button>

                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                    >
                        {isSaving ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Zapisywanie...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Zapisz Założenia Operacyjne
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OperatingAssumptionsForm;
