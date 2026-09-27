import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Play } from 'lucide-react';
import { Button } from '../ui/Button';
import { Tooltip, InfoTooltip } from '../ui/Tooltip';
import { formatCurrency } from '../../utils/formatters';

export const CsvPreviewTable = ({
    previewData,
    onConfirmImport,
    importing,
    onCancel
}) => {
    if (!previewData) return null;

    const {
        valid,
        total_rows,
        valid_count,
        error_count,
        errors = [],
        sample_records = []
    } = previewData;

    return (
        <div className="space-y-4 font-mono">
            {/* Status Summary Banner */}
            <div className={`p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                valid
                    ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-800 text-rose-300'
            }`}>
                <div className="flex items-start sm:items-center gap-3">
                    {valid ? (
                        <Tooltip content="Weryfikacja symulacyjna powiodła się - brak błędów formalnych w strukturze pliku CSV">
                            <div className="w-8 h-8 rounded bg-emerald-950 border border-emerald-700 flex items-center justify-center text-emerald-400 shrink-0 cursor-help">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                        </Tooltip>
                    ) : (
                        <Tooltip content="Plik CSV zawiera błędy walidacji uniemożliwiające bezpieczny import do bazy danych">
                            <div className="w-8 h-8 rounded bg-rose-950 border border-rose-700 flex items-center justify-center text-rose-400 shrink-0 cursor-help">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                        </Tooltip>
                    )}
                    <div>
                        <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                            <span>
                                {valid
                                    ? 'Weryfikacja Pliku Zakończona Sukcesem (Dry-Run Pass)'
                                    : 'Wykryto Błędy w Pliku CSV (Dry-Run Failed)'}
                            </span>
                            <InfoTooltip
                                size="xs"
                                title="Wynik Analizy Dry-Run"
                                ariaLabel="Więcej informacji o wyniku weryfikacji Dry-Run"
                                content="Weryfikacja Dry-Run symuluje przetwarzanie pliku: sprawdza formaty dat, poprawność kodów kategorii w planie kont oraz wartości kwotowe bez modyfikacji bazy danych."
                            />
                        </div>
                        <div className="text-[11px] opacity-80 mt-0.5">
                            Łącznie wierszy: <strong className="font-bold">{total_rows}</strong> | Poprawnych: <strong className="font-bold">{valid_count}</strong> | Błędnych: <strong className="font-bold">{error_count}</strong>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Tooltip content="Odrzuć załadowany plik CSV i powróć do wyboru pliku">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={onCancel}
                            disabled={importing}
                            aria-label="Anuluj"
                        >
                            Anuluj
                        </Button>
                    </Tooltip>
                    <Tooltip content={valid ? "Wyślij zadanie importu do asynchronicznej kolejki Redis w celu zaksięgowania wierszy" : "Import zablokowany - usuń błędy walidacji w pliku CSV"}>
                        <span>
                            <Button
                                variant="primary"
                                size="sm"
                                icon={Play}
                                onClick={onConfirmImport}
                                loading={importing}
                                disabled={!valid || total_rows === 0}
                                aria-label="Rozpocznij Asynchroniczny Import"
                            >
                                Rozpocznij Asynchroniczny Import
                            </Button>
                        </span>
                    </Tooltip>
                </div>
            </div>

            {/* Error Details List if any */}
            {!valid && errors.length > 0 && (
                <div className="bg-zinc-950 border border-rose-900/60 rounded-lg p-3 space-y-2">
                    <div className="text-[11px] font-bold text-rose-400 flex items-center gap-1.5 uppercase">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Rejestr Wykrytych Niespójności Walidacyjnych (Pierwsze {Math.min(errors.length, 10)}):</span>
                        <InfoTooltip
                            size="xs"
                            title="Błędy Walidacji Wierszy"
                            ariaLabel="Więcej informacji o rejestrze błędów walidacyjnych"
                            content="Lista wykrytych niespójności z numerami linii i nazwami kolumn. Wymaga korekty w arkuszu kalkulacyjnym przed ponownym przesłaniem pliku."
                        />
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1 text-[11px] divide-y divide-zinc-900">
                        {errors.slice(0, 10).map((err, idx) => (
                            <div key={idx} className="pt-1 flex items-start gap-2 text-zinc-300">
                                <Tooltip content={`Błąd zlokalizowany w wierszu ${err.line || 'N/A'} pliku źródłowego`}>
                                    <span className="text-rose-400 font-bold shrink-0 cursor-help">
                                        [Linia {err.line || 'N/A'}]:
                                    </span>
                                </Tooltip>
                                <span className="text-zinc-400 truncate">
                                    {err.column ? `Kolumna "${err.column}" - ` : ''}{err.message}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="text-[10px] text-zinc-500 pt-1 border-t border-zinc-900">
                        Popraw błędy w pliku źródłowym i prześlij go ponownie, aby umożliwić zaksięgowanie.
                    </div>
                </div>
            )}

            {/* Sample Records Table */}
            {sample_records.length > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-xl">
                    <div className="px-3.5 py-2.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                            <span className="font-bold text-zinc-300 uppercase tracking-wider text-[11px]">
                                Podgląd Wygenerowanych Zapisów (Pierwsze {sample_records.length} Wierszy)
                            </span>
                            <InfoTooltip
                                size="xs"
                                title="Próbka Danych Księgowych"
                                ariaLabel="Więcej informacji o próbce wygenerowanych zapisów"
                                content="Podgląd znormalizowanych rekordów transakcji, które zostaną utworzone w bazie danych po zakolejkowaniu zadania."
                            />
                        </div>
                        <Tooltip content="Kanał wprowadzania danych oznaczony w rejestrze audytowym flagą csv_import">
                            <span className="text-[10px] text-zinc-500 cursor-help">
                                Źródło: csv_import
                            </span>
                        </Tooltip>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-zinc-950/80 border-b border-zinc-800 text-[10px] text-zinc-400 uppercase tracking-wider">
                                    <th className="py-2 px-3.5 font-semibold w-28">
                                        <Tooltip content="Data księgowania operacji w formacie RRRR-MM-DD">
                                            <span className="cursor-help">Data</span>
                                        </Tooltip>
                                    </th>
                                    <th className="py-2 px-3.5 font-semibold w-36">
                                        <Tooltip content="Unikalny kod lub identyfikator kategorii w planie kont podmiotu">
                                            <span className="cursor-help">Kategoria ID</span>
                                        </Tooltip>
                                    </th>
                                    <th className="py-2 px-3.5 font-semibold">
                                        <Tooltip content="Opis transakcji lub tytuł operacji bankowej">
                                            <span className="cursor-help">Tytuł / Opis</span>
                                        </Tooltip>
                                    </th>
                                    <th className="py-2 px-3.5 font-semibold w-24 text-center">
                                        <Tooltip content="Waluta rozliczeniowa transakcji (domyślnie PLN)">
                                            <span className="cursor-help">Waluta</span>
                                        </Tooltip>
                                    </th>
                                    <th className="py-2 px-3.5 font-semibold w-32 text-right">
                                        <Tooltip content="Wartość kwotowa transakcji podlegająca ujęciu w księdze głównej">
                                            <span className="cursor-help">Kwota</span>
                                        </Tooltip>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-850">
                                {sample_records.map((rec, index) => (
                                    <tr key={index} className="hover:bg-zinc-850/40 transition-colors">
                                        <td className="py-2 px-3.5 text-zinc-400 whitespace-nowrap text-[11px]">
                                            <Tooltip content={`Data operacji: ${rec.record_date}`}>
                                                <span className="cursor-help">{rec.record_date}</span>
                                            </Tooltip>
                                        </td>
                                        <td className="py-2 px-3.5 text-zinc-200 font-semibold whitespace-nowrap">
                                            <Tooltip content={`Kategoria analityczna: ${rec.category_id}`}>
                                                <span className="cursor-help">{rec.category_id}</span>
                                            </Tooltip>
                                        </td>
                                        <td className="py-2 px-3.5 text-zinc-300 truncate max-w-sm">
                                            <Tooltip content={rec.description}>
                                                <span className="truncate block cursor-help">{rec.description}</span>
                                            </Tooltip>
                                        </td>
                                        <td className="py-2 px-3.5 text-zinc-400 text-center whitespace-nowrap">
                                            <Tooltip content={`Waluta: ${rec.currency || 'PLN'}`}>
                                                <span className="cursor-help">{rec.currency || 'PLN'}</span>
                                            </Tooltip>
                                        </td>
                                        <td className="py-2 px-3.5 text-right font-bold text-zinc-100 tabular-nums whitespace-nowrap">
                                            <Tooltip content={`Wartość nominalna: ${formatCurrency(Number(rec.amount), rec.currency || 'PLN')}`}>
                                                <span className="cursor-help">{formatCurrency(Number(rec.amount), rec.currency || 'PLN')}</span>
                                            </Tooltip>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
