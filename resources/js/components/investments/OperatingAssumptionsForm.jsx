import React, { useState, useEffect, useMemo } from "react";
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
  Receipt,
  ArrowDownRight,
  Sparkles,
} from "lucide-react";
import { useInvestmentProject } from "../../context/InvestmentProjectContext";
import { investmentProjectsApi } from "../../api/investmentProjects";
import { calculate15YearStatements } from "../../workers/financialCalculations";
import { Tooltip, InfoTooltip } from "../ui/Tooltip";

const formatCurrency = (val, currency = "PLN") => {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
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
    taxLossSettlementMode: "standard_loss_cap",
    taxLossOneOffCapAmount: 5000000.0,
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
        id: "rev-1",
        name: "Przychody operacyjne bazowe",
        unit: "usł.",
        volume: 1,
        price: Number(oa.annual_revenue_base),
        total: Number(oa.annual_revenue_base),
      },
    ];
  }

  let hcMatrix = defaults.headcountMatrix;
  const rawHc = oa.headcount_matrix ?? oa.headcountMatrix;
  if (Array.isArray(rawHc) && rawHc.length > 0) {
    hcMatrix = rawHc;
  }

  let rampUp = defaults.capacityRampUp;
  if (oa.capacity_ramp_up && typeof oa.capacity_ramp_up === "object") {
    rampUp = {
      1: Number(oa.capacity_ramp_up[1] ?? oa.capacity_ramp_up["1"] ?? 100),
      2: Number(oa.capacity_ramp_up[2] ?? oa.capacity_ramp_up["2"] ?? 100),
      3: Number(oa.capacity_ramp_up[3] ?? oa.capacity_ramp_up["3"] ?? 100),
    };
  }

  return {
    revenueLines: revLines,
    revenueGrowthRate:
      oa.revenue_growth_rate_percent !== undefined
        ? Number(oa.revenue_growth_rate_percent)
        : defaults.revenueGrowthRate,
    capacityRampUp: rampUp,
    variableCostPercent:
      oa.variable_cost_percent !== undefined
        ? Number(oa.variable_cost_percent)
        : defaults.variableCostPercent,
    annualFixedCostsBase:
      oa.annual_fixed_costs_base !== undefined
        ? Number(oa.annual_fixed_costs_base)
        : defaults.annualFixedCostsBase,
    fixedCostGrowthRate:
      oa.fixed_cost_growth_rate_percent !== undefined
        ? Number(oa.fixed_cost_growth_rate_percent)
        : defaults.fixedCostGrowthRate,
    dso: oa.dso !== undefined ? Number(oa.dso) : defaults.dso,
    dpo: oa.dpo !== undefined ? Number(oa.dpo) : defaults.dpo,
    dio: oa.dio !== undefined ? Number(oa.dio) : defaults.dio,
    headcountMatrix: hcMatrix,
    payrollGrowthRate:
      oa.payroll_growth_rate_percent !== undefined
        ? Number(oa.payroll_growth_rate_percent)
        : defaults.payrollGrowthRate,
    citRatePercent:
      oa.cit_rate_percent !== undefined
        ? Number(oa.cit_rate_percent)
        : defaults.citRatePercent,
    taxLossCarryForward:
      oa.tax_loss_carry_forward_enabled !== undefined
        ? Boolean(oa.tax_loss_carry_forward_enabled)
        : defaults.taxLossCarryForward,
    taxLossOffsetCap:
      oa.tax_loss_offset_cap_percent !== undefined
        ? Number(oa.tax_loss_offset_cap_percent)
        : defaults.taxLossOffsetCap,
    taxLossSettlementMode:
      oa.tax_loss_settlement_mode !== undefined
        ? String(oa.tax_loss_settlement_mode)
        : defaults.taxLossSettlementMode,
    taxLossOneOffCapAmount:
      oa.tax_loss_one_off_cap_amount !== undefined
        ? Number(oa.tax_loss_one_off_cap_amount)
        : defaults.taxLossOneOffCapAmount,
  };
};

export const OperatingAssumptionsForm = () => {
  const { selectedProject, loadProjectDetails } = useInvestmentProject();

  const [activeSubTab, setActiveSubTab] = useState("revenues");

  // Revenue lines & Ramp-up
  const [revenueLines, setRevenueLines] = useState([]);
  const [revenueGrowthRate, setRevenueGrowthRate] = useState(2.5);
  const [capacityRampUp, setCapacityRampUp] = useState({
    1: 100,
    2: 100,
    3: 100,
  });

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
  const [taxLossSettlementMode, setTaxLossSettlementMode] = useState("standard_loss_cap");
  const [taxLossOneOffCapAmount, setTaxLossOneOffCapAmount] = useState(5000000.0);

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
    setTaxLossSettlementMode(parsed.taxLossSettlementMode);
    setTaxLossOneOffCapAmount(parsed.taxLossOneOffCapAmount);

    setSaveSuccess(false);
    setSaveError(null);
  }, [selectedProject]);

  // Computed totals
  const currency = selectedProject?.currency || "PLN";

  const calculatedAnnualRevenueBase = useMemo(() => {
    return revenueLines.reduce(
      (sum, line) => sum + (Number(line.total) || 0),
      0,
    );
  }, [revenueLines]);

  const calculatedAnnualPayrollBase = useMemo(() => {
    return headcountMatrix.reduce(
      (sum, item) => sum + (Number(item.annualCost) || 0),
      0,
    );
  }, [headcountMatrix]);

  const totalFte = useMemo(() => {
    return headcountMatrix.reduce(
      (sum, item) => sum + (Number(item.fte) || 0),
      0,
    );
  }, [headcountMatrix]);

  const calculatedVariableCosts =
    calculatedAnnualRevenueBase * (variableCostPercent / 100);
  const calculatedEbitda =
    calculatedAnnualRevenueBase -
    calculatedVariableCosts -
    annualFixedCostsBase -
    calculatedAnnualPayrollBase;
  const calculatedEbitdaMargin =
    calculatedAnnualRevenueBase > 0
      ? (calculatedEbitda / calculatedAnnualRevenueBase) * 100
      : 0;

  // Fixed cost inflation trajectory projection (15-year horizon)
  const fixedCostProjection = useMemo(() => {
    const base = Number(annualFixedCostsBase) || 0;
    const rate = (Number(fixedCostGrowthRate) || 0) / 100;

    // Year 1 (COD): base * (1 + rate)^0 = base
    const year1 = base;
    // Year 5: base * (1 + rate)^4
    const year5 = base * Math.pow(1 + rate, 4);
    // Year 10: base * (1 + rate)^9
    const year10 = base * Math.pow(1 + rate, 9);
    // Year 15: base * (1 + rate)^14
    const year15 = base * Math.pow(1 + rate, 14);

    let total15Y = 0;
    for (let t = 1; t <= 15; t++) {
      total15Y += base * Math.pow(1 + rate, t - 1);
    }

    const inflationSurcharge15Y = Math.max(0, total15Y - 15 * base);
    const growthPercent5Y = base > 0 ? ((year5 - base) / base) * 100 : 0;
    const growthPercent10Y = base > 0 ? ((year10 - base) / base) * 100 : 0;
    const growthPercent15Y = base > 0 ? ((year15 - base) / base) * 100 : 0;

    return {
      year1,
      year5,
      year10,
      year15,
      total15Y,
      inflationSurcharge15Y,
      growthPercent5Y,
      growthPercent10Y,
      growthPercent15Y,
    };
  }, [annualFixedCostsBase, fixedCostGrowthRate]);

  // Revenue multi-year trajectory projection (15-year horizon factoring in ramp-up)
  const revenueProjection = useMemo(() => {
    const base = Number(calculatedAnnualRevenueBase) || 0;
    const rate = (Number(revenueGrowthRate) || 0) / 100;
    const r1 = (Number(capacityRampUp[1]) || 100) / 100;
    const r2 = (Number(capacityRampUp[2]) || 100) / 100;
    const r3 = (Number(capacityRampUp[3]) || 100) / 100;

    const year1 = base * Math.pow(1 + rate, 0) * r1;
    const year2 = base * Math.pow(1 + rate, 1) * r2;
    const year5 = base * Math.pow(1 + rate, 4) * r3;
    const year10 = base * Math.pow(1 + rate, 9) * r3;
    const year15 = base * Math.pow(1 + rate, 14) * r3;

    let total15Y = 0;
    for (let t = 1; t <= 15; t++) {
      const ramp = t === 1 ? r1 : t === 2 ? r2 : r3;
      total15Y += base * Math.pow(1 + rate, t - 1) * ramp;
    }

    return {
      year1,
      year2,
      year5,
      year10,
      year15,
      total15Y,
    };
  }, [calculatedAnnualRevenueBase, revenueGrowthRate, capacityRampUp]);

  // Live Tax Loss Roll-Forward Simulation Trajectory (15-year horizon)
  const taxRollForwardTrajectory = useMemo(() => {
    if (!selectedProject) return null;

    try {
      const liveAssumptions = {
        ...(selectedProject.operating_assumptions || {}),
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
        cit_rate_percent: Number(citRatePercent) || 19,
        tax_loss_carry_forward_enabled: taxLossCarryForward,
        tax_loss_settlement_mode: taxLossSettlementMode,
        tax_loss_offset_cap_percent: Number(taxLossOffsetCap) || 50,
        tax_loss_one_off_cap_amount: Number(taxLossOneOffCapAmount) || 5000000,
        revenue_lines: revenueLines,
        headcount_matrix: headcountMatrix,
        capacity_ramp_up: capacityRampUp,
      };

      const statements = calculate15YearStatements(
        selectedProject,
        liveAssumptions,
        undefined,
        15,
      );

      const annualPeriods = statements.annualPeriods || [];

      let totalLossesGenerated = 0;
      let totalLossesUsed = 0;
      let totalLossesExpired = 0;
      let totalTaxPaid = 0;

      annualPeriods.forEach((p) => {
        if (p.ebt < 0) {
          totalLossesGenerated += Math.abs(p.ebt);
        }
        totalLossesUsed += p.taxLossUsed || 0;
        totalLossesExpired += p.taxLossExpired || 0;
        totalTaxPaid += p.cit || 0;
      });

      const effectiveCitRate = (Number(citRatePercent) || 19) / 100;
      const totalTaxSaved = totalLossesUsed * effectiveCitRate;
      const closingPool =
        annualPeriods.length > 0
          ? annualPeriods[annualPeriods.length - 1].taxLossCarryForwardClosing || 0
          : 0;

      return {
        annualPeriods,
        totalLossesGenerated,
        totalLossesUsed,
        totalLossesExpired,
        totalTaxPaid,
        totalTaxSaved,
        closingPool,
      };
    } catch (err) {
      console.error(
        "[OperatingAssumptionsForm] Error computing tax roll-forward trajectory:",
        err,
      );
      return null;
    }
  }, [
    selectedProject,
    calculatedAnnualRevenueBase,
    revenueGrowthRate,
    variableCostPercent,
    annualFixedCostsBase,
    fixedCostGrowthRate,
    calculatedAnnualPayrollBase,
    payrollGrowthRate,
    dso,
    dpo,
    dio,
    citRatePercent,
    taxLossCarryForward,
    taxLossSettlementMode,
    taxLossOffsetCap,
    taxLossOneOffCapAmount,
    revenueLines,
    headcountMatrix,
    capacityRampUp,
  ]);

  // Cash Conversion Cycle: CCC = DIO + DSO - DPO
  const cashConversionCycle = dio + dso - dpo;

  // Revenue line handlers
  const handleAddRevenueLine = () => {
    const newLine = {
      id: `rev-${Date.now()}`,
      name: "Nowa linia przychodowa",
      unit: "szt.",
      volume: 1000,
      price: 100,
      total: 100000,
    };
    setRevenueLines([...revenueLines, newLine]);
  };

  const handleUpdateRevenueLine = (id, field, value) => {
    setRevenueLines(
      revenueLines.map((line) => {
        if (line.id !== id) return line;
        const updated = { ...line, [field]: value };
        if (field === "volume" || field === "price") {
          const vol =
            field === "volume" ? Number(value) || 0 : Number(line.volume) || 0;
          const pr =
            field === "price" ? Number(value) || 0 : Number(line.price) || 0;
          updated.total = vol * pr;
        }
        return updated;
      }),
    );
  };

  const handleRemoveRevenueLine = (id) => {
    setRevenueLines(revenueLines.filter((line) => line.id !== id));
  };

  // Headcount matrix handlers
  const handleAddHeadcountRole = () => {
    const newRole = {
      id: `hc-${Date.now()}`,
      role: "Nowe stanowisko operacyjne",
      fte: 1,
      grossSalary: 8000,
      employerCostRate: 20.48,
      annualCost: Math.round(1 * 8000 * 1.2048 * 12),
    };
    setHeadcountMatrix([...headcountMatrix, newRole]);
  };

  const handleUpdateHeadcountRole = (id, field, value) => {
    setHeadcountMatrix(
      headcountMatrix.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (
          field === "fte" ||
          field === "grossSalary" ||
          field === "employerCostRate"
        ) {
          const f =
            field === "fte" ? Number(value) || 0 : Number(item.fte) || 0;
          const gs =
            field === "grossSalary"
              ? Number(value) || 0
              : Number(item.grossSalary) || 0;
          const ec =
            field === "employerCostRate"
              ? Number(value) || 0
              : Number(item.employerCostRate) || 0;
          updated.annualCost = Math.round(f * gs * (1 + ec / 100) * 12);
        }
        return updated;
      }),
    );
  };

  const handleRemoveHeadcountRole = (id) => {
    setHeadcountMatrix(headcountMatrix.filter((item) => item.id !== id));
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
    setTaxLossSettlementMode(parsed.taxLossSettlementMode);
    setTaxLossOneOffCapAmount(parsed.taxLossOneOffCapAmount);
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
        tax_loss_settlement_mode: taxLossSettlementMode,
        tax_loss_one_off_cap_amount: Number(taxLossOneOffCapAmount) || 5000000,
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
      const msg =
        err.response?.data?.message ||
        "Błąd podczas zapisywania założeń operacyjnych.";
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
          <div className="flex items-start gap-3">
            <Tooltip content="Wskaźniki operacyjne, przychody, koszty i podatki w fazie eksploatacji">
              <span
                tabIndex={0}
                className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 cursor-help focus:outline-none"
              >
                <Activity className="w-5 h-5" />
              </span>
            </Tooltip>
            <div>
              <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                <span>Założenia Operacyjne & Model P&L</span>
                <InfoTooltip
                  content="Parametryzacja modelu biznesowego po uruchomieniu komercyjnym (COD): cenniki, wolumeny, eskalacja kosztów, struktura zatrudnienia oraz tarcza podatkowa CIT."
                  ariaLabel="Informacje o założeniach operacyjnych"
                  size="xs"
                />
              </h3>
              <p className="text-sm text-zinc-400">
                Konfiguracja strumieni przychodowych, driverów OPEX, rotacji
                kapitału obrotowego (NWC) oraz matrycy zatrudnienia.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Tooltip content="Commercial Operation Date - planowana data rozpoczęcia fazy operacyjnej projektu">
              <span
                tabIndex={0}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 cursor-help focus:outline-none"
              >
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                COD: {selectedProject.commercial_operation_date || "Nieustalona"}
              </span>
            </Tooltip>
          </div>
        </div>

        {/* KPI Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-3.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-400">
                Przychody Bazowe (Rok)
              </span>
              <InfoTooltip
                content="Suma rocznych strumieni przychodowych w pierwszym roku pełnej mocy operacyjnej."
                ariaLabel="Informacje o przychodach bazowych"
                size="xs"
              />
            </div>
            <span className="text-lg font-bold font-mono text-zinc-100">
              {formatCurrency(calculatedAnnualRevenueBase, currency)}
            </span>
          </div>

          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-3.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-400">
                EBITDA Bazowa (Marża)
              </span>
              <InfoTooltip
                content="Zysk operacyjny przed amortyzacją i podatkiem przy bazowym obciążeniu OPEX i płacami."
                ariaLabel="Informacje o EBITDA bazowej"
                size="xs"
              />
            </div>
            <span
              className={`text-lg font-bold font-mono ${calculatedEbitda >= 0 ? "text-emerald-400" : "text-rose-400"}`}
            >
              {formatCurrency(calculatedEbitda, currency)}
              <span className="text-xs font-normal text-zinc-400 ml-1.5">
                ({calculatedEbitdaMargin.toFixed(1)}%)
              </span>
            </span>
          </div>

          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-3.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-400">
                Cykl Konwersji (CCC)
              </span>
              <InfoTooltip
                content="Czas w dniach od wydatkowania gotówki na zapasy/dostawców do odzyskania gotówki z należności (DIO + DSO - DPO)."
                ariaLabel="Informacje o cyklu konwersji gotówki"
                size="xs"
              />
            </div>
            <span
              className={`text-lg font-bold font-mono ${cashConversionCycle <= 45 ? "text-emerald-400" : cashConversionCycle <= 90 ? "text-amber-400" : "text-rose-400"}`}
            >
              {cashConversionCycle} dni
            </span>
          </div>

          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-3.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-400">
                Zespół & Płace (FTE)
              </span>
              <InfoTooltip
                content="Łączna liczba etatów (Full-Time Equivalent) oraz roczny fundusz płac z narzutami pracodawcy."
                ariaLabel="Informacje o zespole i płacach"
                size="xs"
              />
            </div>
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
            {
              id: "revenues",
              label: "1. Przychody & Ramp-Up",
              icon: TrendingUp,
              description: "Strumienie przychodowe, wolumeny, cenniki i profil dojścia do pełnej mocy",
            },
            {
              id: "opex",
              label: "2. Koszty OPEX",
              icon: Sliders,
              description: "Koszty zmienne bezpośrednie, baza kosztów stałych oraz eskalacja inflacyjna",
            },
            {
              id: "nwc",
              label: "3. Kapitał Obrotowy (NWC)",
              icon: Clock,
              description: "Dni rotacji należności (DSO), zobowiązań (DPO), zapasów (DIO) i cykl gotówki (CCC)",
            },
            {
              id: "payroll",
              label: "4. Matryca Etatów",
              icon: Users,
              description: "Struktura zatrudnienia, wynagrodzenia brutto, narzuty pracodawcy i dynamika płac",
            },
            {
              id: "taxes",
              label: "5. Podatki & CIT",
              icon: Receipt,
              description: "Stawka podatku dochodowego CIT, tarcza WACC oraz rozliczanie strat z lat ubiegłych",
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <Tooltip key={tab.id} content={tab.description}>
                <button
                  type="button"
                  onClick={() => setActiveSubTab(tab.id)}
                  aria-label={tab.label}
                  className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? "border-emerald-500 text-emerald-400 bg-emerald-500/10"
                      : "border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              </Tooltip>
            );
          })}
        </div>
      </div>

      {/* Sub-Tab 1: Revenues & Ramp-up */}
      {activeSubTab === "revenues" && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-zinc-100 flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Linie Przychodowe & Wzrost Organiczny
              </h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Zdefiniuj strumienie operacyjne projektu. Suma wartości stanowi
                roczną bazę przychodów COD.
              </p>
            </div>
            <Tooltip content="Dodaj nową linię przychodową do modelu sprzedaży">
              <button
                type="button"
                onClick={handleAddRevenueLine}
                aria-label="Dodaj strumień przychodowy"
                className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-sm font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                Dodaj Strumień
              </button>
            </Tooltip>
          </div>

          {/* Revenue Lines Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-950/80 text-zinc-400 border-b border-zinc-800 font-mono">
                <tr>
                  <th className="py-2.5 px-3">
                    <Tooltip content="Nazwa lub kategoria źródła przychodów operacyjnych">
                      <span className="cursor-help">Nazwa Strumienia</span>
                    </Tooltip>
                  </th>
                  <th className="py-2.5 px-3 w-28">
                    <Tooltip content="Jednostka miary wolumenu sprzedaży (np. MWh, szt., usł., t)">
                      <span className="cursor-help">Jednostka</span>
                    </Tooltip>
                  </th>
                  <th className="py-2.5 px-3 w-32">
                    <Tooltip content="Roczny wolumen sprzedaży w jednostkach fizycznych">
                      <span className="cursor-help">Wolumen</span>
                    </Tooltip>
                  </th>
                  <th className="py-2.5 px-3 w-36">
                    <Tooltip content={`Cena jednostkowa netto za jednostkę wolumenu w ${currency}`}>
                      <span className="cursor-help">Cena Jedn. ({currency})</span>
                    </Tooltip>
                  </th>
                  <th className="py-2.5 px-3 w-40 text-right">
                    <Tooltip content="Iloczyn wolumenu i ceny jednostkowej w skali pełnego roku operacyjnego">
                      <span className="cursor-help">Roczna Wartość</span>
                    </Tooltip>
                  </th>
                  <th className="py-2.5 px-2 w-12 text-center">
                    <Tooltip content="Dostępne operacje na pozycji">
                      <span className="cursor-help">Akcja</span>
                    </Tooltip>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono">
                {revenueLines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-500">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <TrendingUp className="w-6 h-6 text-zinc-600 mb-1" />
                        <p className="font-semibold text-zinc-400 text-xs">
                          Brak zdefiniowanych strumieni przychodowych
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          Kliknij „Dodaj Strumień”, aby zdefiniować model
                          sprzedaży projektu.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  revenueLines.map((line) => (
                    <tr key={line.id} className="hover:bg-zinc-850/40">
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          aria-label="Nazwa Strumienia"
                          value={line.name}
                          onChange={(e) =>
                            handleUpdateRevenueLine(
                              line.id,
                              "name",
                              e.target.value,
                            )
                          }
                          className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          aria-label="Jednostka"
                          value={line.unit}
                          onChange={(e) =>
                            handleUpdateRevenueLine(
                              line.id,
                              "unit",
                              e.target.value,
                            )
                          }
                          className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          aria-label="Wolumen"
                          value={line.volume}
                          onChange={(e) =>
                            handleUpdateRevenueLine(
                              line.id,
                              "volume",
                              e.target.value,
                            )
                          }
                          className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          aria-label="Cena Jednostkowa"
                          step="0.01"
                          value={line.price}
                          onChange={(e) =>
                            handleUpdateRevenueLine(
                              line.id,
                              "price",
                              e.target.value,
                            )
                          }
                          className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-400">
                        {formatCurrency(line.total, currency)}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <Tooltip content="Usuń tę linię przychodową">
                          <button
                            type="button"
                            aria-label="Usuń linię"
                            onClick={() => handleRemoveRevenueLine(line.id)}
                            className="p-1 text-zinc-500 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-zinc-950/90 border-t border-zinc-800 font-mono">
                <tr>
                  <td
                    colSpan={4}
                    className="py-2.5 px-3 text-right font-semibold text-zinc-300"
                  >
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
              <label className="text-xs text-zinc-300 font-medium flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  <span>Roczna Stopa Wzrostu Przychodów (%)</span>
                  <InfoTooltip
                    content="Stopa indeksacji cen lub organicznego wzrostu wolumenu sprzedaży rok do roku (CAGR)."
                    ariaLabel="Informacje o rocznej stopie wzrostu przychodów"
                    size="xs"
                  />
                </span>
                <span className="font-mono text-emerald-400">
                  {revenueGrowthRate.toFixed(1)}%
                </span>
              </label>
              <input
                type="range"
                min={-10}
                max={25}
                step={0.5}
                value={revenueGrowthRate}
                onChange={(e) =>
                  setRevenueGrowthRate(parseFloat(e.target.value) || 0)
                }
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <p className="text-[11px] text-zinc-500">
                Dynamika indeksacji cen lub wzrostu wolumenu sprzedaży w
                kolejnych latach operacyjnych.
              </p>

              {/* Live Projection Feedback for Revenue Growth */}
              <div
                className="p-3 bg-zinc-900/80 rounded-lg border border-zinc-800/90 space-y-2 mt-2"
                data-testid="revenue-projection-panel"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    Szacowane Przychody Wieloletnie:
                  </span>
                  <span className="text-[11px] text-emerald-400 font-mono font-medium">
                    R1 COD: {formatCurrency(revenueProjection.year1, currency)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-zinc-950/70 p-2 rounded border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-400 block mb-0.5">
                      Rok 5 ({capacityRampUp[3] || 100}% Ramp-Up)
                    </span>
                    <span
                      className="text-zinc-100 font-semibold block truncate"
                      title={formatCurrency(revenueProjection.year5, currency)}
                    >
                      {formatCurrency(revenueProjection.year5, currency)}
                    </span>
                  </div>
                  <div className="bg-zinc-950/70 p-2 rounded border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-400 block mb-0.5">
                      Rok 10 ({capacityRampUp[3] || 100}% Ramp-Up)
                    </span>
                    <span
                      className="text-zinc-100 font-semibold block truncate"
                      title={formatCurrency(revenueProjection.year10, currency)}
                    >
                      {formatCurrency(revenueProjection.year10, currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-zinc-950/60 p-4 rounded-lg border border-zinc-800/80 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-zinc-300 font-medium">
                  Profil Dojścia do Pełnej Mocy (Ramp-Up %)
                </span>
                <InfoTooltip
                  content="Procentowe osiągnięcie nominalnych przychodów w początkowych latach rozruchu technologicznego i komercyjnego."
                  ariaLabel="Informacje o profilu ramp-up"
                  size="xs"
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                <div>
                  <span className="text-[11px] text-zinc-500 block mb-1">
                    Rok 1 (COD)
                  </span>
                  <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1">
                    <input
                      type="number"
                      min={10}
                      max={100}
                      value={capacityRampUp[1] || 60}
                      onChange={(e) =>
                        setCapacityRampUp({
                          ...capacityRampUp,
                          1: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full bg-transparent text-zinc-100 text-xs focus:outline-none"
                    />
                    <span className="text-zinc-500 text-[10px]">%</span>
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-zinc-500 block mb-1">
                    Rok 2
                  </span>
                  <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1">
                    <input
                      type="number"
                      min={10}
                      max={100}
                      value={capacityRampUp[2] || 85}
                      onChange={(e) =>
                        setCapacityRampUp({
                          ...capacityRampUp,
                          2: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full bg-transparent text-zinc-100 text-xs focus:outline-none"
                    />
                    <span className="text-zinc-500 text-[10px]">%</span>
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-zinc-500 block mb-1">
                    Rok 3+
                  </span>
                  <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1">
                    <input
                      type="number"
                      min={10}
                      max={100}
                      value={capacityRampUp[3] || 100}
                      onChange={(e) =>
                        setCapacityRampUp({
                          ...capacityRampUp,
                          3: parseInt(e.target.value, 10) || 0,
                        })
                      }
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
      {activeSubTab === "opex" && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-6">
          <div>
            <h4 className="font-semibold text-zinc-100 flex items-center gap-2 text-sm">
              <Sliders className="w-4 h-4 text-amber-400" />
              Drivery Kosztów Operacyjnych (OPEX)
            </h4>
            <p className="text-xs text-zinc-400 mt-0.5">
              Parametryzacja kosztów zmiennych bezpośrednich oraz bazy kosztów
              stałych operacji (O&M, ubezpieczenia, podatki od nieruchomości).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Variable Costs */}
            <div className="bg-zinc-950/60 p-5 rounded-lg border border-zinc-800/80 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-zinc-200">
                    Koszty Zmienne (% Przychodów)
                  </span>
                  <InfoTooltip
                    content="Udział kosztów bezpośrednio uzależnionych od wolumenu sprzedaży w przychodach (media, surowce, prowizje)."
                    ariaLabel="Informacje o kosztach zmiennych"
                    size="xs"
                  />
                </div>
                <span className="font-mono text-amber-400 font-bold text-sm">
                  {variableCostPercent.toFixed(1)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={90}
                step={0.5}
                value={variableCostPercent}
                onChange={(e) =>
                  setVariableCostPercent(parseFloat(e.target.value) || 0)
                }
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800/80 text-xs flex justify-between items-center">
                <span className="text-zinc-400">
                  Szacowane koszty zmienne COD:
                </span>
                <span className="font-mono font-bold text-zinc-200">
                  {formatCurrency(calculatedVariableCosts, currency)}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500">
                Obejmują surowce, media technologiczne, opłaty przesyłowe i
                zmienne koszty eksploatacji bezpośrednio proporcjonalne do
                wolumenu sprzedaży.
              </p>
            </div>

            {/* Fixed Costs */}
            <div className="bg-zinc-950/60 p-5 rounded-lg border border-zinc-800/80 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-zinc-200">
                    Roczne Koszty Stałe Bazowe
                  </span>
                  <InfoTooltip
                    content="Roczna baza kosztów stałych w roku uruchomienia komercyjnego (serwis O&M, ubezpieczenia majątkowe, podatki lokalne, dzierżawy)."
                    ariaLabel="Informacje o rocznych kosztach stałych"
                    size="xs"
                  />
                </div>
                <span className="font-mono text-zinc-100 font-bold text-sm">
                  {formatCurrency(annualFixedCostsBase, currency)}
                </span>
              </div>
              <input
                type="number"
                aria-label="Roczne Koszty Stałe Bazowe"
                value={annualFixedCostsBase}
                onChange={(e) =>
                  setAnnualFixedCostsBase(
                    Math.max(0, parseFloat(e.target.value) || 0),
                  )
                }
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 font-mono text-sm focus:outline-none focus:border-amber-500"
              />

              <div className="pt-2 border-t border-zinc-800 space-y-2">
                <label className="text-xs text-zinc-400 flex justify-between items-center">
                  <span className="flex items-center gap-1.5">
                    <span>Eskalacja Inflacyjna Kosztów Stałych (%)</span>
                    <InfoTooltip
                      content="Wskaźnik corocznej indeksacji cen usług obcych i materiałów w kolejnych latach operacyjnych."
                      ariaLabel="Informacje o eskalacji kosztów stałych"
                      size="xs"
                    />
                  </span>
                  <span className="font-mono text-amber-400">
                    {fixedCostGrowthRate.toFixed(1)}%
                  </span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={15}
                  step={0.5}
                  value={fixedCostGrowthRate}
                  onChange={(e) =>
                    setFixedCostGrowthRate(parseFloat(e.target.value) || 0)
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Live Compounding & Multi-Year Projection Feedback */}
              <div
                className="p-3.5 bg-zinc-900/80 rounded-lg border border-zinc-800/90 space-y-3"
                data-testid="fixed-cost-projection-panel"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                    Projekcja Eskalacji Kosztów Stałych (15 lat):
                  </span>
                  <span
                    className={`font-mono text-[11px] px-2 py-0.5 rounded font-semibold ${
                      fixedCostGrowthRate > 0
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    +{fixedCostProjection.growthPercent15Y.toFixed(1)}% w R15
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                  <div className="bg-zinc-950/70 p-2 rounded border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-400 block mb-0.5">
                      Rok 5 (+{fixedCostProjection.growthPercent5Y.toFixed(1)}%)
                    </span>
                    <span
                      className="text-zinc-100 font-semibold block truncate"
                      title={formatCurrency(
                        fixedCostProjection.year5,
                        currency,
                      )}
                    >
                      {formatCurrency(fixedCostProjection.year5, currency)}
                    </span>
                  </div>
                  <div className="bg-zinc-950/70 p-2 rounded border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-400 block mb-0.5">
                      Rok 10 (+{fixedCostProjection.growthPercent10Y.toFixed(1)}
                      %)
                    </span>
                    <span
                      className="text-zinc-100 font-semibold block truncate"
                      title={formatCurrency(
                        fixedCostProjection.year10,
                        currency,
                      )}
                    >
                      {formatCurrency(fixedCostProjection.year10, currency)}
                    </span>
                  </div>
                  <div className="bg-zinc-950/70 p-2 rounded border border-zinc-800/80">
                    <span className="text-[10px] text-amber-400/90 block mb-0.5">
                      Narzut 15L (&Sigma;)
                    </span>
                    <span
                      className="text-amber-400 font-bold block truncate"
                      title={formatCurrency(
                        fixedCostProjection.inflationSurcharge15Y,
                        currency,
                      )}
                    >
                      +
                      {formatCurrency(
                        fixedCostProjection.inflationSurcharge15Y,
                        currency,
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-1.5 text-[11px] text-zinc-400 leading-relaxed pt-1 border-t border-zinc-800/60">
                  <Info className="w-3.5 h-3.5 text-amber-400/80 shrink-0 mt-0.5" />
                  <span>
                    Stopa eskalacji indeksuje koszty stałe (O&M, podatki,
                    ubezpieczenia) w latach operacyjnych Y2–Y15 wg formuły{" "}
                    <code className="text-zinc-300 font-mono bg-zinc-800 px-1 py-0.5 rounded text-[10px]">
                      Baza &times; (1 + r)^(t-1)
                    </code>
                    . Wpływa na wieloletni RZiS, marże EBITDA, wskaźniki DSCR i
                    wycenę DCF.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 3: Working Capital (NWC) */}
      {activeSubTab === "nwc" && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-6">
          <div>
            <h4 className="font-semibold text-zinc-100 flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-sky-400" />
              Cykl Rotacji Kapitału Obrotowego (NWC)
            </h4>
            <p className="text-xs text-zinc-400 mt-0.5">
              Dni rotacji należności (DSO), zobowiązań handlowych (DPO) oraz
              zapasów (DIO) determinujące zapotrzebowanie na kapitał obrotowy w
              bilansie.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* DSO */}
            <div className="bg-zinc-950/60 p-4 rounded-lg border border-zinc-800/80 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-zinc-200">
                    DSO (Należności)
                  </span>
                  <InfoTooltip
                    content="Days Sales Outstanding - średnia liczba dni od wystawienia faktury do otrzymania zapłaty od kontrahenta."
                    ariaLabel="Informacje o wskaźniku DSO"
                    size="xs"
                  />
                </div>
                <span className="font-mono text-sky-400 font-bold">
                  {dso} dni
                </span>
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
                Średni czas spływu należności od odbiorców faktur sprzedażowych
                (Days Sales Outstanding).
              </p>
            </div>

            {/* DPO */}
            <div className="bg-zinc-950/60 p-4 rounded-lg border border-zinc-800/80 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-zinc-200">
                    DPO (Zobowiązania)
                  </span>
                  <InfoTooltip
                    content="Days Payable Outstanding - średni termin płatności faktur wobec dostawców i wykonawców."
                    ariaLabel="Informacje o wskaźniku DPO"
                    size="xs"
                  />
                </div>
                <span className="font-mono text-emerald-400 font-bold">
                  {dpo} dni
                </span>
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
                Średni termin płatności wobec dostawców i podwykonawców (Days
                Payable Outstanding).
              </p>
            </div>

            {/* DIO */}
            <div className="bg-zinc-950/60 p-4 rounded-lg border border-zinc-800/80 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-zinc-200">
                    DIO (Zapasy)
                  </span>
                  <InfoTooltip
                    content="Days Inventory Outstanding - średni czas zalegania zapasów magazynowych, części zamiennych lub surowców."
                    ariaLabel="Informacje o wskaźniku DIO"
                    size="xs"
                  />
                </div>
                <span className="font-mono text-amber-400 font-bold">
                  {dio} dni
                </span>
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
                Rotacja zapasów części zamiennych, paliwa lub surowców (Days
                Inventory Outstanding).
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
                Wzór: CCC = DIO ({dio}d) + DSO ({dso}d) - DPO ({dpo}d) ={" "}
                <strong>{cashConversionCycle} dni</strong>.
              </p>
            </div>
            <div className="text-right font-mono">
              <span
                className={`text-xl font-bold ${cashConversionCycle <= 45 ? "text-emerald-400" : "text-amber-400"}`}
              >
                {cashConversionCycle} dni
              </span>
              <span className="text-[11px] text-zinc-500 block">
                {cashConversionCycle <= 30
                  ? "Optymalna efektywność NWC"
                  : "Wymaga zaangażowania kapitału obrotowego"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 4: Headcount Matrix & Payroll */}
      {activeSubTab === "payroll" && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-zinc-100 flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-indigo-400" />
                Matryca Etatów & Koszty Wynagrodzeń (Payroll)
              </h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Struktura zatrudnienia, płace brutto oraz narzuty ubezpieczeń
                społecznych pracodawcy (ZUS / PPK).
              </p>
            </div>
            <Tooltip content="Dodaj nowe stanowisko pracownicze do matrycy etatów">
              <button
                type="button"
                onClick={handleAddHeadcountRole}
                aria-label="Dodaj stanowisko"
                className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-sm font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                Dodaj Stanowisko
              </button>
            </Tooltip>
          </div>

          {/* Headcount Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-950/80 text-zinc-400 border-b border-zinc-800 font-mono">
                <tr>
                  <th className="py-2.5 px-3">
                    <Tooltip content="Stanowisko lub rola w zespole operacyjnym">
                      <span className="cursor-help">Stanowisko / Rola</span>
                    </Tooltip>
                  </th>
                  <th className="py-2.5 px-3 w-24">
                    <Tooltip content="Liczba pełnych etatów (Full-Time Equivalent)">
                      <span className="cursor-help">Etaty (FTE)</span>
                    </Tooltip>
                  </th>
                  <th className="py-2.5 px-3 w-36">
                    <Tooltip content={`Miesięczne wynagrodzenie zasadnicze brutto na jeden etat w ${currency}`}>
                      <span className="cursor-help">Brutto / m-c ({currency})</span>
                    </Tooltip>
                  </th>
                  <th className="py-2.5 px-3 w-32">
                    <Tooltip content="Narzut kosztów pracodawcy: ZUS, FP, FGŚP, PPK (standardowo ok. 20.48%)">
                      <span className="cursor-help">Narzut (%)</span>
                    </Tooltip>
                  </th>
                  <th className="py-2.5 px-3 w-40 text-right">
                    <Tooltip content="Łączny roczny koszt pracodawcy (FTE × Brutto × 12 × Narzut)">
                      <span className="cursor-help">Roczny Koszt Pracodawcy</span>
                    </Tooltip>
                  </th>
                  <th className="py-2.5 px-2 w-12 text-center">
                    <Tooltip content="Dostępne operacje na pozycji">
                      <span className="cursor-help">Akcja</span>
                    </Tooltip>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono">
                {headcountMatrix.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-500">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <Users className="w-6 h-6 text-zinc-600 mb-1" />
                        <p className="font-semibold text-zinc-400 text-xs">
                          Brak zdefiniowanych stanowisk operacyjnych
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          Kliknij „Dodaj Stanowisko”, aby zaplanować strukturę
                          zatrudnienia.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  headcountMatrix.map((role) => (
                    <tr key={role.id} className="hover:bg-zinc-850/40">
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          aria-label="Nazwa Stanowiska"
                          value={role.role}
                          onChange={(e) =>
                            handleUpdateHeadcountRole(
                              role.id,
                              "role",
                              e.target.value,
                            )
                          }
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
                          onChange={(e) =>
                            handleUpdateHeadcountRole(
                              role.id,
                              "fte",
                              e.target.value,
                            )
                          }
                          className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          aria-label="Wynagrodzenie Brutto"
                          value={role.grossSalary}
                          onChange={(e) =>
                            handleUpdateHeadcountRole(
                              role.id,
                              "grossSalary",
                              e.target.value,
                            )
                          }
                          className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          aria-label="Narzut Pracodawcy"
                          step={0.1}
                          value={role.employerCostRate}
                          onChange={(e) =>
                            handleUpdateHeadcountRole(
                              role.id,
                              "employerCostRate",
                              e.target.value,
                            )
                          }
                          className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-indigo-300">
                        {formatCurrency(role.annualCost, currency)}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <Tooltip content="Usuń to stanowisko z matrycy zatrudnienia">
                          <button
                            type="button"
                            aria-label="Usuń stanowisko"
                            onClick={() => handleRemoveHeadcountRole(role.id)}
                            className="p-1 text-zinc-500 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
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
                  <td
                    colSpan={3}
                    className="py-2.5 px-3 text-right font-semibold text-zinc-300"
                  >
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
            <label className="text-xs text-zinc-300 font-medium flex justify-between items-center">
              <span className="flex items-center gap-1.5">
                <span>Roczna Stopa Wzrostu Wynagrodzeń (%)</span>
                <InfoTooltip
                  content="Roczna stopa indeksacji wynagrodzeń pracowników uwzględniająca presję płacową i inflację."
                  ariaLabel="Informacje o wzroście płac"
                  size="xs"
                />
              </span>
              <span className="font-mono text-indigo-400">
                {payrollGrowthRate.toFixed(1)}%
              </span>
            </label>
            <input
              type="range"
              min={0}
              max={15}
              step={0.5}
              value={payrollGrowthRate}
              onChange={(e) =>
                setPayrollGrowthRate(parseFloat(e.target.value) || 0)
              }
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <p className="text-[11px] text-zinc-500">
              Przewidywana presja płacowa i roczna indeksacja wynagrodzeń
              pracowników w okresie 15 lat.
            </p>
          </div>
        </div>
      )}

      {/* Sub-Tab 5: Taxes & CIT */}
      {activeSubTab === "taxes" && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-6">
          <div>
            <h4 className="font-semibold text-zinc-100 flex items-center gap-2 text-sm">
              <Receipt className="w-4 h-4 text-emerald-400" />
              Podatek Dochodowy (CIT) & Tarcza Podatkowa
            </h4>
            <p className="text-xs text-zinc-400 mt-0.5">
              Parametry fiskalne kalkulacji podatku dochodowego CIT, tryb rozliczania strat podatkowych oraz wieloletnia trajektoria tarczy (art. 7 ust. 5 i art. 25 ust. 1 CIT).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CIT Rate */}
            <div className="bg-zinc-950/60 p-5 rounded-lg border border-zinc-800/80 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200 block">
                  Stawka Podatku CIT
                </span>
                <InfoTooltip
                  content="Ustawowa stawka podatku dochodowego od osób prawnych w Polsce (standardowa 19% lub obniżona 9% dla małych podatników)."
                  ariaLabel="Informacje o stawce CIT"
                  size="xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  {
                    rate: 19.0,
                    label: "19% Standardowy",
                    desc: "Standardowa stawka CIT w Polsce",
                  },
                  {
                    rate: 9.0,
                    label: "9% Preferencyjny",
                    desc: "Dla małych podatników i startupów",
                  },
                ].map((option) => (
                  <Tooltip key={option.rate} content={option.desc}>
                    <button
                      type="button"
                      onClick={() => setCitRatePercent(option.rate)}
                      aria-label={option.label}
                      className={`p-3 rounded-lg border text-left transition-all w-full ${
                        citRatePercent === option.rate
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <div className="font-bold font-mono text-sm">
                        {option.label}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-1">
                        {option.desc}
                      </div>
                    </button>
                  </Tooltip>
                ))}
              </div>

              {/* WACC Tax Shield Synchronization Info */}
              <div
                className="p-3.5 bg-zinc-900/80 rounded-lg border border-zinc-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                data-testid="wacc-tax-shield-info"
              >
                <div className="flex items-center gap-2 text-zinc-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    <strong>Synchronizacja Tarczy Podatkowej WACC:</strong>{" "}
                    Efektywny koszt długu po opodatkowaniu wynosi{" "}
                    <span className="font-mono text-emerald-400 font-semibold">
                      Kd × (1 - {citRatePercent}%) = Kd ×{" "}
                      {((100 - citRatePercent) / 100).toFixed(2)}
                    </span>{" "}
                    w modelu DCF i wycenie projektowej.
                  </span>
                </div>
                <span className="font-mono text-xs px-2.5 py-1 rounded bg-zinc-950 border border-zinc-700/80 text-emerald-400 shrink-0 font-semibold">
                  Tarcza: {citRatePercent}%
                </span>
              </div>
            </div>

            {/* Tax Loss Carry Forward & Settlement Mode */}
            <div className="bg-zinc-950/60 p-5 rounded-lg border border-zinc-800/80 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-zinc-200 block">
                      Rozliczanie Strat Podatkowych
                    </span>
                    <InfoTooltip
                      content="Art. 7 ust. 5 ustawy o CIT: prawo obniżenia dochodu uzyskanego w najbliższych kolejno po sobie następujących 5 latach podatkowych o wysokość straty."
                      ariaLabel="Informacje o rozliczaniu strat podatkowych"
                      size="xs"
                    />
                  </div>
                  <span className="text-[11px] text-zinc-400">
                    Aktywuj tarczę podatkową z etapu budowy / CAPEX
                  </span>
                </div>
                <Tooltip content="Włącz lub wyłącz odliczanie strat podatkowych z etapu budowy / CAPEX od przyszłych dochodów">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={taxLossCarryForward}
                      onChange={(e) => setTaxLossCarryForward(e.target.checked)}
                      aria-label="Włącz rozliczanie strat podatkowych"
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                  </label>
                </Tooltip>
              </div>

              <div className={`space-y-4 pt-2 border-t border-zinc-800/80 ${!taxLossCarryForward ? "opacity-50" : ""}`}>
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <label className="text-xs font-semibold text-zinc-300 block">
                      Ustawowy Tryb Rozliczenia Strat (art. 7 ust. 5 CIT)
                    </label>
                    <InfoTooltip
                      content="Wybór metody kalkulacji limitu odliczenia strat podatkowych w myśl przepisów polskiego prawa podatkowego."
                      ariaLabel="Informacje o trybach rozliczania strat"
                      size="xs"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      {
                        id: "standard_loss_cap",
                        title: "Standardowy (50%)",
                        art: "art. 7 ust. 5 pkt 1",
                        desc: "Maks. 50% straty rocznika rocznie",
                      },
                      {
                        id: "one_off_5m",
                        title: "Jednorazowo (5 mln)",
                        art: "art. 7 ust. 5 pkt 2",
                        desc: "Do 5 mln zł w 1 roku, reszta 50%",
                      },
                      {
                        id: "ebt_cap",
                        title: "Limit Dochodu EBT",
                        art: "Custom / Legacy",
                        desc: "Limit % bieżącego dochodu",
                      },
                    ].map((mode) => (
                      <Tooltip key={mode.id} content={`${mode.title} (${mode.art}): ${mode.desc}`}>
                        <button
                          type="button"
                          disabled={!taxLossCarryForward}
                          onClick={() => setTaxLossSettlementMode(mode.id)}
                          aria-label={mode.title}
                          className={`p-2.5 rounded-lg border text-left transition-all disabled:cursor-not-allowed w-full ${
                            taxLossSettlementMode === mode.id
                              ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm"
                              : "bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                          }`}
                        >
                          <div className="font-semibold text-xs text-zinc-200">
                            {mode.title}
                          </div>
                          <div className="text-[10px] text-emerald-400/90 font-mono mt-0.5">
                            {mode.art}
                          </div>
                          <div className="text-[10px] text-zinc-500 mt-1 line-clamp-2">
                            {mode.desc}
                          </div>
                        </button>
                      </Tooltip>
                    ))}
                  </div>
                </div>

                {/* Mode specific configuration */}
                {taxLossSettlementMode === "one_off_5m" ? (
                  <div className="space-y-2 p-3 bg-zinc-900/60 rounded-lg border border-zinc-800">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-300 font-medium">
                          Limit Odliczenia Jednorazowego (PLN):
                        </span>
                        <InfoTooltip
                          content="Maksymalny limit jednorazowego odliczenia straty z danego roku zgodnie z art. 7 ust. 5 pkt 2 ustawy o CIT (ustawowo 5 000 000 PLN)."
                          ariaLabel="Informacje o limicie jednorazowym"
                          size="xs"
                        />
                      </div>
                      <span className="font-mono text-emerald-400 font-bold text-xs">
                        {formatCurrency(taxLossOneOffCapAmount, currency)}
                      </span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      step={100000}
                      disabled={!taxLossCarryForward}
                      aria-label="Kwota Limitu Jednorazowego"
                      value={taxLossOneOffCapAmount}
                      onChange={(e) =>
                        setTaxLossOneOffCapAmount(
                          Math.max(0, parseFloat(e.target.value) || 0),
                        )
                      }
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 font-mono text-xs focus:outline-none focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <p className="text-[11px] text-zinc-500">
                      Zgodnie z art. 7 ust. 5 pkt 2 ustawy o CIT, kwota straty do 5 mln zł może zostać odliczona jednorazowo w całości w jednym z 5 lat podatkowych.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-400 flex justify-between items-center">
                      <span className="flex items-center gap-1.5">
                        <span>Limit Rocznego Odliczenia Straty (%)</span>
                        <InfoTooltip
                          content="Maksymalny dopuszczalny udział straty rocznika, który można odliczyć w pojedynczym roku podatkowym (standardowo 50%)."
                          ariaLabel="Informacje o limicie rocznego odliczenia"
                          size="xs"
                        />
                      </span>
                      <span className="font-mono text-emerald-400 font-bold">
                        {taxLossOffsetCap.toFixed(0)}%
                      </span>
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      step={10}
                      disabled={!taxLossCarryForward}
                      aria-label="Limit Rocznego Odliczenia Straty (%)"
                      value={taxLossOffsetCap}
                      onChange={(e) =>
                        setTaxLossOffsetCap(parseFloat(e.target.value) || 50)
                      }
                      className="w-full accent-emerald-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Zgodnie z art. 7 ust. 5 pkt 1 ustawy o CIT, kwota odliczenia straty z danego rocznika nie może przekroczyć 50% kwoty tej straty w jednym roku podatkowym.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Live Tax Loss Roll-Forward Trajectory Schedule */}
          <div
            className="p-5 bg-zinc-950/70 rounded-xl border border-zinc-800/90 space-y-4"
            data-testid="tax-loss-rollforward-panel"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
              <div>
                <h5 className="font-semibold text-zinc-100 flex items-center gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Trajektoria Tarczy Podatkowej & Rozliczenie Strat (Tax Loss Roll-Forward)
                </h5>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Projekcja wykorzystania i wygaszania strat w 15-letnim horyzoncie z uwzględnieniem 5-letniego okna ustawowego (art. 7 ust. 5 CIT).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono">
                  Tryb: <strong className="text-emerald-400">{taxLossSettlementMode === "one_off_5m" ? "Jednorazowo 5M" : taxLossSettlementMode === "ebt_cap" ? "Limit EBT" : "Standard 50%"}</strong>
                </span>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 bg-zinc-900/60 rounded-lg border border-zinc-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400 block">Wygenerowane Straty</span>
                  <InfoTooltip
                    content="Suma ujemnych wyników brutto (EBT) wygenerowanych w fazie inwestycyjnej lub pierwszych latach rozruchu."
                    ariaLabel="Informacje o wygenerowanych stratach"
                    size="xs"
                  />
                </div>
                <span className="font-mono text-sm font-bold text-rose-400 mt-1 block">
                  {formatCurrency(taxRollForwardTrajectory?.totalLossesGenerated, currency)}
                </span>
              </div>

              <div className="p-3 bg-zinc-900/60 rounded-lg border border-zinc-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400 block">Wykorzystana Tarcza</span>
                  <InfoTooltip
                    content="Łączna kwota strat odliczona od podstawy opodatkowania w całym 15-letnim okresie projekcji."
                    ariaLabel="Informacje o wykorzystanej tarczy"
                    size="xs"
                  />
                </div>
                <span className="font-mono text-sm font-bold text-emerald-400 mt-1 block">
                  {formatCurrency(taxRollForwardTrajectory?.totalLossesUsed, currency)}
                </span>
              </div>

              <div className="p-3 bg-zinc-900/60 rounded-lg border border-zinc-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400 block">Oszczędność CIT</span>
                  <InfoTooltip
                    content="Efektywna korzyść finansowa wynikająca z obniżenia należnego podatku dochodowego CIT (Straty × Stawka CIT)."
                    ariaLabel="Informacje o oszczędności CIT"
                    size="xs"
                  />
                </div>
                <span className="font-mono text-sm font-bold text-emerald-300 mt-1 block">
                  {formatCurrency(taxRollForwardTrajectory?.totalTaxSaved, currency)}
                </span>
              </div>

              <div className="p-3 bg-zinc-900/60 rounded-lg border border-zinc-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400 block">Wygasłe Straty (T+5)</span>
                  <InfoTooltip
                    content="Straty nieodliczone w ustawowym 5-letnim oknie czasowym (art. 7 ust. 5 CIT), które bezpowrotnie przepadły."
                    ariaLabel="Informacje o wygasłych stratach"
                    size="xs"
                  />
                </div>
                <span className={`font-mono text-sm font-bold mt-1 block ${
                  (taxRollForwardTrajectory?.totalLossesExpired || 0) > 0 ? "text-rose-400" : "text-zinc-500"
                }`}>
                  {formatCurrency(taxRollForwardTrajectory?.totalLossesExpired, currency)}
                </span>
              </div>

              <div className="p-3 bg-zinc-900/60 rounded-lg border border-zinc-800/80 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400 block">Saldo Końcowe Tarczy</span>
                  <InfoTooltip
                    content="Pozostała pula nierozliczonych strat podatkowych na koniec 15. roku operacji."
                    ariaLabel="Informacje o saldzie końcowym"
                    size="xs"
                  />
                </div>
                <span className="font-mono text-sm font-bold text-amber-400 mt-1 block">
                  {formatCurrency(taxRollForwardTrajectory?.closingPool, currency)}
                </span>
              </div>
            </div>

            {/* Roll-Forward Table */}
            <div className="overflow-x-auto border border-zinc-800/80 rounded-lg">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-zinc-900/90 text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="py-2 px-3">
                      <Tooltip content="Kolejny rok w 15-letniej projekcji finansowej">
                        <span className="cursor-help">Okres</span>
                      </Tooltip>
                    </th>
                    <th className="py-2 px-3 text-right">
                      <Tooltip content="Dostępna pula nierozliczonych strat podatkowych na początek roku">
                        <span className="cursor-help">Saldo Otwarcia</span>
                      </Tooltip>
                    </th>
                    <th className="py-2 px-3 text-right">
                      <Tooltip content="Wynik finansowy brutto (EBT = EBITDA - Amortyzacja - Odsetki)">
                        <span className="cursor-help">Wynik Brutto (EBT)</span>
                      </Tooltip>
                    </th>
                    <th className="py-2 px-3 text-right">
                      <Tooltip content="Kwota strat, dla których upłynął 5-letni okres ustawowego odliczenia">
                        <span className="cursor-help">Wygasłe (T+5)</span>
                      </Tooltip>
                    </th>
                    <th className="py-2 px-3 text-right">
                      <Tooltip content="Kwota straty faktycznie odliczona w danym roku podatkowym">
                        <span className="cursor-help">Odliczona Tarcza</span>
                      </Tooltip>
                    </th>
                    <th className="py-2 px-3 text-right">
                      <Tooltip content="Dochód do opodatkowania po uwzględnieniu odliczonej tarczy podatkowej">
                        <span className="cursor-help">Podstawa CIT</span>
                      </Tooltip>
                    </th>
                    <th className="py-2 px-3 text-right">
                      <Tooltip content="Należny podatek dochodowy (Podstawa CIT × Stawka CIT)">
                        <span className="cursor-help">Należny CIT</span>
                      </Tooltip>
                    </th>
                    <th className="py-2 px-3 text-right">
                      <Tooltip content="Pozostała pula nierozliczonych strat podatkowych na koniec roku">
                        <span className="cursor-help">Saldo Zamknięcia</span>
                      </Tooltip>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {taxRollForwardTrajectory?.annualPeriods && taxRollForwardTrajectory.annualPeriods.length > 0 ? (
                    taxRollForwardTrajectory.annualPeriods.map((period) => {
                      const hasExpired = (period.taxLossExpired || 0) > 0;
                      const hasLossUsed = (period.taxLossUsed || 0) > 0;
                      const isLossYear = period.ebt < 0;

                      return (
                        <tr
                          key={period.year}
                          className={`hover:bg-zinc-900/40 transition-colors ${
                            isLossYear
                              ? "bg-rose-950/10"
                              : hasLossUsed
                              ? "bg-emerald-950/10"
                              : ""
                          }`}
                        >
                          <td className="py-2 px-3 font-semibold text-zinc-300">
                            Rok {period.year}
                          </td>
                          <td className="py-2 px-3 text-right text-zinc-400">
                            {formatCurrency(period.taxLossCarryForwardOpening ?? 0, currency)}
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-medium ${
                              isLossYear ? "text-rose-400" : "text-zinc-200"
                            }`}
                          >
                            {formatCurrency(period.ebt, currency)}
                          </td>
                          <td
                            className={`py-2 px-3 text-right ${
                              hasExpired ? "text-rose-400 font-bold" : "text-zinc-600"
                            }`}
                          >
                            {hasExpired ? `-${formatCurrency(period.taxLossExpired, currency)}` : "-"}
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-semibold ${
                              hasLossUsed ? "text-emerald-400" : "text-zinc-600"
                            }`}
                          >
                            {hasLossUsed ? formatCurrency(period.taxLossUsed, currency) : "-"}
                          </td>
                          <td className="py-2 px-3 text-right text-zinc-300">
                            {formatCurrency(period.taxableIncome ?? 0, currency)}
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-semibold ${
                              period.cit > 0 ? "text-amber-400" : "text-zinc-500"
                            }`}
                          >
                            {formatCurrency(period.cit, currency)}
                          </td>
                          <td className="py-2 px-3 text-right text-amber-300/90 font-medium">
                            {formatCurrency(period.taxLossCarryForwardClosing ?? 0, currency)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-4 text-center text-zinc-500">
                        Brak danych projekcji wieloletniej.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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
          <Tooltip content="Przywróć zapisane parametry założeń operacyjnych z bazy danych">
            <button
              type="button"
              onClick={handleReset}
              disabled={isSaving}
              aria-label="Resetuj założenia operacyjne"
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              Resetuj
            </button>
          </Tooltip>

          <Tooltip content="Zapisz zaktualizowane założenia operacyjne w projekcie inwestycyjnym">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              aria-label="Zapisz założenia operacyjne"
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
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

export default OperatingAssumptionsForm;
