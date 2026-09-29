import React from 'react';
import {
    Printer,
    Download,
    RefreshCw,
    Sliders,
    Calendar,
    Coins,
    Shield,
    FileText,
    CheckSquare,
    Square
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Tooltip, InfoTooltip } from '../ui/Tooltip';
import { useOptionalDeal, CURRENCIES } from '../../context/DealContext';

export const CONFIDENTIALITY_LEVELS = [
    { id: 'STRICTLY CONFIDENTIAL', label: 'ŚCIŚLE POUFNE (M&A / DUE DILIGENCE)' },
    { id: 'BOARD ONLY', label: 'ZASTRZEŻONE DLA ZARZĄDU (BOARD ONLY)' },
    { id: 'INVESTOR MEMO', label: 'MEMORANDUM INWESTORSKIE (INFO MEMO)' },
];

export const PERIOD_PRESETS = [
    { id: 'all', label: 'Pełna Dostępna Historia' },
    { id: 'ltm', label: 'Ostatnie 12 Miesięcy (LTM)' },
    { id: '2026', label: 'Rok Obrotowy FY 2026' },
    { id: '2025', label: 'Rok Obrotowy FY 2025' },
    { id: 'custom', label: 'Niestandardowy Zakres Dat' },
];

const COMMENTARY_PRESETS = [
    {
        label: 'Stabilny wzrost EBITDA i marż',
        text: 'W analizowanym okresie spółka wykazuje dynamiczny wzrost marży EBITDA oraz stabilną strukturę przychodów operacyjnych. Wskaźniki płynności finansowej (Quick Ratio > 1.2x) pozostają powyżej benchmarków rynkowych, co potwierdza wysoką dyscyplinę kapitałową podmiotu.'
    },
    {
        label: 'Wymagana kontrola kosztów OPEX',
        text: 'Zauważalna jest presja na marżę brutto spowodowana wzrostem kosztów usług obcych i wynagrodzeń w strukturze OPEX. Rekomenduje się przeprowadzenie audytu rentowności jednostkowej oraz renegocjację kluczowych kontraktów przed sfinalizowaniem transakcji.'
    },
    {
        label: 'Wysoka płynność i gotowość do M&A',
        text: 'Wskaźniki płynności bieżącej i szybkiej wskazują na nadwyżkę kapitału obrotowego netto. Podmiot jest w pełni przygotowany do dalszej ekspansji lub integracji kapitałowej w ramach grupy inwestycyjnej.'
    },
];

const SECTION_DESCRIPTIONS = {
    kpi: 'Kluczowe wskaźniki przychodowe, marże operacyjne i rentowność netto (KPI Scorecard)',
    pnl: 'Zestawienie rachunku wyników od przychodów po wynik netto w standardzie PSR/MSR',
    liquidity: 'Wskaźniki płynności bieżącej (CR), szybkiej (QR) oraz kapitał obrotowy netto (NWC)',
    opex: 'Dekompozycja kosztów rodzajowych i udział poszczególnych pozycji w strukturze OPEX',
    audit: 'Kryptograficzny skrót SHA-256, znacznik czasu WORM oraz strefa podpisów doradcy i CFO',
};

export const ReportConfigurator = ({
    config,
    onChange,
    onPrint,
    onExportJson,
    onRefresh,
    loading = false,
    currencies: propCurrencies,
}) => {
    const deal = useOptionalDeal();
    const currencies = propCurrencies || deal?.currencies || CURRENCIES;

    const handlePresetPeriod = (presetId) => {
        let start = '';
        let end = '';

        if (presetId === 'ltm') {
            start = '2025-10-01';
            end = '2026-09-30';
        } else if (presetId === '2026') {
            start = '2026-01-01';
            end = '2026-12-31';
        } else if (presetId === '2025') {
            start = '2025-01-01';
            end = '2025-12-31';
        } else if (presetId === 'custom') {
            start = config.startDate || '2026-01-01';
            end = config.endDate || '2026-09-30';
        }

        onChange({
            ...config,
            periodPreset: presetId,
            startDate: start,
            endDate: end,
        });
    };

    const toggleSection = (sectionKey) => {
        onChange({
            ...config,
            sections: {
                ...config.sections,
                [sectionKey]: !config.sections[sectionKey],
            },
        });
    };

    return (
        <div data-testid="report-configurator" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 font-mono text-xs space-y-4 print:hidden shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-bold uppercase tracking-wider text-xs">
                    <Sliders className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                    <span>Konfigurator Parametrów Raportu Zarządczego (Executive Memo)</span>
                    <InfoTooltip
                        size="xs"
                        ariaLabel="Więcej informacji o konfiguratorze parametrów raportu"
                        title="Konfigurator Raportu M&A"
                        content="Dostosuj horyzont czasowy, walutę przeliczeniową, poziom klauzuli poufności oraz włączane sekcje analityczne przed wydrukiem lub eksportem raportu."
                    />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <Tooltip content="Pobierz aktualne dane analityczne z backendu i przelicz sumy kontrolne raportu">
                        <span className="inline-flex">
                            <Button
                                variant="secondary"
                                size="sm"
                                icon={RefreshCw}
                                loading={loading}
                                onClick={onRefresh}
                                title="Przelicz dane raportu"
                                aria-label="Przelicz dane raportu"
                            >
                                Przelicz
                            </Button>
                        </span>
                    </Tooltip>
                    <Tooltip content="Pobierz pełną strukturę danych analitycznych i metadanych raportu w formacie JSON">
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={Download}
                            onClick={onExportJson}
                            title="Eksportuj surowe dane JSON"
                            aria-label="Eksportuj surowe dane JSON"
                        >
                            Eksport JSON
                        </Button>
                    </Tooltip>
                    <Tooltip content="Uruchom podgląd wydruku przeglądarki z wektorowym formatowaniem A4 lub zapisz do pliku PDF">
                        <Button
                            variant="primary"
                            size="sm"
                            icon={Printer}
                            onClick={onPrint}
                            title="Drukuj lub zapisz jako wektorowy plik PDF"
                            aria-label="Drukuj lub zapisz jako wektorowy plik PDF"
                        >
                            Drukuj / Eksportuj PDF
                        </Button>
                    </Tooltip>
                </div>
            </div>

            {/* Config controls grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Period Selector */}
                <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-semibold text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-zinc-500" />
                        Horyzont Czasowy Raportu
                        <InfoTooltip
                            size="xs"
                            ariaLabel="Więcej informacji o horyzoncie czasowym"
                            title="Horyzont Czasowy"
                            content="Określa zakres danych finansowych uwzględnionych w sprawozdaniu (pełna historia, ostatnie 12 miesięcy LTM, konkretny rok obrotowy lub własny przedział dat)."
                        />
                    </label>
                    <Tooltip content="Wybierz predefiniowany horyzont czasowy lub własny zakres dat dla badania Due Diligence">
                        <select
                            value={config.periodPreset}
                            onChange={(e) => handlePresetPeriod(e.target.value)}
                            className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-750 rounded px-2.5 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 cursor-pointer"
                            aria-label="Wybierz horyzont czasowy raportu"
                        >
                            {PERIOD_PRESETS.map((p) => (
                                <option key={p.id} value={p.id} className="bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200">
                                    {p.label}
                                </option>
                            ))}
                        </select>
                    </Tooltip>

                    {config.periodPreset === 'custom' && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                            <div>
                                <span className="text-[9px] text-zinc-500 dark:text-zinc-400 block mb-0.5">OD:</span>
                                <Tooltip content="Początkowa data analizowanego okresu obrachunkowego (RRRR-MM-DD)">
                                    <input
                                        type="date"
                                        value={config.startDate}
                                        onChange={(e) => onChange({ ...config, startDate: e.target.value })}
                                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded px-2 py-1 text-[11px] text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                                        aria-label="Początkowa data analizowanego okresu"
                                    />
                                </Tooltip>
                            </div>
                            <div>
                                <span className="text-[9px] text-zinc-500 dark:text-zinc-400 block mb-0.5">DO:</span>
                                <Tooltip content="Końcowa data analizowanego okresu obrachunkowego (RRRR-MM-DD)">
                                    <input
                                        type="date"
                                        value={config.endDate}
                                        onChange={(e) => onChange({ ...config, endDate: e.target.value })}
                                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded px-2 py-1 text-[11px] text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                                        aria-label="Końcowa data analizowanego okresu"
                                    />
                                </Tooltip>
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. Currency & Confidentiality */}
                <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-semibold text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                        <Coins className="w-3 h-3 text-zinc-500" />
                        Waluta Prezentacji & Przeliczenia
                        <InfoTooltip
                            size="xs"
                            ariaLabel="Więcej informacji o walucie prezentacji"
                            title="Waluta Prezentacji"
                            content="Waluta wyjściowa prezentacji sprawozdania finansowego. Wszystkie pozycje zostaną przeliczone według aktualnych kursów FX Deal Advisory."
                        />
                    </label>
                    <Tooltip content="Wybierz walutę denominacji raportu (PLN, EUR, USD, GBP)">
                        <select
                            data-testid="report-currency-select"
                            value={config.currency}
                            onChange={(e) => onChange({ ...config, currency: e.target.value })}
                            className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-750 rounded px-2.5 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 cursor-pointer"
                            aria-label="Wybierz walutę prezentacji raportu"
                        >
                            {currencies.map((c) => (
                                <option key={c.code} value={c.code} className="bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200">
                                    {c.code} – {c.label}
                                </option>
                            ))}
                        </select>
                    </Tooltip>

                    <label className="block text-[10px] uppercase font-semibold text-zinc-600 dark:text-zinc-400 pt-1 flex items-center gap-1.5">
                        <Shield className="w-3 h-3 text-zinc-500" />
                        Klauzula Poufności (Header Watermark)
                        <InfoTooltip
                            size="xs"
                            ariaLabel="Więcej informacji o klauzuli poufności"
                            title="Klauzula Poufności"
                            content="Oficjalna klauzula poufności drukowana w nagłówku każdej strony memorandum transakcyjnego."
                        />
                    </label>
                    <Tooltip content="Wybierz poziom poufności dokumentu transakcyjnego">
                        <select
                            value={config.confidentiality}
                            onChange={(e) => onChange({ ...config, confidentiality: e.target.value })}
                            className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-750 rounded px-2.5 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 cursor-pointer"
                            aria-label="Wybierz klauzulę poufności raportu"
                        >
                            {CONFIDENTIALITY_LEVELS.map((level) => (
                                <option key={level.id} value={level.id} className="bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200">
                                    {level.label}
                                </option>
                            ))}
                        </select>
                    </Tooltip>
                </div>

                {/* 3. Sections Checkboxes */}
                <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-semibold text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                        <FileText className="w-3 h-3 text-zinc-500" />
                        Sekcje Do Uwzględnienia w Raporcie
                        <InfoTooltip
                            size="xs"
                            ariaLabel="Więcej informacji o zakresie sekcji"
                            title="Zakres Sekcji"
                            content="Zaznacz moduły i zestawienia finansowe, które mają zostać wygenerowane w finalnym dokumencie PDF."
                        />
                    </label>
                    <div className="space-y-1 pt-0.5">
                        {[
                            { id: 'kpi', label: 'Metryki KPI i Mnożniki Transakcyjne' },
                            { id: 'pnl', label: 'Rachunek Zysków i Strat (P&L Summary)' },
                            { id: 'liquidity', label: 'Wskaźniki Płynności i Wypłacalności' },
                            { id: 'opex', label: 'Struktura Kosztów Operacyjnych (OPEX)' },
                            { id: 'audit', label: 'Certyfikat Integralności i SHA-256' },
                        ].map((sec) => (
                            <Tooltip
                                key={sec.id}
                                content={`${config.sections[sec.id] ? 'Kliknij, aby wykluczyć' : 'Kliknij, aby dołączyć'}: ${SECTION_DESCRIPTIONS[sec.id] || sec.label}`}
                            >
                                <button
                                    type="button"
                                    onClick={() => toggleSection(sec.id)}
                                    className="flex items-center gap-2 text-[11px] text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer w-full text-left"
                                    aria-label={`Przełącz sekcję: ${sec.label}`}
                                >
                                    {config.sections[sec.id] ? (
                                        <CheckSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    ) : (
                                        <Square className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-600 shrink-0" />
                                    )}
                                    <span className={config.sections[sec.id] ? 'text-zinc-900 dark:text-zinc-200 font-medium' : 'text-zinc-500 dark:text-zinc-500'}>
                                        {sec.label}
                                    </span>
                                </button>
                            </Tooltip>
                        ))}
                    </div>
                </div>
            </div>

            {/* Commentary / Recommendation */}
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                    <label className="block text-[10px] uppercase font-semibold text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                        Komentarz Analityczny Doradcy M&A / CFO (Opcjonalny do wydruku)
                        <InfoTooltip
                            size="xs"
                            ariaLabel="Więcej informacji o komentarzu analitycznym"
                            title="Komentarz Analityczny"
                            content="Oficjalna opinia i rekomendacja doradcy transakcyjnego lub CFO dołączana do memorandum dla komitetu inwestycyjnego."
                        />
                    </label>
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                        <span>Wstaw szablon:</span>
                        {COMMENTARY_PRESETS.map((preset, idx) => (
                            <Tooltip
                                key={idx}
                                content={`Wstaw szablon rekomendacji: "${preset.label}"`}
                            >
                                <button
                                    type="button"
                                    onClick={() => onChange({ ...config, commentary: preset.text })}
                                    className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 underline cursor-pointer"
                                    aria-label={`Wstaw szablon: ${preset.label}`}
                                >
                                    {preset.label}
                                </button>
                            </Tooltip>
                        ))}
                    </div>
                </div>
                <Tooltip content="Wprowadź treść opinii analitycznej doradcy transakcyjnego lub zarządu (zostanie wydrukowana w sekcji 5 memorandum)">
                    <textarea
                        rows={2}
                        value={config.commentary}
                        onChange={(e) => onChange({ ...config, commentary: e.target.value })}
                        placeholder="Wprowadź rekomendację dla komitetu inwestycyjnego lub zarządu..."
                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-750 rounded px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 font-mono"
                        aria-label="Komentarz analityczny doradcy M&A lub CFO"
                    />
                </Tooltip>
            </div>
        </div>
    );
};
