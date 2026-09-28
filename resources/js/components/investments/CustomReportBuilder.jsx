import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
    FileSpreadsheet,
    Layers,
    Plus,
    Trash2,
    ArrowUp,
    ArrowDown,
    Eye,
    EyeOff,
    BarChart3,
    LineChart as LineChartIcon,
    Download,
    Search,
    SlidersHorizontal,
    Filter,
    RefreshCw,
    Check,
    CheckCircle2,
    Sparkles,
    TrendingUp,
    Calendar,
    DollarSign,
    Building2,
    HelpCircle,
    X,
    ChevronDown,
    ChevronUp,
    Table,
    Percent,
    ShieldCheck
} from 'lucide-react';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend
} from 'recharts';
import { Tooltip, InfoTooltip } from '../ui/Tooltip';
import { useTheme } from '../../context/ThemeContext';
import { useInvestmentProject } from '../../context/InvestmentProjectContext';
import { useNotification } from '../../context/NotificationContext';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { getInvestmentWorkerClient } from '../../workers/InvestmentWorkerClient';

/**
 * METRIC DEFINITIONS LIBRARY
 * Comprehensive catalog of 30+ institutional metrics across all statements, covenants, and valuation.
 */
export const METRIC_CATALOG = [
    // --- 1. RACHUNEK ZYSKÓW I STRAT (P&L) ---
    {
        id: 'revenue',
        name: 'Przychody ze sprzedaży',
        shortName: 'Przychody',
        category: 'pnl',
        categoryName: 'Rachunek Zysków i Strat',
        unit: 'currency',
        aggregation: 'sum',
        color: '#3B82F6',
        description: 'Łączne przychody operacyjne projektu z uwzględnieniem ramp-up i indeksacji',
        getValue: (period) => period?.revenue ?? 0
    },
    {
        id: 'variable_costs',
        name: 'Koszty zmienne (COGS)',
        shortName: 'Koszty zm.',
        category: 'pnl',
        categoryName: 'Rachunek Zysków i Strat',
        unit: 'currency',
        aggregation: 'sum',
        color: '#F97316',
        description: 'Koszty bezpośrednio uzależnione od wolumenu sprzedaży',
        getValue: (period) => period?.variableCosts ?? 0
    },
    {
        id: 'fixed_costs',
        name: 'Koszty stałe (Fixed OPEX)',
        shortName: 'Koszty stałe',
        category: 'pnl',
        categoryName: 'Rachunek Zysków i Strat',
        unit: 'currency',
        aggregation: 'sum',
        color: '#FB923C',
        description: 'Bieżące koszty utrzymania, najmu, ubezpieczeń i administracji',
        getValue: (period) => period?.fixedCosts ?? 0
    },
    {
        id: 'payroll_costs',
        name: 'Wynagrodzenia i narzuty (Payroll)',
        shortName: 'Wynagrodzenia',
        category: 'pnl',
        categoryName: 'Rachunek Zysków i Strat',
        unit: 'currency',
        aggregation: 'sum',
        color: '#F43F5E',
        description: 'Łączny fundusz płac personelu operacyjnego i zarządzającego',
        getValue: (period) => period?.payrollCosts ?? 0
    },
    {
        id: 'total_opex',
        name: 'Suma kosztów operacyjnych (OPEX)',
        shortName: 'Total OPEX',
        category: 'pnl',
        categoryName: 'Rachunek Zysków i Strat',
        unit: 'currency',
        aggregation: 'sum',
        color: '#EF4444',
        description: 'Łączne koszty operacyjne (koszty zmienne, stałe i płace)',
        getValue: (period) => period?.totalOpex ?? 0
    },
    {
        id: 'ebitda',
        name: 'EBITDA (Wynik operacyjny powiększony o amortyzację)',
        shortName: 'EBITDA',
        category: 'pnl',
        categoryName: 'Rachunek Zysków i Strat',
        unit: 'currency',
        aggregation: 'sum',
        color: '#10B981',
        description: 'Zysk operacyjny przed amortyzacją - bazowa miara generacji gotówki operacyjnej',
        getValue: (period) => period?.ebitda ?? 0
    },
    {
        id: 'ebitda_margin',
        name: 'Marża EBITDA (%)',
        shortName: 'Marża EBITDA',
        category: 'pnl',
        categoryName: 'Rachunek Zysków i Strat',
        unit: 'percent',
        aggregation: 'avg',
        color: '#059669',
        description: 'Stosunek EBITDA do przychodów ze sprzedaży',
        getValue: (period) => period?.ebitdaMarginPercent ?? (period?.revenue > 0 ? (period.ebitda / period.revenue) * 100 : 0)
    },
    {
        id: 'depreciation',
        name: 'Amortyzacja (D&A)',
        shortName: 'Amortyzacja',
        category: 'pnl',
        categoryName: 'Rachunek Zysków i Strat',
        unit: 'currency',
        aggregation: 'sum',
        color: '#9CA3AF',
        description: 'Odpisy amortyzacyjne od nakładów początkowych i reinwestycji KŚT',
        getValue: (period) => period?.depreciation ?? 0
    },
    {
        id: 'ebit',
        name: 'EBIT (Zysk operacyjny)',
        shortName: 'EBIT',
        category: 'pnl',
        categoryName: 'Rachunek Zysków i Strat',
        unit: 'currency',
        aggregation: 'sum',
        color: '#14B8A6',
        description: 'Wynik operacyjny po uwzględnieniu odpisów amortyzacyjnych',
        getValue: (period) => period?.ebit ?? 0
    },
    {
        id: 'interest_expense',
        name: 'Koszty odsetkowe (Interest Expense)',
        shortName: 'Odsetki',
        category: 'pnl',
        categoryName: 'Rachunek Zysków i Strat',
        unit: 'currency',
        aggregation: 'sum',
        color: '#E11D48',
        description: 'Koszty finansowe obsługi długu bankowego i pożyczek podporządkowanych',
        getValue: (period) => period?.interestExpense ?? 0
    },
    {
        id: 'ebt',
        name: 'Zysk brutto (EBT)',
        shortName: 'EBT',
        category: 'pnl',
        categoryName: 'Rachunek Zysków i Strat',
        unit: 'currency',
        aggregation: 'sum',
        color: '#0D9488',
        description: 'Wynik finansowy przed opodatkowaniem podatkiem dochodowym',
        getValue: (period) => period?.ebt ?? 0
    },
    {
        id: 'cit',
        name: 'Podatek dochodowy (CIT)',
        shortName: 'CIT',
        category: 'pnl',
        categoryName: 'Rachunek Zysków i Strat',
        unit: 'currency',
        aggregation: 'sum',
        color: '#64748B',
        description: 'Bieżący podatek dochodowy od osób prawnych (z uwzględnieniem tarczy podatkowej)',
        getValue: (period) => period?.cit ?? 0
    },
    {
        id: 'net_income',
        name: 'Zysk netto (Net Income)',
        shortName: 'Zysk netto',
        category: 'pnl',
        categoryName: 'Rachunek Zysków i Strat',
        unit: 'currency',
        aggregation: 'sum',
        color: '#22C55E',
        description: 'Wynik finansowy netto przypadający akcjonariuszom projektu',
        getValue: (period) => period?.netIncome ?? 0
    },
    {
        id: 'net_margin',
        name: 'Marża netto (%)',
        shortName: 'Marża netto',
        category: 'pnl',
        categoryName: 'Rachunek Zysków i Strat',
        unit: 'percent',
        aggregation: 'avg',
        color: '#16A34A',
        description: 'Stosunek zysku netto do całkowitych przychodów',
        getValue: (period) => period?.netMarginPercent ?? (period?.revenue > 0 ? (period.netIncome / period.revenue) * 100 : 0)
    },

    // --- 2. BILANS (BALANCE SHEET) ---
    {
        id: 'closing_cash',
        name: 'Środki pieniężne (Closing Cash)',
        shortName: 'Gotówka',
        category: 'balance',
        categoryName: 'Bilans',
        unit: 'currency',
        aggregation: 'last',
        color: '#06B6D4',
        description: 'Stan gotówki i ekwiwalentów na rachunkach projektu na koniec okresu',
        getValue: (period) => period?.closingCash ?? 0
    },
    {
        id: 'receivables',
        name: 'Należności handlowe (Receivables)',
        shortName: 'Należności',
        category: 'balance',
        categoryName: 'Bilans',
        unit: 'currency',
        aggregation: 'last',
        color: '#818CF8',
        description: 'Stan należności od odbiorców wynikający z cyklu DSO',
        getValue: (period) => period?.closingReceivables ?? 0
    },
    {
        id: 'inventory',
        name: 'Zapasy (Inventory)',
        shortName: 'Zapasy',
        category: 'balance',
        categoryName: 'Bilans',
        unit: 'currency',
        aggregation: 'last',
        color: '#A78BFA',
        description: 'Stan zapasów magazynowych na koniec roku',
        getValue: (period) => period?.closingInventory ?? 0
    },
    {
        id: 'payables',
        name: 'Zobowiązania handlowe (Payables)',
        shortName: 'Zobowiązania handl.',
        category: 'balance',
        categoryName: 'Bilans',
        unit: 'currency',
        aggregation: 'last',
        color: '#C084FC',
        description: 'Stan bieżących zobowiązań handlowych wynikający z cyklu DPO',
        getValue: (period) => period?.closingPayables ?? 0
    },
    {
        id: 'nwc',
        name: 'Kapitał obrotowy netto (NWC)',
        shortName: 'NWC',
        category: 'balance',
        categoryName: 'Bilans',
        unit: 'currency',
        aggregation: 'last',
        color: '#6366F1',
        description: 'Aktywa bieżące pomniejszone o pasywa bieżące (Należności + Zapasy - Zobowiązania)',
        getValue: (period) => (period?.closingReceivables ?? 0) + (period?.closingInventory ?? 0) - (period?.closingPayables ?? 0)
    },
    {
        id: 'gross_debt',
        name: 'Zadłużenie kredytowe brutto (Gross Debt)',
        shortName: 'Dług brutto',
        category: 'balance',
        categoryName: 'Bilans',
        unit: 'currency',
        aggregation: 'last',
        color: '#F43F5E',
        description: 'Pozostały kapitał długu bankowego do spłaty na koniec okresu',
        getValue: (period) => period?.closingDebt ?? 0
    },
    {
        id: 'net_debt',
        name: 'Dług netto (Net Debt)',
        shortName: 'Dług netto',
        category: 'balance',
        categoryName: 'Bilans',
        unit: 'currency',
        aggregation: 'last',
        color: '#E11D48',
        description: 'Zadłużenie kredytowe pomniejszone o wolne środki pieniężne',
        getValue: (period, sim, idx) => {
            const cov = sim?.covenants?.annualCovenants?.[idx];
            if (cov?.netDebt !== undefined) return cov.netDebt;
            const gross = period?.closingDebt ?? 0;
            const cash = period?.closingCash ?? 0;
            return Math.max(0, gross - cash);
        }
    },

    // --- 3. RACHUNEK PRZEPŁYWÓW PIENIĘŻNYCH (CASH FLOW) ---
    {
        id: 'operating_cf',
        name: 'Przepływy operacyjne (Operating Cash Flow)',
        shortName: 'CF Operacyjny',
        category: 'cashflow',
        categoryName: 'Przepływy Pieniężne',
        unit: 'currency',
        aggregation: 'sum',
        color: '#10B981',
        description: 'Środki wygenerowane bezpośrednio z podstawowej działalności operacyjnej (EBITDA - CIT - ΔNWC)',
        getValue: (period) => period?.operatingCashFlow ?? 0
    },
    {
        id: 'capex',
        name: 'Nakłady inwestycyjne (CAPEX)',
        shortName: 'CAPEX',
        category: 'cashflow',
        categoryName: 'Przepływy Pieniężne',
        unit: 'currency',
        aggregation: 'sum',
        color: '#EF4444',
        description: 'Wydatki na realizację fazy budowlanej oraz reinwestycje odtworzeniowe',
        getValue: (period) => period?.capex ?? 0
    },
    {
        id: 'investing_cf',
        name: 'Przepływy inwestycyjne (Investing Cash Flow)',
        shortName: 'CF Inwestycyjny',
        category: 'cashflow',
        categoryName: 'Przepływy Pieniężne',
        unit: 'currency',
        aggregation: 'sum',
        color: '#DC2626',
        description: 'Wypływy na nabycie i modernizację aktywów trwałych',
        getValue: (period) => period?.investingCashFlow ?? -(period?.capex ?? 0)
    },
    {
        id: 'financing_cf',
        name: 'Przepływy finansowe (Financing Cash Flow)',
        shortName: 'CF Finansowy',
        category: 'cashflow',
        categoryName: 'Przepływy Pieniężne',
        unit: 'currency',
        aggregation: 'sum',
        color: '#8B5CF6',
        description: 'Wpływy z uruchomienia długu pomniejszone o spłaty rat kapitałowych i odsetek',
        getValue: (period) => period?.financingCashFlow ?? 0
    },
    {
        id: 'net_cash_flow',
        name: 'Przepływy pieniężne netto (Net Cash Flow)',
        shortName: 'CF Netto',
        category: 'cashflow',
        categoryName: 'Przepływy Pieniężne',
        unit: 'currency',
        aggregation: 'sum',
        color: '#0284C7',
        description: 'Całkowita zmiana stanu gotówki w danym roku obrotowym',
        getValue: (period) => period?.netCashFlow ?? 0
    },
    {
        id: 'fcff',
        name: 'Wolne przepływy dla firmy (FCFF)',
        shortName: 'FCFF',
        category: 'cashflow',
        categoryName: 'Przepływy Pieniężne',
        unit: 'currency',
        aggregation: 'sum',
        color: '#3B82F6',
        description: 'Przepływy dostępne dla wszystkich dawców kapitału (wierzycieli i akcjonariuszy)',
        getValue: (period) => period?.fcff ?? 0
    },
    {
        id: 'fcfe',
        name: 'Wolne przepływy dla akcjonariuszy (FCFE / Dywidendy)',
        shortName: 'FCFE (Dywidendy)',
        category: 'cashflow',
        categoryName: 'Przepływy Pieniężne',
        unit: 'currency',
        aggregation: 'sum',
        color: '#8B5CF6',
        description: 'Gotówka dostępna do wypłaty dywidend po pełnej obsłudze długu bankowego',
        getValue: (period) => period?.fcfe ?? 0
    },

    // --- 4. DŁUG I KOWENANTY BANKOWE ---
    {
        id: 'cfads',
        name: 'Przepływy na obsługę długu (CFADS)',
        shortName: 'CFADS',
        category: 'covenants',
        categoryName: 'Dług i Kowenanty',
        unit: 'currency',
        aggregation: 'sum',
        color: '#10B981',
        description: 'Gotówka operacyjna dostępna do obsługi rat kapitałowo-odsetkowych',
        getValue: (period, sim, idx) => {
            const cov = sim?.covenants?.annualCovenants?.[idx];
            return cov?.cfads ?? period?.operatingCashFlow ?? 0;
        }
    },
    {
        id: 'total_debt_service',
        name: 'Obsługa długu ogółem (Total Debt Service)',
        shortName: 'Obsługa długu',
        category: 'covenants',
        categoryName: 'Dług i Kowenanty',
        unit: 'currency',
        aggregation: 'sum',
        color: '#E11D48',
        description: 'Łączna roczna suma spłaty raty kapitałowej oraz odsetek kredytowych',
        getValue: (period, sim, idx) => {
            const cov = sim?.covenants?.annualCovenants?.[idx];
            if (cov?.totalDebtService !== undefined) return cov.totalDebtService;
            return (period?.interestExpense ?? 0) + (period?.debtPrincipalRepaid ?? 0);
        }
    },
    {
        id: 'principal_repaid',
        name: 'Spłata rat kapitałowych długu',
        shortName: 'Spłata kapitału',
        category: 'covenants',
        categoryName: 'Dług i Kowenanty',
        unit: 'currency',
        aggregation: 'sum',
        color: '#BE123C',
        description: 'Część kapitałowa raty kredytu spłacona w danym roku',
        getValue: (period, sim, idx) => {
            const cov = sim?.covenants?.annualCovenants?.[idx];
            return cov?.principalRepaid ?? period?.debtPrincipalRepaid ?? 0;
        }
    },
    {
        id: 'dscr',
        name: 'Wskaźnik pokrycia długu (DSCR)',
        shortName: 'DSCR',
        category: 'covenants',
        categoryName: 'Dług i Kowenanty',
        unit: 'ratio',
        aggregation: 'avg',
        color: '#F59E0B',
        description: 'Stosunek CFADS do rocznej obsługi długu (wymóg bankowy zazwyczaj min. 1.20x)',
        getValue: (period, sim, idx) => {
            const cov = sim?.covenants?.annualCovenants?.[idx];
            return cov?.dscr ?? period?.dscr ?? null;
        }
    },
    {
        id: 'icr',
        name: 'Wskaźnik pokrycia odsetek (ICR)',
        shortName: 'ICR',
        category: 'covenants',
        categoryName: 'Dług i Kowenanty',
        unit: 'ratio',
        aggregation: 'avg',
        color: '#D97706',
        description: 'Stosunek EBIT lub EBITDA do kosztów odsetkowych',
        getValue: (period, sim, idx) => {
            const cov = sim?.covenants?.annualCovenants?.[idx];
            return cov?.icr ?? period?.interestCoverageRatio ?? null;
        }
    },
    {
        id: 'leverage_ratio',
        name: 'Wskaźnik dźwigni finansowej (Net Debt / EBITDA)',
        shortName: 'Dług netto / EBITDA',
        category: 'covenants',
        categoryName: 'Dług i Kowenanty',
        unit: 'ratio',
        aggregation: 'avg',
        color: '#DC2626',
        description: 'Liczba lat generacji EBITDA potrzebna do spłaty całego długu netto',
        getValue: (period, sim, idx) => {
            const cov = sim?.covenants?.annualCovenants?.[idx];
            return cov?.leverageRatio ?? null;
        }
    },
    {
        id: 'dsrf_months',
        name: 'Bufor rezerwy obsługi długu (DSRF)',
        shortName: 'DSRF (miesiące)',
        category: 'covenants',
        categoryName: 'Dług i Kowenanty',
        unit: 'months',
        aggregation: 'avg',
        color: '#3B82F6',
        description: 'Wskaźnik płynności DSRF: relacja wolnej gotówki do miesięcznej raty długu',
        getValue: (period, sim, idx) => {
            const cov = sim?.covenants?.annualCovenants?.[idx];
            return cov?.dsrfMonths ?? null;
        }
    },
    {
        id: 'current_ratio',
        name: 'Wskaźnik płynności bieżącej (Current Ratio)',
        shortName: 'Current Ratio',
        category: 'covenants',
        categoryName: 'Dług i Kowenanty',
        unit: 'ratio',
        aggregation: 'avg',
        color: '#0284C7',
        description: 'Stosunek aktywów obrotowych do pasywów krótkoterminowych',
        getValue: (period, sim, idx) => {
            const cov = sim?.covenants?.annualCovenants?.[idx];
            return cov?.currentRatio ?? null;
        }
    },

    // --- 5. WYCENA I ZWROTY SPONSORA (PE / M&A) ---
    {
        id: 'enterprise_value',
        name: 'Wartość Przedsiębiorstwa (Enterprise Value - EV)',
        shortName: 'EV',
        category: 'valuation',
        categoryName: 'Wycena i Zwroty',
        unit: 'currency',
        aggregation: 'last',
        color: '#6366F1',
        description: 'Implikowana wartość firmy w oparciu o mnożnik EV/EBITDA',
        getValue: (period, sim) => {
            const multiple = sim?.exitValuation?.exitMultiple ?? 7.5;
            const ebitda = period?.ebitda ?? 0;
            return Math.max(0, ebitda * multiple);
        }
    },
    {
        id: 'equity_value',
        name: 'Wartość Kapitału Własnego (Equity Value)',
        shortName: 'Equity Value',
        category: 'valuation',
        categoryName: 'Wycena i Zwroty',
        unit: 'currency',
        aggregation: 'last',
        color: '#8B5CF6',
        description: 'Wartość udziałów inwestora po odliczeniu długu netto (EV - Net Debt)',
        getValue: (period, sim, idx) => {
            const multiple = sim?.exitValuation?.exitMultiple ?? 7.5;
            const ebitda = period?.ebitda ?? 0;
            const ev = Math.max(0, ebitda * multiple);
            const cov = sim?.covenants?.annualCovenants?.[idx];
            const netDebt = cov?.netDebt !== undefined ? cov.netDebt : Math.max(0, (period?.closingDebt ?? 0) - (period?.closingCash ?? 0));
            return Math.max(0, ev - netDebt);
        }
    },
    {
        id: 'buyer_ebitda_yield',
        name: 'Implikowany Yield EBITDA Kupującego (%)',
        shortName: 'Yield EBITDA kupującego',
        category: 'valuation',
        categoryName: 'Wycena i Zwroty',
        unit: 'percent',
        aggregation: 'avg',
        color: '#EC4899',
        description: 'Rentowność EBITDA inwestora nabywającego projekt (EBITDA / EV)',
        getValue: (period, sim) => {
            const multiple = sim?.exitValuation?.exitMultiple ?? 7.5;
            return multiple > 0 ? (1 / multiple) * 100 : 0;
        }
    },
    {
        id: 'cumulative_moic',
        name: 'Zwrot z zainwestowanego kapitału (MoIC)',
        shortName: 'MoIC Inwestora',
        category: 'valuation',
        categoryName: 'Wycena i Zwroty',
        unit: 'ratio',
        aggregation: 'last',
        color: '#10B981',
        description: 'Stosunek sumy dywidend FCFE i bieżącej wartości kapitału do wniesionego wkładu własnego',
        getValue: (period, sim, idx) => {
            const initialEquity = sim?.exitValuation?.initialEquity || sim?.statements?.initialEquity || 1;
            let cumDividends = 0;
            const periods = sim?.statements?.annualPeriods || [];
            for (let i = 0; i <= idx && i < periods.length; i++) {
                cumDividends += Math.max(0, periods[i].fcfe || 0);
            }
            const multiple = sim?.exitValuation?.exitMultiple ?? 7.5;
            const ev = Math.max(0, (period?.ebitda ?? 0) * multiple);
            const cov = sim?.covenants?.annualCovenants?.[idx];
            const netDebt = cov?.netDebt !== undefined ? cov.netDebt : Math.max(0, (period?.closingDebt ?? 0) - (period?.closingCash ?? 0));
            const eqVal = Math.max(0, ev - netDebt);
            return initialEquity > 0 ? (cumDividends + eqVal) / initialEquity : 0;
        }
    }
];

/**
 * BUILT-IN EXECUTIVE & FINANCIAL REPORT PRESETS
 */
export const REPORT_PRESETS = [
    {
        id: 'executive_cash',
        name: 'Executive Cash Summary',
        badge: 'Zarząd i CFO',
        description: 'Kluczowe przepływy gotówkowe, rentowność i stan płynności projektu na osi czasu',
        metricIds: ['revenue', 'ebitda', 'capex', 'total_debt_service', 'fcfe', 'closing_cash']
    },
    {
        id: 'bank_debt_pack',
        name: 'Bank Debt Coverage Pack',
        badge: 'Komitet Kredytowy',
        description: 'Kompleksowy pakiet kowenantów: CFADS, obsługa długu, DSCR, ICR, Net Debt / EBITDA i bufor DSRF',
        metricIds: ['cfads', 'total_debt_service', 'dscr', 'icr', 'leverage_ratio', 'dsrf_months']
    },
    {
        id: 'pe_returns_bridge',
        name: 'PE Investor Returns & Equity Bridge',
        badge: 'Private Equity / M&A',
        description: 'Most wartości kapitału własnego (EV, Dług netto, Equity Value), strumień dywidend i mnożnik MoIC',
        metricIds: ['revenue', 'net_income', 'fcfe', 'enterprise_value', 'net_debt', 'equity_value', 'cumulative_moic']
    },
    {
        id: 'profitability_margins',
        name: 'Rentowność i Struktura Kosztów',
        badge: 'Controlling',
        description: 'Dekompozycja kosztów operacyjnych, marża EBITDA oraz konwersja na zysk netto',
        metricIds: ['revenue', 'variable_costs', 'fixed_costs', 'payroll_costs', 'ebitda', 'ebitda_margin', 'net_income', 'net_margin']
    },
    {
        id: 'working_capital',
        name: 'Kapitał Obrotowy i Płynność',
        badge: 'Operacje & Skarbowość',
        description: 'Cykl kapitału obrotowego netto (NWC), stan zapasów, należności oraz Current Ratio',
        metricIds: ['receivables', 'inventory', 'payables', 'nwc', 'operating_cf', 'current_ratio']
    },
    {
        id: 'custom',
        name: 'Własne Zestawienie Raportowe',
        badge: 'Personalizowane',
        description: 'Dowolna kompozycja pozycji ze wszystkich sprawozdań finansowych z możliwością zapisu i sortowania',
        metricIds: ['revenue', 'ebitda', 'net_income', 'operating_cf', 'closing_cash']
    }
];

/**
 * SCALE OPTIONS
 */
export const SCALE_OPTIONS = [
    { id: 'full', label: 'PLN', divisor: 1, suffix: 'PLN' },
    { id: 'thousands', label: 'tys. PLN', divisor: 1000, suffix: 'tys. PLN' },
    { id: 'millions', label: 'mln PLN', divisor: 1000000, suffix: 'mln PLN' }
];

/**
 * TIME HORIZON OPTIONS
 */
export const HORIZON_OPTIONS = [
    { id: 5, label: '5 Lat (Faza Początkowa)' },
    { id: 10, label: '10 Lat (Horyzont Kredytowy)' },
    { id: 15, label: '15 Lat (Pełny Cykl Życia)' }
];

/**
 * Phase 45 Commit 223: CustomReportBuilder Component
 * Interactive Multi-Statement Financial Report Composer & Timeline Visualizer
 */
export const CustomReportBuilder = ({
    project = null,
    simulationData: initialSimulationData = null,
    className = ''
}) => {
    const { selectedProject: contextProject } = useInvestmentProject();
    const { success, error: notifyError } = useNotification();
    const activeProject = project || contextProject;

    // Simulation Data state
    const [simulationData, setSimulationData] = useState(initialSimulationData);
    const [loading, setLoading] = useState(false);

    // Report configuration state
    const [activePresetId, setActivePresetId] = useState('executive_cash');
    const [selectedMetricIds, setSelectedMetricIds] = useState(REPORT_PRESETS[0].metricIds);
    const [horizonYears, setHorizonYears] = useState(15);
    const [scale, setScale] = useState('thousands');
    const [chartVisible, setChartVisible] = useState(true);
    const [chartType, setChartType] = useState('line'); // 'line' | 'bar'
    const [chartMetricIds, setChartMetricIds] = useState(['revenue', 'ebitda', 'closing_cash']);

    // Picker Modal / Expand state
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [pickerSearchQuery, setPickerSearchQuery] = useState('');
    const [pickerCategoryFilter, setPickerCategoryFilter] = useState('all');

    // Theme hook for Recharts and styling
    const { isDark } = useTheme();
    const gridStroke = isDark ? "#27272a" : "#e4e4e7";
    const axisStroke = isDark ? "#71717a" : "#a1a1aa";
    const tooltipBg = isDark ? "#18181b" : "#ffffff";
    const tooltipBorder = isDark ? "#27272a" : "#e4e4e7";
    const tooltipColor = isDark ? "#f4f4f5" : "#18181b";

    // Run simulation if not supplied
    useEffect(() => {
        if (initialSimulationData) {
            setSimulationData(initialSimulationData);
            return;
        }

        if (!activeProject) {
            setSimulationData(null);
            return;
        }

        let isMounted = true;
        setLoading(true);

        const client = getInvestmentWorkerClient();
        client.simulate(activeProject, activeProject.operating_assumptions, null, 15)
            .then((res) => {
                if (isMounted) setSimulationData(res);
            })
            .catch((err) => {
                console.error('[CustomReportBuilder] Simulation error:', err);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [activeProject, initialSimulationData]);

    // Handle Preset Switch
    const handlePresetChange = (presetId) => {
        setActivePresetId(presetId);
        const preset = REPORT_PRESETS.find(p => p.id === presetId);
        if (preset) {
            setSelectedMetricIds(preset.metricIds);
            // Default first 3 metrics into chart
            const chartDefaults = preset.metricIds.slice(0, 3);
            setChartMetricIds(chartDefaults);
        }
    };

    // Metric lookup map
    const metricCatalogMap = useMemo(() => {
        const map = new Map();
        METRIC_CATALOG.forEach(m => map.set(m.id, m));
        return map;
    }, []);

    // Active metrics in user order
    const activeMetrics = useMemo(() => {
        return selectedMetricIds
            .map(id => metricCatalogMap.get(id))
            .filter(Boolean);
    }, [selectedMetricIds, metricCatalogMap]);

    // Time horizon periods (1..horizonYears)
    const timelinePeriods = useMemo(() => {
        const annualPeriods = simulationData?.statements?.annualPeriods || [];
        return annualPeriods.slice(0, horizonYears);
    }, [simulationData, horizonYears]);

    // Scale config
    const activeScaleConfig = useMemo(() => {
        return SCALE_OPTIONS.find(s => s.id === scale) || SCALE_OPTIONS[1];
    }, [scale]);

    // Format value according to unit and scale
    const formatMetricValue = useCallback((val, unit) => {
        if (val === null || val === undefined || isNaN(val)) return '—';

        if (unit === 'percent') {
            return `${val >= 0 ? '' : '-'}${Math.abs(val).toFixed(1)}%`;
        }
        if (unit === 'ratio') {
            return `${val.toFixed(2)}x`;
        }
        if (unit === 'months') {
            return `${val.toFixed(1)} m-cy`;
        }

        // Currency
        const scaledVal = val / activeScaleConfig.divisor;
        return scaledVal.toLocaleString('pl-PL', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        });
    }, [activeScaleConfig]);

    // Row management callbacks
    const handleMoveMetric = (index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= selectedMetricIds.length) return;
        const newIds = [...selectedMetricIds];
        const temp = newIds[index];
        newIds[index] = newIds[targetIndex];
        newIds[targetIndex] = temp;
        setSelectedMetricIds(newIds);
        setActivePresetId('custom');
    };

    const handleRemoveMetric = (id) => {
        const newIds = selectedMetricIds.filter(mId => mId !== id);
        setSelectedMetricIds(newIds);
        setChartMetricIds(prev => prev.filter(cId => cId !== id));
        setActivePresetId('custom');
    };

    const handleAddMetric = (id) => {
        if (selectedMetricIds.includes(id)) return;
        const newIds = [...selectedMetricIds, id];
        setSelectedMetricIds(newIds);
        setActivePresetId('custom');
        success('Dodano pozycję', `Pozycja "${metricCatalogMap.get(id)?.name}" została dołączona do raportu.`);
    };

    const toggleChartMetric = (id) => {
        if (chartMetricIds.includes(id)) {
            setChartMetricIds(chartMetricIds.filter(cId => cId !== id));
        } else {
            if (chartMetricIds.length >= 6) {
                notifyError('Limit wykresu', 'Wykres może prezentować maksymalnie 6 linii jednocześnie.');
                return;
            }
            setChartMetricIds([...chartMetricIds, id]);
        }
    };

    // Calculate aggregated summary (Total or Average)
    const computeAggregation = useCallback((metric) => {
        if (!timelinePeriods.length) return 0;
        const values = timelinePeriods.map((p, idx) => metric.getValue(p, simulationData, idx));

        if (metric.aggregation === 'last') {
            return values[values.length - 1];
        }

        const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v));
        if (!validValues.length) return null;

        if (metric.aggregation === 'avg') {
            const sum = validValues.reduce((a, b) => a + b, 0);
            return sum / validValues.length;
        }

        // sum
        return validValues.reduce((a, b) => a + b, 0);
    }, [timelinePeriods, simulationData]);

    // Prepare Chart Data
    const chartData = useMemo(() => {
        if (!timelinePeriods.length) return [];
        return timelinePeriods.map((p, idx) => {
            const dataPoint = { year: `Rok ${idx + 1}` };
            chartMetricIds.forEach(id => {
                const metric = metricCatalogMap.get(id);
                if (metric) {
                    const rawVal = metric.getValue(p, simulationData, idx);
                    if (rawVal !== null && !isNaN(rawVal)) {
                        dataPoint[id] = metric.unit === 'currency'
                            ? Math.round((rawVal / activeScaleConfig.divisor) * 100) / 100
                            : Math.round(rawVal * 100) / 100;
                    }
                }
            });
            return dataPoint;
        });
    }, [timelinePeriods, chartMetricIds, metricCatalogMap, simulationData, activeScaleConfig]);

    // Export to CSV
    const handleExportCsv = () => {
        if (!activeMetrics.length || !timelinePeriods.length) {
            notifyError('Błąd eksportu', 'Brak danych raportu do wyeksportowania.');
            return;
        }

        const periodHeaders = timelinePeriods.map((_, i) => `"Rok ${i + 1}"`).join(';');
        const csvRows = [`"Pozycja Raportu";"Kategoria";"Jednostka";"Agregacja";${periodHeaders};"Podsumowanie"`];

        activeMetrics.forEach(metric => {
            const aggVal = computeAggregation(metric);
            const periodVals = timelinePeriods.map((p, idx) => {
                const val = metric.getValue(p, simulationData, idx);
                if (val === null || val === undefined || isNaN(val)) return '""';
                const formatted = metric.unit === 'currency'
                    ? (val / activeScaleConfig.divisor).toFixed(2)
                    : val.toFixed(2);
                return `"${formatted}"`;
            }).join(';');

            const formattedAgg = aggVal !== null && !isNaN(aggVal)
                ? (metric.unit === 'currency' ? (aggVal / activeScaleConfig.divisor).toFixed(2) : aggVal.toFixed(2))
                : '""';

            csvRows.push(`"${metric.name}";"${metric.categoryName}";"${metric.unit}";"${metric.aggregation === 'avg' ? 'Średnia' : metric.aggregation === 'last' ? 'Koniec okresu' : 'Suma'}";${periodVals};"${formattedAgg}"`);
        });

        const csvContent = '\uFEFF' + csvRows.join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        const fileName = `finboard-custom-report-${activePresetId}-${activeProject?.name ? activeProject.name.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'project'}.csv`;

        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        success('Eksport CSV zakończony', `Wyeksportowano raport do pliku ${fileName}`);
    };

    // Filtered list in Picker Modal
    const filteredPickerMetrics = useMemo(() => {
        return METRIC_CATALOG.filter(m => {
            const matchesCat = pickerCategoryFilter === 'all' || m.category === pickerCategoryFilter;
            const matchesSearch = !pickerSearchQuery ||
                m.name.toLowerCase().includes(pickerSearchQuery.toLowerCase()) ||
                m.description.toLowerCase().includes(pickerSearchQuery.toLowerCase());
            return matchesCat && matchesSearch;
        });
    }, [pickerCategoryFilter, pickerSearchQuery]);

    return (
        <div data-testid="custom-report-builder" className={`space-y-6 ${className}`}>
            {/* Header & Controls Panel */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
                    <div className="flex items-center space-x-3">
                        <Tooltip content="Kreator niestandardowych raportów finansowych z 15-letniego modelu">
                            <div className="p-3 bg-gradient-to-tr from-cyan-600/10 to-blue-600/10 dark:from-cyan-600/30 dark:to-blue-600/30 border border-cyan-500/20 dark:border-cyan-500/40 rounded-xl text-cyan-600 dark:text-cyan-400 shadow-inner cursor-help">
                                <FileSpreadsheet className="w-6 h-6" />
                            </div>
                        </Tooltip>
                        <div>
                            <div className="flex items-center space-x-2">
                                <h3 className="text-xl font-bold text-zinc-900 dark:text-white tracking-wide">
                                    Kreator Raportów Finansowych (Custom Report Builder)
                                </h3>
                                <InfoTooltip
                                    size="sm"
                                    content="Kreator umożliwiający dynamiczne komponowanie własnych zestawień z ponad 30 wskaźników finansowych, kowenantów i wyceny wyjścia z eksportem CSV oraz wizualizacją trendów."
                                    ariaLabel="Objaśnienie Kreatora Raportów"
                                />
                                <Tooltip content="Pełny 15-letni horyzont projekcji finansowej">
                                    <span>
                                        <Badge variant="info" className="bg-cyan-500/10 border-cyan-500/30 text-cyan-400 font-mono text-xs cursor-help">
                                            15-Year Horizon
                                        </Badge>
                                    </span>
                                </Tooltip>
                            </div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                Elastyczna kompozycja pozycji z RZiS, Bilansu, Cash Flow, kowenantów bankowych i wyceny wyjścia z eksportem CSV
                            </p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                        <Tooltip content="Otwórz bibliotekę 30+ instytucjonalnych pozycji finansowych do dodania do raportu">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setIsPickerOpen(true)}
                                data-testid="open-metric-picker-button"
                                className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200"
                            >
                                <Plus className="w-4 h-4 mr-1.5 text-cyan-400" />
                                <span>Dodaj Pozycję</span>
                            </Button>
                        </Tooltip>

                        <Tooltip content={chartVisible ? "Ukryj panel wykresu trendów" : "Pokaż panel interaktywnego wykresu trendów liniowych lub słupkowych"}>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setChartVisible(!chartVisible)}
                                data-testid="toggle-chart-button"
                                className={`border-zinc-300 dark:border-zinc-700 ${chartVisible ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-500/40' : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'}`}
                            >
                                {chartVisible ? <EyeOff className="w-4 h-4 mr-1.5" /> : <Eye className="w-4 h-4 mr-1.5" />}
                                <span>{chartVisible ? 'Ukryj Wykres' : 'Pokaż Wykres'}</span>
                            </Button>
                        </Tooltip>

                        <Tooltip content="Eksportuj skomponowany raport wraz z danymi okresów do pliku CSV">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={handleExportCsv}
                                data-testid="export-csv-button"
                                className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200"
                            >
                                <Download className="w-4 h-4 mr-1.5 text-emerald-400" />
                                <span>Eksportuj CSV</span>
                            </Button>
                        </Tooltip>
                    </div>
                </div>

                {/* Filter and Configuration Strip */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-5">
                    {/* Preset Selector */}
                    <div>
                        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Szablon Raportu (Preset)</span>
                            <InfoTooltip
                                size="xs"
                                content="Wybierz gotowy szablon analityczny (np. Standardowy, Bankowy, Płynnościowy lub Wyceny) albo stwórz własny."
                                ariaLabel="Objaśnienie szablonu raportu"
                            />
                        </label>
                        <select
                            data-testid="preset-select"
                            value={activePresetId}
                            onChange={(e) => handlePresetChange(e.target.value)}
                            className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                        >
                            {REPORT_PRESETS.map(preset => (
                                <option key={preset.id} value={preset.id}>
                                    {preset.name} ({preset.badge})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Time Horizon Selector */}
                    <div>
                        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-blue-400" />
                            <span>Horyzont Czasowy</span>
                            <InfoTooltip
                                size="xs"
                                content="Ogranicz horyzont czasowy raportu do 5, 10 lub pełnych 15 lat projekcji finansowej."
                                ariaLabel="Objaśnienie horyzontu czasowego"
                            />
                        </label>
                        <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800" data-testid="horizon-selector">
                            {HORIZON_OPTIONS.map(opt => (
                                <Tooltip key={opt.id} content={`Ustaw horyzont czasowy raportu na ${opt.id} lat`}>
                                    <button
                                        type="button"
                                        onClick={() => setHorizonYears(opt.id)}
                                        className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg transition-all ${
                                            horizonYears === opt.id
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                                        }`}
                                    >
                                        {opt.id}L
                                    </button>
                                </Tooltip>
                            ))}
                        </div>
                    </div>

                    {/* Scale Selector */}
                    <div>
                        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Skala Prezentacji Kwot</span>
                            <InfoTooltip
                                size="xs"
                                content="Zmień jednostkę prezentacji kwot w tabeli i na wykresie (PLN, tys. PLN lub mln PLN)."
                                ariaLabel="Objaśnienie skali kwot"
                            />
                        </label>
                        <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800" data-testid="scale-selector">
                            {SCALE_OPTIONS.map(opt => (
                                <Tooltip key={opt.id} content={`Prezentuj kwoty w jednostkach: ${opt.label}`}>
                                    <button
                                        type="button"
                                        onClick={() => setScale(opt.id)}
                                        className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg transition-all ${
                                            scale === opt.id
                                                ? 'bg-emerald-600 text-white shadow-sm'
                                                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                </Tooltip>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Preset description bar */}
                {REPORT_PRESETS.find(p => p.id === activePresetId)?.description && (
                    <div className="mt-4 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800/50 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                        <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>{REPORT_PRESETS.find(p => p.id === activePresetId).description}</span>
                    </div>
                )}
            </div>

            {/* Interactive Visual Chart (Recharts) */}
            {chartVisible && chartData.length > 0 && chartMetricIds.length > 0 && (
                <div data-testid="report-chart-container" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                        <div>
                            <h4 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-cyan-400" />
                                <span>Wizualizacja Trendów Wybranych Pozycji na Osi Czasu</span>
                            </h4>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                Kliknij ikonę oka w tabeli poniżej, aby dodać lub usunąć serię z wykresu
                            </p>
                        </div>
                        <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800">
                            <Tooltip content="Przełącz na liniowy wykres trendu">
                                <button
                                    type="button"
                                    data-testid="chart-type-line"
                                    onClick={() => setChartType('line')}
                                    className={`p-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${chartType === 'line' ? 'bg-cyan-600 text-white' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
                                    title="Wykres liniowy"
                                    aria-label="Wykres liniowy"
                                >
                                    <LineChartIcon className="w-4 h-4" />
                                </button>
                            </Tooltip>
                            <Tooltip content="Przełącz na słupkowy wykres porównawczy">
                                <button
                                    type="button"
                                    data-testid="chart-type-bar"
                                    onClick={() => setChartType('bar')}
                                    className={`p-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${chartType === 'bar' ? 'bg-cyan-600 text-white' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
                                    title="Wykres słupkowy"
                                    aria-label="Wykres słupkowy"
                                >
                                    <BarChart3 className="w-4 h-4" />
                                </button>
                            </Tooltip>
                        </div>
                    </div>

                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            {chartType === 'line' ? (
                                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.6} />
                                    <XAxis dataKey="year" stroke={axisStroke} fontSize={11} />
                                    <YAxis stroke={axisStroke} fontSize={11} />
                                    <RechartsTooltip
                                        contentStyle={{
                                            backgroundColor: tooltipBg,
                                            borderColor: tooltipBorder,
                                            borderRadius: '0.75rem',
                                            fontSize: '12px',
                                            color: tooltipColor
                                        }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                    {chartMetricIds.map(id => {
                                        const metric = metricCatalogMap.get(id);
                                        if (!metric) return null;
                                        return (
                                            <Line
                                                key={id}
                                                type="monotone"
                                                dataKey={id}
                                                name={`${metric.shortName || metric.name} (${metric.unit === 'currency' ? activeScaleConfig.suffix : metric.unit})`}
                                                stroke={metric.color}
                                                strokeWidth={2}
                                                dot={{ r: 3, fill: metric.color }}
                                                activeDot={{ r: 5 }}
                                            />
                                        );
                                    })}
                                </LineChart>
                            ) : (
                                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.6} />
                                    <XAxis dataKey="year" stroke={axisStroke} fontSize={11} />
                                    <YAxis stroke={axisStroke} fontSize={11} />
                                    <RechartsTooltip
                                        contentStyle={{
                                            backgroundColor: tooltipBg,
                                            borderColor: tooltipBorder,
                                            borderRadius: '0.75rem',
                                            fontSize: '12px',
                                            color: tooltipColor
                                        }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                    {chartMetricIds.map(id => {
                                        const metric = metricCatalogMap.get(id);
                                        if (!metric) return null;
                                        return (
                                            <Bar
                                                key={id}
                                                dataKey={id}
                                                name={`${metric.shortName || metric.name} (${metric.unit === 'currency' ? activeScaleConfig.suffix : metric.unit})`}
                                                fill={metric.color}
                                                radius={[4, 4, 0, 0]}
                                            />
                                        );
                                    })}
                                </BarChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Custom Report Table */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-950/60 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Table className="w-4 h-4 text-cyan-400" />
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">
                            Zestawienie Tabelaryczne ({activeMetrics.length} pozycji / {timelinePeriods.length} lat)
                        </span>
                    </div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                        Wartości w: <span className="text-cyan-400 font-semibold">{activeScaleConfig.label}</span>
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table data-testid="report-table" className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-zinc-100 dark:bg-zinc-950/90 text-zinc-700 dark:text-zinc-300 font-semibold border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
                                <th className="p-3 pl-4 min-w-[280px]">Pozycja Finansowa</th>
                                <th className="p-3 w-16 text-center">Wykres</th>
                                <th className="p-3 w-24 text-center">Kategoria</th>
                                {timelinePeriods.map((_, idx) => (
                                    <th key={idx} className="p-3 text-right min-w-[100px] font-mono">
                                        Rok {idx + 1}
                                    </th>
                                ))}
                                <th className="p-3 pr-4 text-right min-w-[110px] font-mono bg-zinc-100/95 dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800">
                                    Podsumowanie
                                </th>
                                <th className="p-3 w-20 text-center">Akcje</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 text-zinc-700 dark:text-zinc-300">
                            {activeMetrics.length === 0 ? (
                                <tr>
                                    <td colSpan={timelinePeriods.length + 5} className="p-8 text-center text-zinc-400 dark:text-zinc-500">
                                        Brak wybranych pozycji. Kliknij "Dodaj Pozycję", aby skomponować raport.
                                    </td>
                                </tr>
                            ) : (
                                activeMetrics.map((metric, index) => {
                                    const isChartActive = chartMetricIds.includes(metric.id);
                                    const aggVal = computeAggregation(metric);

                                    return (
                                        <tr
                                            key={metric.id}
                                            data-testid={`report-row-${metric.id}`}
                                            className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                                        >
                                            {/* Row Name & Description */}
                                            <td className="p-3 pl-4">
                                                <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                                    <span
                                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                                        style={{ backgroundColor: metric.color }}
                                                    />
                                                    <span>{metric.name}</span>
                                                </div>
                                                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 ml-4.5 truncate max-w-xs">
                                                    {metric.description}
                                                </div>
                                            </td>

                                            {/* Chart Toggle */}
                                            <td className="p-3 text-center">
                                                <Tooltip content={isChartActive ? 'Usuń pozycję z wykresu trendów' : 'Wyświetl pozycję na wykresie trendów'}>
                                                    <button
                                                        type="button"
                                                        data-testid={`toggle-chart-row-${metric.id}`}
                                                        onClick={() => toggleChartMetric(metric.id)}
                                                        className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                                            isChartActive
                                                                ? 'text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20'
                                                                : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300'
                                                        }`}
                                                        title={isChartActive ? 'Usuń z wykresu' : 'Pokaż na wykresie'}
                                                        aria-label={isChartActive ? 'Usuń z wykresu' : 'Pokaż na wykresie'}
                                                    >
                                                        {isChartActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                                    </button>
                                                </Tooltip>
                                            </td>

                                            {/* Category Badge */}
                                            <td className="p-3 text-center">
                                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                                    metric.category === 'pnl' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                                                    metric.category === 'balance' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                                                    metric.category === 'cashflow' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                                                    metric.category === 'covenants' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                                                    'bg-pink-500/10 text-pink-400 border-pink-500/30'
                                                }`}>
                                                    {metric.category.toUpperCase()}
                                                </span>
                                            </td>

                                            {/* Values across timeline periods */}
                                            {timelinePeriods.map((period, pIdx) => {
                                                const val = metric.getValue(period, simulationData, pIdx);
                                                const isNegative = typeof val === 'number' && val < 0;

                                                return (
                                                    <td
                                                        key={pIdx}
                                                        className={`p-3 text-right font-mono ${
                                                            isNegative ? 'text-rose-400' : 'text-zinc-800 dark:text-zinc-200'
                                                        }`}
                                                    >
                                                        {formatMetricValue(val, metric.unit)}
                                                    </td>
                                                );
                                            })}

                                            {/* Aggregation (Sum / Avg / Last) */}
                                            <td className="p-3 pr-4 text-right font-mono font-bold bg-zinc-50/60 dark:bg-zinc-950/40 border-l border-zinc-200 dark:border-zinc-800/80 text-cyan-600 dark:text-cyan-300">
                                                {formatMetricValue(aggVal, metric.unit)}
                                            </td>

                                            {/* Actions: Reorder and Remove */}
                                            <td className="p-3 text-center">
                                                <div className="flex items-center justify-center space-x-1">
                                                    <Tooltip content="Przesuń pozycję wyżej w tabeli">
                                                        <button
                                                            type="button"
                                                            disabled={index === 0}
                                                            onClick={() => handleMoveMetric(index, -1)}
                                                            className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-30 disabled:hover:text-zinc-400 cursor-pointer"
                                                            title="Przesuń w górę"
                                                            aria-label="Przesuń w górę"
                                                        >
                                                            <ArrowUp className="w-3 h-3" />
                                                        </button>
                                                    </Tooltip>
                                                    <Tooltip content="Przesuń pozycję niżej w tabeli">
                                                        <button
                                                            type="button"
                                                            disabled={index === activeMetrics.length - 1}
                                                            onClick={() => handleMoveMetric(index, 1)}
                                                            className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-30 disabled:hover:text-zinc-400 cursor-pointer"
                                                            title="Przesuń w dół"
                                                            aria-label="Przesuń w dół"
                                                        >
                                                            <ArrowDown className="w-3 h-3" />
                                                        </button>
                                                    </Tooltip>
                                                    <Tooltip content="Usuń pozycję z aktywnego raportu">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveMetric(metric.id)}
                                                            className="p-1 text-rose-400 hover:text-rose-300 cursor-pointer"
                                                            title="Usuń pozycję"
                                                            aria-label="Usuń pozycję"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </Tooltip>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Metric Picker Modal */}
            {isPickerOpen && (
                <div
                    data-testid="metric-picker-modal"
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
                >
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/70">
                            <div className="flex items-center space-x-3">
                                <div className="p-2.5 bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400">
                                    <Plus className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                                        Biblioteka Pozycji Raportowych
                                    </h3>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                        Wybierz pozycje finansowe do dołączenia do aktywnego raportu
                                    </p>
                                </div>
                            </div>
<Tooltip content="Zamknij bibliotekę pozycji">
                                <button
                                    type="button"
                                    onClick={() => setIsPickerOpen(false)}
                                    className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                                    aria-label="Zamknij bibliotekę"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </Tooltip>
                        </div>

                        {/* Search & Filter Strip */}
                        <div className="p-4 bg-zinc-50/70 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                                <input
                                    type="text"
                                    data-testid="picker-search-input"
                                    placeholder="Szukaj pozycji (np. EBITDA, DSCR, Kapitał...)"
                                    value={pickerSearchQuery}
                                    onChange={(e) => setPickerSearchQuery(e.target.value)}
                                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                                />
                            </div>
                            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0" data-testid="picker-category-filters">
                                {[
                                    { id: 'all', label: 'Wszystkie' },
                                    { id: 'pnl', label: 'P&L' },
                                    { id: 'balance', label: 'Bilans' },
                                    { id: 'cashflow', label: 'Cash Flow' },
                                    { id: 'covenants', label: 'Kowenanty' },
                                    { id: 'valuation', label: 'Wycena' }
                                ].map(cat => (
                                    <Tooltip key={cat.id} content={`Filtruj pozycje kategorii ${cat.label}`}>
                                        <button
                                            type="button"
                                            onClick={() => setPickerCategoryFilter(cat.id)}
                                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                                                pickerCategoryFilter === cat.id
                                                    ? 'bg-cyan-600 text-white'
                                                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200'
                                            }`}
                                        >
                                            {cat.label}
                                        </button>
                                    </Tooltip>
                                ))}
                            </div>
                        </div>

                        {/* Metrics List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {filteredPickerMetrics.map(metric => {
                                const isAdded = selectedMetricIds.includes(metric.id);

                                return (
                                    <div
                                        key={metric.id}
                                        data-testid={`picker-item-${metric.id}`}
                                        className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors flex items-center justify-between gap-4"
                                    >
                                        <div className="flex items-start space-x-3">
                                            <span
                                                className="w-3 h-3 rounded-full mt-1 shrink-0"
                                                style={{ backgroundColor: metric.color }}
                                            />
                                            <div>
                                                <div className="flex items-center space-x-2">
                                                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs">
                                                        {metric.name}
                                                    </span>
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                                        {metric.categoryName}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                                    {metric.description}
                                                </p>
                                            </div>
                                        </div>

                                        <Button
                                            variant={isAdded ? "secondary" : "primary"}
                                            size="sm"
                                            disabled={isAdded}
                                            onClick={() => handleAddMetric(metric.id)}
                                            data-testid={`picker-add-button-${metric.id}`}
                                            className={isAdded ? "opacity-50 cursor-not-allowed text-xs" : "bg-cyan-600 hover:bg-cyan-500 text-xs"}
                                        >
                                            {isAdded ? (
                                                <>
                                                    <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                                                    <span>Dodano</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Plus className="w-3.5 h-3.5 mr-1" />
                                                    <span>Dołącz</span>
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setIsPickerOpen(false)}
                                className="bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200"
                            >
                                Zamknij
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomReportBuilder;
