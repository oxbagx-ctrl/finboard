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
import { CURRENCIES } from '../../context/DealContext';

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

export const ReportConfigurator = ({
    config,
    onChange,
    onPrint,
    onExportJson,
    onRefresh,
    loading = false,
}) => {
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
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-xs space-y-4 print:hidden shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2 text-zinc-100 font-bold uppercase tracking-wider text-xs">
                    <Sliders className="w-4 h-4 text-zinc-400" />
                    Konfigurator Parametrów Raportu Zarządczego (Executive Memo)
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={RefreshCw}
                        loading={loading}
                        onClick={onRefresh}
                        title="Przelicz dane raportu"
                    >
                        Przelicz
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={Download}
                        onClick={onExportJson}
                        title="Eksportuj surowe dane JSON"
                    >
                        Eksport JSON
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        icon={Printer}
                        onClick={onPrint}
                        title="Drukuj lub zapisz jako wektorowy plik PDF"
                    >
                        Drukuj / Eksportuj PDF
                    </Button>
                </div>
            </div>

            {/* Config controls grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Period Selector */}
                <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-semibold text-zinc-400 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-zinc-500" />
                        Horyzont Czasowy Raportu
                    </label>
                    <select
                        value={config.periodPreset}
                        onChange={(e) => handlePresetPeriod(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-750 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                    >
                        {PERIOD_PRESETS.map((p) => (
                            <option key={p.id} value={p.id} className="bg-zinc-950 text-zinc-200">
                                {p.label}
                            </option>
                        ))}
                    </select>

                    {config.periodPreset === 'custom' && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                            <div>
                                <span className="text-[9px] text-zinc-500 block mb-0.5">OD:</span>
                                <input
                                    type="date"
                                    value={config.startDate}
                                    onChange={(e) => onChange({ ...config, startDate: e.target.value })}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[11px] text-zinc-200"
                                />
                            </div>
                            <div>
                                <span className="text-[9px] text-zinc-500 block mb-0.5">DO:</span>
                                <input
                                    type="date"
                                    value={config.endDate}
                                    onChange={(e) => onChange({ ...config, endDate: e.target.value })}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[11px] text-zinc-200"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. Currency & Confidentiality */}
                <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-semibold text-zinc-400 flex items-center gap-1.5">
                        <Coins className="w-3 h-3 text-zinc-500" />
                        Waluta Prezentacji & Przeliczenia
                    </label>
                    <select
                        value={config.currency}
                        onChange={(e) => onChange({ ...config, currency: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-750 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                    >
                        {CURRENCIES.map((c) => (
                            <option key={c.code} value={c.code} className="bg-zinc-950 text-zinc-200">
                                {c.code} – {c.label}
                            </option>
                        ))}
                    </select>

                    <label className="block text-[10px] uppercase font-semibold text-zinc-400 pt-1 flex items-center gap-1.5">
                        <Shield className="w-3 h-3 text-zinc-500" />
                        Klauzula Poufności (Header Watermark)
                    </label>
                    <select
                        value={config.confidentiality}
                        onChange={(e) => onChange({ ...config, confidentiality: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-750 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                    >
                        {CONFIDENTIALITY_LEVELS.map((level) => (
                            <option key={level.id} value={level.id} className="bg-zinc-950 text-zinc-200">
                                {level.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 3. Sections Checkboxes */}
                <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-semibold text-zinc-400 flex items-center gap-1.5">
                        <FileText className="w-3 h-3 text-zinc-500" />
                        Sekcje Do Uwzględnienia w Raporcie
                    </label>
                    <div className="space-y-1 pt-0.5">
                        {[
                            { id: 'kpi', label: 'Metryki KPI i Mnożniki Transakcyjne' },
                            { id: 'pnl', label: 'Rachunek Zysków i Strat (P&L Summary)' },
                            { id: 'liquidity', label: 'Wskaźniki Płynności i Wypłacalności' },
                            { id: 'opex', label: 'Struktura Kosztów Operacyjnych (OPEX)' },
                            { id: 'audit', label: 'Certyfikat Integralności i SHA-256' },
                        ].map((sec) => (
                            <button
                                key={sec.id}
                                type="button"
                                onClick={() => toggleSection(sec.id)}
                                className="flex items-center gap-2 text-[11px] text-zinc-300 hover:text-white transition-colors cursor-pointer w-full text-left"
                            >
                                {config.sections[sec.id] ? (
                                    <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                ) : (
                                    <Square className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                                )}
                                <span className={config.sections[sec.id] ? 'text-zinc-200' : 'text-zinc-500'}>
                                    {sec.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Commentary / Recommendation */}
            <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                    <label className="block text-[10px] uppercase font-semibold text-zinc-400">
                        Komentarz Analityczny Doradcy M&A / CFO (Opcjonalny do wydruku)
                    </label>
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                        <span>Wstaw szablon:</span>
                        {COMMENTARY_PRESETS.map((preset, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => onChange({ ...config, commentary: preset.text })}
                                className="text-zinc-400 hover:text-zinc-200 underline"
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                </div>
                <textarea
                    rows={2}
                    value={config.commentary}
                    onChange={(e) => onChange({ ...config, commentary: e.target.value })}
                    placeholder="Wprowadź rekomendację dla komitetu inwestycyjnego lub zarządu..."
                    className="w-full bg-zinc-950 border border-zinc-750 rounded px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                />
            </div>
        </div>
    );
};
