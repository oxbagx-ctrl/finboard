import React from 'react';
import {
    Building2,
    Shield,
    Lock,
    FileCheck,
    Hash,
    Clock,
    User,
    CheckCircle2,
    TrendingUp,
    BarChart3,
    TableProperties,
    Layers,
    Loader2
} from 'lucide-react';
import {
    formatCurrency,
    formatPercent,
    formatRatio,
    formatDateTime,
    formatFinancialDate
} from '../../utils/formatters';
import { Tooltip, InfoTooltip } from '../ui/Tooltip';

export const ExecutivePdfReport = ({
    company,
    currentUser,
    config,
    metrics,
    trends,
    breakdown,
    reportHash,
    generatedAt,
    loading = false,
}) => {
    const currency = config.currency || 'PLN';

    // Helper for safe number retrieval
    const num = (val) => {
        if (typeof val === 'number' && !isNaN(val)) return val;
        if (typeof val === 'string' && val.trim() !== '') {
            const parsed = parseFloat(val);
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    };

    // Support both API response structure (metrics.pnl.*, metrics.ratios.*) AND flat structure (for mocks/tests)
    const pnl = metrics?.pnl || {};
    const ratios = metrics?.ratios || metrics?.liquidity || {};
    const balanceSheet = metrics?.balance_sheet || {};

    const revenue = num(pnl?.revenue?.amount ?? metrics?.revenue);
    const cogs = num(pnl?.cogs?.amount ?? metrics?.cogs);
    const grossProfit = num(pnl?.gross_profit?.amount ?? metrics?.gross_profit);
    const grossMargin = pnl?.gross_margin_pct !== undefined
        ? num(pnl.gross_margin_pct)
        : (metrics?.gross_margin !== undefined ? num(metrics.gross_margin) : (revenue > 0 ? (grossProfit / revenue) * 100 : 0));

    const opex = num(pnl?.opex?.amount ?? metrics?.opex);
    const ebitda = num(pnl?.ebitda?.amount ?? metrics?.ebitda);
    const ebitdaMargin = pnl?.ebitda_margin_pct !== undefined
        ? num(pnl.ebitda_margin_pct)
        : (metrics?.ebitda_margin !== undefined ? num(metrics.ebitda_margin) : (revenue > 0 ? (ebitda / revenue) * 100 : 0));

    const depreciation = num(pnl?.depreciation?.amount ?? metrics?.depreciation);
    const ebit = num(pnl?.ebit?.amount ?? metrics?.ebit);
    const financialCosts = num(pnl?.financial_costs?.amount ?? metrics?.financial_costs);
    const tax = num(pnl?.tax?.amount ?? metrics?.tax);
    const taxesFinance = (financialCosts + tax > 0)
        ? (financialCosts + tax)
        : num(metrics?.taxes_and_finance);

    const netProfit = num(pnl?.net_profit?.amount ?? metrics?.net_profit);
    const netMargin = pnl?.net_margin_pct !== undefined
        ? num(pnl.net_margin_pct)
        : (metrics?.net_margin !== undefined ? num(metrics.net_margin) : (revenue > 0 ? (netProfit / revenue) * 100 : 0));

    const currentRatio = num(ratios?.current_ratio ?? metrics?.current_ratio);
    const quickRatio = num(ratios?.quick_ratio ?? metrics?.quick_ratio);
    const currentAssets = num(balanceSheet?.current_assets?.amount);
    const currentLiabilities = num(balanceSheet?.current_liabilities?.amount);
    const netWorkingCapital = currentAssets - currentLiabilities;
    const cashRatio = num(ratios?.cash_ratio ?? metrics?.cash_ratio);

    // Period label
    const periodLabel = metrics?.period?.label
        || (config.startDate ? `${config.startDate} do ${config.endDate || 'teraz'}` : '2025-01-01 do 2026-09-30 (Pełna historia)');

    return (
        <div
            id="executive-pdf-report"
            className="bg-zinc-950 border border-zinc-800 rounded-lg p-6 sm:p-8 font-mono text-zinc-200 shadow-xl space-y-6 print:bg-white print:text-black print:border-none print:p-0 print:shadow-none print:space-y-4 relative"
        >
            {loading && (
                <div className="absolute inset-0 bg-zinc-950/70 backdrop-blur-[2px] rounded-lg z-20 flex items-center justify-center print:hidden">
                    <div className="flex items-center gap-2.5 px-4 py-2 rounded bg-zinc-900 border border-zinc-750 text-zinc-100 text-xs shadow-lg">
                        <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                        <span>Przeliczanie metryk finansowych...</span>
                    </div>
                </div>
            )}

            {/* Header: Institutional Due Diligence Memorandum */}
            <div className="border-b-2 border-zinc-700 pb-4 print:border-black">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Tooltip content="Instytucjonalny szablon memorandum Due Diligence Helvest Advisory">
                                <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[10px] font-bold uppercase print:bg-zinc-200 print:text-black cursor-help" tabIndex={0}>
                                    HELVEST ADVISORY // DEAL MEMO
                                </span>
                            </Tooltip>
                            <span className="text-[10px] text-zinc-400 print:text-zinc-600">
                                M&A CORPORATE FINANCE PRACTICE
                            </span>
                        </div>
                        <h1 className="text-base sm:text-lg font-black uppercase tracking-wider text-zinc-100 print:text-black">
                            Raport Zarządczy Due Diligence & Analiza Finansowa
                        </h1>
                        <p className="text-xs text-zinc-400 print:text-zinc-700 mt-0.5">
                            Podsumowanie Rachunku Zysków i Strat (P&L), Wskaźników Płynności oraz Opex
                        </p>
                    </div>

                    <div className="text-left sm:text-right text-xs shrink-0 print:text-black">
                        <Tooltip content="Klauzula poufności memorandum transakcyjnego">
                            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-900 border border-zinc-750 text-amber-400 text-[11px] font-bold print:bg-transparent print:border-zinc-400 print:text-black cursor-help" tabIndex={0}>
                                <Lock className="w-3 h-3 text-amber-500 print:text-black" />
                                <span>{config.confidentiality}</span>
                            </div>
                        </Tooltip>
                        <Tooltip content="Unikalny identyfikator audytowy generowanego memorandum">
                            <div className="text-[10px] text-zinc-500 print:text-zinc-600 mt-1 cursor-help" tabIndex={0}>
                                IDENTYFIKATOR: <strong className="text-zinc-300 print:text-black">{company?.code || 'ACME'}-DD-{(generatedAt || '').replace(/\D/g, '').substring(0, 12)}</strong>
                            </div>
                        </Tooltip>
                    </div>
                </div>

                {/* Company & Analysis Meta Grid */}
                <div className="mt-4 pt-3 border-t border-zinc-850 print:border-zinc-300 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                        <div className="text-[10px] uppercase text-zinc-500 print:text-zinc-600 font-semibold flex items-center gap-1">
                            Podmiot Analizowany
                            <InfoTooltip
                                size="xs"
                                className="print:hidden"
                                ariaLabel="Więcej informacji o podmiocie analizowanym"
                                title="Podmiot Analizowany"
                                content="Dane rejestrowe badanej spółki w procesie Due Diligence."
                            />
                        </div>
                        <div className="font-bold text-zinc-100 print:text-black truncate">{company?.name || 'Spółka'}</div>
                        <div className="text-[10px] text-zinc-400 print:text-zinc-600">NIP: {company?.tax_id || company?.nip || '525-000-00-00'}</div>
                    </div>

                    <div>
                        <div className="text-[10px] uppercase text-zinc-500 print:text-zinc-600 font-semibold flex items-center gap-1">
                            Horyzont Analityczny
                            <InfoTooltip
                                size="xs"
                                className="print:hidden"
                                ariaLabel="Więcej informacji o horyzoncie analitycznym"
                                title="Horyzont Analityczny"
                                content="Wybrany okres sprawozdawczy objęty agregacją wyników."
                            />
                        </div>
                        <div className="font-bold text-zinc-100 print:text-black">
                            {config.periodPreset === 'all'
                                ? 'Pełna Dostępna Historia'
                                : config.periodPreset === 'ltm'
                                ? 'LTM (Ostatnie 12M)'
                                : config.periodPreset.toUpperCase()}
                        </div>
                        <div className="text-[10px] text-zinc-400 print:text-zinc-600 truncate" title={periodLabel}>
                            {periodLabel}
                        </div>
                    </div>

                    <div>
                        <div className="text-[10px] uppercase text-zinc-500 print:text-zinc-600 font-semibold flex items-center gap-1">
                            Waluta Prezentacji
                            <InfoTooltip
                                size="xs"
                                className="print:hidden"
                                ariaLabel="Więcej informacji o walucie prezentacji raportu"
                                title="Waluta Prezentacji"
                                content="Waluta sprawozdawcza z przeliczeniem pozycji według tabeli kursów transakcyjnych FX."
                            />
                        </div>
                        <div className="font-bold text-zinc-100 print:text-black">{currency}</div>
                        <div className="text-[10px] text-zinc-400 print:text-zinc-600">
                            {currency === 'PLN' ? 'Księga źródłowa (PLN)' : `Przeliczone wg kursu`}
                        </div>
                    </div>

                    <div>
                        <div className="text-[10px] uppercase text-zinc-500 print:text-zinc-600 font-semibold flex items-center gap-1">
                            Sporządził / Data
                            <InfoTooltip
                                size="xs"
                                className="print:hidden"
                                ariaLabel="Więcej informacji o autorze i dacie sporządzenia"
                                title="Autor i Data Sporządzenia"
                                content="Osoba sporządzająca raport oraz dokładny znacznik czasu wygenerowania zestawienia."
                            />
                        </div>
                        <div className="font-bold text-zinc-100 print:text-black truncate">{currentUser?.name || 'Analityk Finansowy'}</div>
                        <div className="text-[10px] text-zinc-400 print:text-zinc-600">{formatDateTime(generatedAt)}</div>
                    </div>
                </div>
            </div>

            {/* SECTION 1: Executive KPI Scorecard */}
            {config.sections.kpi && (
                <div className="space-y-2.5 print-avoid-break">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-300 print:text-black">
                        <TrendingUp className="w-3.5 h-3.5 text-zinc-400 print:text-black" />
                        <span>1. Kluczowe Metryki Wynikowe i Wskaźniki Transakcyjne (KPI Scorecard)</span>
                        <InfoTooltip
                            size="xs"
                            className="print:hidden"
                            ariaLabel="Więcej informacji o metrykach KPI"
                            title="Metryki KPI"
                            content="Zestawienie najważniejszych wskaźników operacyjnych, bazy przychodowej i rentowności badanej spółki."
                        />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <Tooltip content="Łączne przychody operacyjne netto ze sprzedaży produktów, towarów i usług">
                            <div className="bg-zinc-900 border border-zinc-800 rounded p-3 print:bg-zinc-50 print:border-zinc-300 cursor-help" tabIndex={0}>
                                <span className="text-[10px] uppercase text-zinc-400 print:text-zinc-600 font-semibold">Przychody ze Sprzedaży</span>
                                <div className="text-base font-bold text-zinc-100 print:text-black tabular-nums mt-0.5">
                                    {formatCurrency(revenue, currency)}
                                </div>
                                <div className="text-[10px] text-zinc-500 print:text-zinc-600 mt-0.5">Baza operacyjna</div>
                            </div>
                        </Tooltip>

                        <Tooltip content="Zysk brutto ze sprzedaży (Przychody - Koszt własny COGS) oraz marża brutto">
                            <div className="bg-zinc-900 border border-zinc-800 rounded p-3 print:bg-zinc-50 print:border-zinc-300 cursor-help" tabIndex={0}>
                                <span className="text-[10px] uppercase text-zinc-400 print:text-zinc-600 font-semibold">Zysk Brutto (Marża)</span>
                                <div className="text-base font-bold text-zinc-100 print:text-black tabular-nums mt-0.5">
                                    {formatCurrency(grossProfit, currency)}
                                </div>
                                <div className="text-[10px] text-emerald-400 print:text-black font-bold mt-0.5">
                                    Marża: {formatPercent(grossMargin, 1, false)}
                                </div>
                            </div>
                        </Tooltip>

                        <Tooltip content="Zysk operacyjny przed odpisami amortyzacyjnymi (EBIT + D&A) – kluczowa baza wyceny mnożnikowej EV/EBITDA">
                            <div className="bg-zinc-900 border border-zinc-800 rounded p-3 print:bg-zinc-50 print:border-zinc-300 cursor-help" tabIndex={0}>
                                <span className="text-[10px] uppercase text-zinc-400 print:text-zinc-600 font-semibold">Wynik EBITDA (Marża)</span>
                                <div className="text-base font-bold text-zinc-100 print:text-black tabular-nums mt-0.5">
                                    {formatCurrency(ebitda, currency)}
                                </div>
                                <div className="text-[10px] text-emerald-400 print:text-black font-bold mt-0.5">
                                    Rentowność: {formatPercent(ebitdaMargin, 1, false)}
                                </div>
                            </div>
                        </Tooltip>

                        <Tooltip content="Końcowy wynik finansowy netto po potrąceniu kosztów finansowych i podatku dochodowego CIT">
                            <div className="bg-zinc-900 border border-zinc-800 rounded p-3 print:bg-zinc-50 print:border-zinc-300 cursor-help" tabIndex={0}>
                                <span className="text-[10px] uppercase text-zinc-400 print:text-zinc-600 font-semibold">Zysk Netto Okresu</span>
                                <div className="text-base font-bold text-zinc-100 print:text-black tabular-nums mt-0.5">
                                    {formatCurrency(netProfit, currency)}
                                </div>
                                <div className="text-[10px] text-emerald-400 print:text-black font-bold mt-0.5">
                                    Marża netto: {formatPercent(netMargin, 1, false)}
                                </div>
                            </div>
                        </Tooltip>
                    </div>
                </div>
            )}

            {/* SECTION 2: Rachunek Zysków i Strat (P&L Financial Statement) */}
            {config.sections.pnl && (
                <div className="space-y-2.5 print-avoid-break">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-300 print:text-black">
                        <TableProperties className="w-3.5 h-3.5 text-zinc-400 print:text-black" />
                        <span>2. Rachunek Zysków i Strat (P&L Financial Statement)</span>
                        <InfoTooltip
                            size="xs"
                            className="print:hidden"
                            ariaLabel="Więcej informacji o rachunku zysków i strat"
                            title="Rachunek Zysków i Strat"
                            content="Zestawienie rachunku wyników według standardu sprawozdawczości Deal Advisory."
                        />
                    </div>

                    <div className="border border-zinc-800 rounded overflow-hidden print:border-zinc-400">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-zinc-900 border-b border-zinc-800 text-[10px] text-zinc-400 uppercase tracking-wider print:bg-zinc-100 print:text-black print:border-zinc-400">
                                    <th className="py-2 px-3 font-semibold">
                                        <Tooltip content="Standardowa hierarchia pozycji rachunku wyników od przychodów po zysk netto">
                                            <span className="cursor-help" tabIndex={0}>Pozycja Rachunku Wyników</span>
                                        </Tooltip>
                                    </th>
                                    <th className="py-2 px-3 font-semibold w-28 text-center">
                                        <Tooltip content="Domenowy kod klasyfikacji analitycznej pozycji P&L">
                                            <span className="cursor-help" tabIndex={0}>Klasyfikacja</span>
                                        </Tooltip>
                                    </th>
                                    <th className="py-2 px-3 font-semibold w-40 text-right">
                                        <Tooltip content={`Wartość pozycji finansowej wyrażona w walucie ${currency}`}>
                                            <span className="cursor-help" tabIndex={0}>Kwota ({currency})</span>
                                        </Tooltip>
                                    </th>
                                    <th className="py-2 px-3 font-semibold w-24 text-right">
                                        <Tooltip content="Procentowy udział pozycji w relacji do łącznych przychodów operacyjnych">
                                            <span className="cursor-help" tabIndex={0}>Udział w %</span>
                                        </Tooltip>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-850 print:divide-zinc-300">
                                <tr className="hover:bg-zinc-900/40">
                                    <td className="py-2 px-3 font-medium text-zinc-200 print:text-black">Przychody ze sprzedaży produktów i usług (Revenue)</td>
                                    <td className="py-2 px-3 text-center text-[10px] text-zinc-400 print:text-black font-semibold">
                                        <Tooltip content="Przychody operacyjne ze sprzedaży podstawowej">
                                            <span className="cursor-help" tabIndex={0}>REVENUE</span>
                                        </Tooltip>
                                    </td>
                                    <td className="py-2 px-3 text-right font-bold text-zinc-100 print:text-black tabular-nums">
                                        {formatCurrency(revenue, currency)}
                                    </td>
                                    <td className="py-2 px-3 text-right text-zinc-400 print:text-black tabular-nums">100.0%</td>
                                </tr>
                                <tr className="hover:bg-zinc-900/40 text-zinc-400 print:text-zinc-700">
                                    <td className="py-2 px-3">(-) Koszt własny sprzedaży (COGS / Direct Costs)</td>
                                    <td className="py-2 px-3 text-center text-[10px] text-zinc-500 print:text-black">
                                        <Tooltip content="Koszt wytworzenia sprzedanych produktów i towarów (Cost of Goods Sold)">
                                            <span className="cursor-help" tabIndex={0}>COGS</span>
                                        </Tooltip>
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums text-rose-400 print:text-black">
                                        -{formatCurrency(cogs, currency)}
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums">
                                        {revenue > 0 ? (cogs / revenue * 100).toFixed(1) : '0.0'}%
                                    </td>
                                </tr>
                                <tr className="bg-zinc-900/60 font-bold text-zinc-100 print:bg-zinc-50 print:text-black">
                                    <td className="py-2 px-3">(=) ZYSK BRUTTO ZE SPRZEDAŻY (GROSS PROFIT)</td>
                                    <td className="py-2 px-3 text-center text-[10px] text-emerald-400 print:text-black">
                                        <Tooltip content="Marża zysku brutto ze sprzedaży (Gross Profit / Revenue)">
                                            <span className="cursor-help" tabIndex={0}>GROSS MARGIN</span>
                                        </Tooltip>
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums">
                                        {formatCurrency(grossProfit, currency)}
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums text-emerald-400 print:text-black">
                                        {formatPercent(grossMargin, 1, false)}
                                    </td>
                                </tr>
                                <tr className="hover:bg-zinc-900/40 text-zinc-400 print:text-zinc-700">
                                    <td className="py-2 px-3">(-) Koszty operacyjne zarządu i sprzedaży (OPEX)</td>
                                    <td className="py-2 px-3 text-center text-[10px] text-zinc-500 print:text-black">
                                        <Tooltip content="Koszty operacyjne sprzedaży i ogólnego zarządu (Operating Expenses)">
                                            <span className="cursor-help" tabIndex={0}>OPEX</span>
                                        </Tooltip>
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums text-rose-400 print:text-black">
                                        -{formatCurrency(opex, currency)}
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums">
                                        {revenue > 0 ? (opex / revenue * 100).toFixed(1) : '0.0'}%
                                    </td>
                                </tr>
                                <tr className="bg-zinc-900 font-black text-zinc-100 print:bg-zinc-100 print:text-black">
                                    <td className="py-2 px-3">(=) ZYSK OPERACYJNY PRZED AMORTYZACJĄ (EBITDA)</td>
                                    <td className="py-2 px-3 text-center text-[10px] text-emerald-400 print:text-black">
                                        <Tooltip content="Marża operacyjna gotówkowa przed odpisami amortyzacyjnymi">
                                            <span className="cursor-help" tabIndex={0}>EBITDA MARGIN</span>
                                        </Tooltip>
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums">
                                        {formatCurrency(ebitda, currency)}
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums text-emerald-400 print:text-black">
                                        {formatPercent(ebitdaMargin, 1, false)}
                                    </td>
                                </tr>
                                <tr className="hover:bg-zinc-900/40 text-zinc-400 print:text-zinc-700">
                                    <td className="py-2 px-3">(-) Odpisy amortyzacyjne (D&A)</td>
                                    <td className="py-2 px-3 text-center text-[10px] text-zinc-500 print:text-black">
                                        <Tooltip content="Odpisy amortyzacyjne środków trwałych i WNiP (Depreciation & Amortization)">
                                            <span className="cursor-help" tabIndex={0}>D&A</span>
                                        </Tooltip>
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums text-zinc-400 print:text-black">
                                        -{formatCurrency(depreciation, currency)}
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums">
                                        {revenue > 0 ? (depreciation / revenue * 100).toFixed(1) : '0.0'}%
                                    </td>
                                </tr>
                                <tr className="bg-zinc-900/40 font-semibold text-zinc-200 print:bg-zinc-50 print:text-black">
                                    <td className="py-2 px-3">(=) ZYSK OPERACYJNY (EBIT)</td>
                                    <td className="py-2 px-3 text-center text-[10px] text-zinc-300 print:text-black">
                                        <Tooltip content="Zysk operacyjny po potrąceniu kosztów własnych, OPEX i amortyzacji">
                                            <span className="cursor-help" tabIndex={0}>EBIT</span>
                                        </Tooltip>
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums">
                                        {formatCurrency(ebitda > 0 ? ebit : 0, currency)}
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums">
                                        {revenue > 0 ? (ebit / revenue * 100).toFixed(1) : '0.0'}%
                                    </td>
                                </tr>
                                <tr className="hover:bg-zinc-900/40 text-zinc-400 print:text-zinc-700">
                                    <td className="py-2 px-3">(-) Podatki dochodowe & koszty finansowe</td>
                                    <td className="py-2 px-3 text-center text-[10px] text-zinc-500 print:text-black">
                                        <Tooltip content="Suma kosztów obsługi długu finansowego oraz podatku dochodowego CIT">
                                            <span className="cursor-help" tabIndex={0}>TAX / FIN</span>
                                        </Tooltip>
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums text-zinc-400 print:text-black">
                                        -{formatCurrency(taxesFinance, currency)}
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums">
                                        {revenue > 0 ? (taxesFinance / revenue * 100).toFixed(1) : '0.0'}%
                                    </td>
                                </tr>
                                <tr className="bg-zinc-950 border-t-2 border-zinc-700 font-black text-zinc-100 print:bg-zinc-100 print:border-black print:text-black">
                                    <td className="py-2 px-3">(=) WYNIK FINANSOWY NETTO (NET PROFIT)</td>
                                    <td className="py-2 px-3 text-center text-[10px] text-emerald-400 print:text-black">
                                        <Tooltip content="Końcowa rentowność netto po wszystkich obciążeniach podatkowych i finansowych">
                                            <span className="cursor-help" tabIndex={0}>NET MARGIN</span>
                                        </Tooltip>
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums">
                                        {formatCurrency(netProfit, currency)}
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums text-emerald-400 print:text-black">
                                        {formatPercent(netMargin, 1, false)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* SECTION 3: Wskaźniki Płynności i Wypłacalności */}
            {config.sections.liquidity && (
                <div className="space-y-2.5 print-avoid-break">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-300 print:text-black">
                        <BarChart3 className="w-3.5 h-3.5 text-zinc-400 print:text-black" />
                        <span>3. Wskaźniki Płynności Finansowej i Wypłacalności (Solvency & Working Capital)</span>
                        <InfoTooltip
                            size="xs"
                            className="print:hidden"
                            ariaLabel="Więcej informacji o płynności finansowej"
                            title="Płynność Finansowa"
                            content="Ocena zdolności spółki do terminowego regulowania zobowiązań krótkoterminowych oraz stabilności kapitału obrotowego."
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <Tooltip content="Current Ratio = Aktywa Obrotowe / Zobowiązania Krótkoterminowe. Norma bankowa LMA: 1.50x – 2.00x">
                            <div className="bg-zinc-900 border border-zinc-800 rounded p-3 print:bg-zinc-50 print:border-zinc-300 cursor-help" tabIndex={0}>
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold text-zinc-200 print:text-black">Current Ratio (Bieżąca)</span>
                                    <span className="font-bold text-zinc-100 print:text-black tabular-nums">
                                        {formatRatio(currentRatio)}
                                    </span>
                                </div>
                                <div className="text-[10px] text-zinc-400 print:text-zinc-600 mt-1">
                                    Benchmark optymalny: <strong>1.50x – 2.00x</strong>
                                </div>
                                <div className="text-[10px] text-emerald-400 print:text-black font-semibold mt-0.5">
                                    {currentRatio >= 1.5 ? 'Płynność zabezpieczona' : 'Wymaga monitoringu'}
                                </div>
                            </div>
                        </Tooltip>

                        <Tooltip content="Quick Ratio = (Aktywa Obrotowe - Zapasy) / Zobowiązania Krótkoterminowe. Norma bankowa LMA: 1.00x – 1.20x">
                            <div className="bg-zinc-900 border border-zinc-800 rounded p-3 print:bg-zinc-50 print:border-zinc-300 cursor-help" tabIndex={0}>
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold text-zinc-200 print:text-black">Quick Ratio (Szybka)</span>
                                    <span className="font-bold text-zinc-100 print:text-black tabular-nums">
                                        {formatRatio(quickRatio)}
                                    </span>
                                </div>
                                <div className="text-[10px] text-zinc-400 print:text-zinc-600 mt-1">
                                    Benchmark optymalny: <strong>1.00x – 1.20x</strong>
                                </div>
                                <div className="text-[10px] text-emerald-400 print:text-black font-semibold mt-0.5">
                                    {quickRatio >= 1.0 ? 'Optymalna relacja płynna' : 'Niewielka luka płynnościowa'}
                                </div>
                            </div>
                        </Tooltip>

                        <Tooltip content={cashRatio > 0 ? "Cash Ratio = Gotówka i ekwiwalenty / Zobowiązania krótkoterminowe. Norma: > 0.20x" : "Kapitał Obrotowy Netto (NWC) = Aktywa Obrotowe - Zobowiązania Krótkoterminowe"}>
                            <div className="bg-zinc-900 border border-zinc-800 rounded p-3 print:bg-zinc-50 print:border-zinc-300 cursor-help" tabIndex={0}>
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold text-zinc-200 print:text-black">
                                        {cashRatio > 0 ? 'Cash Ratio (Gotówkowa)' : 'Kapitał Obrotowy (NWC)'}
                                    </span>
                                    <span className="font-bold text-zinc-100 print:text-black tabular-nums">
                                        {cashRatio > 0 ? formatRatio(cashRatio) : formatCurrency(netWorkingCapital, currency)}
                                    </span>
                                </div>
                                <div className="text-[10px] text-zinc-400 print:text-zinc-600 mt-1">
                                    {cashRatio > 0 ? (
                                        <>Benchmark optymalny: <strong>&gt; 0.20x</strong></>
                                    ) : (
                                        <>Aktywa obrotowe - zobowiązania bieżące</>
                                    )}
                                </div>
                                <div className="text-[10px] text-emerald-400 print:text-black font-semibold mt-0.5">
                                    {cashRatio > 0 ? (
                                        cashRatio >= 0.2 ? 'Optymalna rezerwa gotówkowa' : 'Niska poduszka płynna'
                                    ) : (
                                        netWorkingCapital >= 0 ? 'Dodatni kapitał obrotowy' : 'Ujemny kapitał obrotowy'
                                    )}
                                </div>
                            </div>
                        </Tooltip>
                    </div>
                </div>
            )}

            {/* SECTION 4: Struktura Kosztowa OPEX */}
            {config.sections.opex && breakdown && breakdown.length > 0 && (
                <div className="space-y-2.5 print-avoid-break">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-300 print:text-black">
                        <Layers className="w-3.5 h-3.5 text-zinc-400 print:text-black" />
                        <span>4. Struktura Kosztów Operacyjnych wg Kategorii (OPEX Breakdown)</span>
                        <InfoTooltip
                            size="xs"
                            className="print:hidden"
                            ariaLabel="Więcej informacji o strukturze kosztów OPEX"
                            title="Dekompozycja OPEX"
                            content="Rozbicie kosztów operacyjnych na kategorie rodzajowe wraz z udziałem procentowym."
                        />
                    </div>

                    <div className="border border-zinc-800 rounded overflow-hidden print:border-zinc-400">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-zinc-900 border-b border-zinc-800 text-[10px] text-zinc-400 uppercase tracking-wider print:bg-zinc-100 print:text-black print:border-zinc-400">
                                    <th className="py-2 px-3 font-semibold">
                                        <Tooltip content="Rodzajowa kategoria kosztu operacyjnego według planu kont">
                                            <span className="cursor-help" tabIndex={0}>Kategoria Analityczna Kosztu</span>
                                        </Tooltip>
                                    </th>
                                    <th className="py-2 px-3 font-semibold w-40 text-right">
                                        <Tooltip content={`Wartość kosztu w wybranej walucie ${currency}`}>
                                            <span className="cursor-help" tabIndex={0}>Kwota ({currency})</span>
                                        </Tooltip>
                                    </th>
                                    <th className="py-2 px-3 font-semibold w-28 text-right">
                                        <Tooltip content="Udział procentowy kategorii w łącznej sumie kosztów OPEX">
                                            <span className="cursor-help" tabIndex={0}>Udział w OPEX</span>
                                        </Tooltip>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-850 print:divide-zinc-300">
                                {breakdown.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-zinc-900/40">
                                        <td className="py-1.5 px-3 text-zinc-300 print:text-black">
                                            {item.category_name || item.name}
                                        </td>
                                        <td className="py-1.5 px-3 text-right font-mono text-zinc-200 print:text-black tabular-nums">
                                            {formatCurrency(item.amount, currency)}
                                        </td>
                                        <td className="py-1.5 px-3 text-right font-mono text-zinc-400 print:text-black tabular-nums">
                                            {Number(item.percentage || 0).toFixed(1)}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* SECTION 5: Komentarz Doradcy M&A */}
            {config.commentary && (
                <div className="space-y-1.5 print-avoid-break">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 print:text-black flex items-center gap-1.5">
                        <span>5. Opinia i Rekomendacja Doradcy Transakcyjnego (Advisory Assessment)</span>
                        <InfoTooltip
                            size="xs"
                            className="print:hidden"
                            ariaLabel="Więcej informacji o opinii doradcy transakcyjnego"
                            title="Opinia Doradcy"
                            content="Kluczowe wnioski i rekomendacje doradcy transakcyjnego dla komitetu inwestycyjnego lub zarządu."
                        />
                    </div>
                    <div className="bg-zinc-900/80 border border-zinc-800 rounded p-3 text-xs leading-relaxed text-zinc-200 print:bg-zinc-50 print:text-black print:border-zinc-400">
                        {config.commentary}
                    </div>
                </div>
            )}

            {/* SECTION 6: Certyfikat Integralności i Podpisy */}
            {config.sections.audit && (
                <div className="border-t border-zinc-800 pt-4 print:border-zinc-400 print-avoid-break space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[10px] text-zinc-400 print:text-black">
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-bold text-zinc-300 print:text-black">
                                <FileCheck className="w-3.5 h-3.5 text-emerald-400 print:text-black" />
                                <span>CERTYFIKAT INTEGRALNOŚCI DANYCH // RAPORT ZAAKCEPTOWANY AUDYTOWO</span>
                                <InfoTooltip
                                    size="xs"
                                    className="print:hidden"
                                    ariaLabel="Więcej informacji o certyfikacie integralności"
                                    title="Certyfikat Integralności"
                                    content="Kryptograficzny dowód niezmienności danych raportu zarejestrowany w niezmiennym rejestrze WORM."
                                />
                            </div>
                            <div className="flex items-center gap-1.5 font-mono">
                                <Hash className="w-3 h-3 text-zinc-500 print:text-black" />
                                <span>KRYPTOGRAFICZNY SKRÓT SHA-256: </span>
                                <Tooltip content="Kryptograficzny skrót SHA-256 wyliczony z kanonicznych parametrów i metryk memorandum">
                                    <strong className="text-zinc-200 print:text-black truncate max-w-sm cursor-help" title={reportHash} tabIndex={0}>
                                        {reportHash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
                                    </strong>
                                </Tooltip>
                            </div>
                            <div className="text-[9px] text-zinc-500 print:text-zinc-600">
                                Wygenerowano w systemie FinBoard Deal Advisory Enterprise dla podmiotu {company?.name}.
                            </div>
                        </div>

                        <div className="text-right text-[9px] text-zinc-500 print:text-zinc-600 font-mono">
                            <div>TIMESTAMP: {generatedAt}</div>
                            <Tooltip content="Dziennik audytowy gwarantuje niezmienność wpisu w modelu Write-Once-Read-Many (WORM)">
                                <div className="cursor-help" tabIndex={0}>STATUS: IMMUTABLE AUDIT RECORD</div>
                            </Tooltip>
                        </div>
                    </div>

                    {/* Signature lines for printable paper document */}
                    <Tooltip content="Strefa oficjalnych podpisów autoryzacyjnych pod memorandum transakcyjnym">
                        <div className="pt-8 grid grid-cols-2 gap-8 text-xs print:pt-12 cursor-help" tabIndex={0}>
                            <div className="border-t border-zinc-700 print:border-black pt-1 text-center">
                                <div className="font-bold text-zinc-300 print:text-black">
                                    {currentUser?.name || 'Partner Zarządzający M&A'}
                                </div>
                                <div className="text-[10px] text-zinc-500 print:text-zinc-600">
                                    Helvest Advisory / Lead Advisor
                                </div>
                            </div>

                            <div className="border-t border-zinc-700 print:border-black pt-1 text-center">
                                <div className="font-bold text-zinc-300 print:text-black">
                                    Przedstawiciel Zarządu / Dyrektor Finansowy (CFO)
                                </div>
                                <div className="text-[10px] text-zinc-500 print:text-zinc-600">
                                    {company?.name || 'Podmiot Badany'}
                                </div>
                            </div>
                        </div>
                    </Tooltip>
                </div>
            )}
        </div>
    );
};
