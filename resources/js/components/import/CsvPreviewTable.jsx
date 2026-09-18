import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, ArrowRight, Play } from 'lucide-react';
import { Button } from '../ui/Button';
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
                        <div className="w-8 h-8 rounded bg-emerald-950 border border-emerald-700 flex items-center justify-center text-emerald-400 shrink-0">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                    ) : (
                        <div className="w-8 h-8 rounded bg-rose-950 border border-rose-700 flex items-center justify-center text-rose-400 shrink-0">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                    )}
                    <div>
                        <div className="text-xs font-bold uppercase tracking-wider">
                            {valid
                                ? 'Weryfikacja Pliku Zakończona Sukcesem (Dry-Run Pass)'
                                : 'Wykryto Błędy w Pliku CSV (Dry-Run Failed)'}
                        </div>
                        <div className="text-[11px] opacity-80 mt-0.5">
                            Łącznie wierszy: <strong className="font-bold">{total_rows}</strong> | Poprawnych: <strong className="font-bold">{valid_count}</strong> | Błędnych: <strong className="font-bold">{error_count}</strong>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onCancel}
                        disabled={importing}
                    >
                        Anuluj
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        icon={Play}
                        onClick={onConfirmImport}
                        loading={importing}
                        disabled={!valid || total_rows === 0}
                    >
                        Rozpocznij Asynchroniczny Import
                    </Button>
                </div>
            </div>

            {/* Error Details List if any */}
            {!valid && errors.length > 0 && (
                <div className="bg-zinc-950 border border-rose-900/60 rounded-lg p-3 space-y-2">
                    <div className="text-[11px] font-bold text-rose-400 flex items-center gap-1.5 uppercase">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Rejestr Wykrytych Niespójności Walidacyjnych (Pierwsze {Math.min(errors.length, 10)}):
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1 text-[11px] divide-y divide-zinc-900">
                        {errors.slice(0, 10).map((err, idx) => (
                            <div key={idx} className="pt-1 flex items-start gap-2 text-zinc-300">
                                <span className="text-rose-400 font-bold shrink-0">
                                    [Linia {err.line || 'N/A'}]:
                                </span>
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
                        <span className="font-bold text-zinc-300 uppercase tracking-wider text-[11px]">
                            Podgląd Wygenerowanych Zapisów (Pierwsze {sample_records.length} Wierszy)
                        </span>
                        <span className="text-[10px] text-zinc-500">
                            Źródło: csv_import
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-zinc-950/80 border-b border-zinc-800 text-[10px] text-zinc-400 uppercase tracking-wider">
                                    <th className="py-2 px-3.5 font-semibold w-28">Data</th>
                                    <th className="py-2 px-3.5 font-semibold w-36">Kategoria ID</th>
                                    <th className="py-2 px-3.5 font-semibold">Tytuł / Opis</th>
                                    <th className="py-2 px-3.5 font-semibold w-24 text-center">Waluta</th>
                                    <th className="py-2 px-3.5 font-semibold w-32 text-right">Kwota</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-850">
                                {sample_records.map((rec, index) => (
                                    <tr key={index} className="hover:bg-zinc-850/40 transition-colors">
                                        <td className="py-2 px-3.5 text-zinc-400 whitespace-nowrap text-[11px]">
                                            {rec.record_date}
                                        </td>
                                        <td className="py-2 px-3.5 text-zinc-200 font-semibold whitespace-nowrap">
                                            {rec.category_id}
                                        </td>
                                        <td className="py-2 px-3.5 text-zinc-300 truncate max-w-sm">
                                            {rec.description}
                                        </td>
                                        <td className="py-2 px-3.5 text-zinc-400 text-center whitespace-nowrap">
                                            {rec.currency || 'PLN'}
                                        </td>
                                        <td className="py-2 px-3.5 text-right font-bold text-zinc-100 tabular-nums whitespace-nowrap">
                                            {formatCurrency(Number(rec.amount), rec.currency || 'PLN')}
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
