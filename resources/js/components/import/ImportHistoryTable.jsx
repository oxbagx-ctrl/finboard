import React from 'react';
import { FileSpreadsheet, RefreshCw, CheckCircle2, AlertCircle, Clock, Cpu } from 'lucide-react';
import { Button } from '../ui/Button';
import { Tooltip, InfoTooltip } from '../ui/Tooltip';

export const ImportHistoryTable = ({
    history = [],
    loading,
    onRefresh
}) => {
    const getStatusBadge = (status) => {
        switch (status) {
            case 'completed':
                return (
                    <Tooltip content="Zadanie zrealizowane pomyślnie - operacje zostały zaksięgowane">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 border border-emerald-800 text-emerald-400 cursor-help">
                            <CheckCircle2 className="w-3 h-3" />
                            SUKCES
                        </span>
                    </Tooltip>
                );
            case 'failed':
                return (
                    <Tooltip content="Zadanie przerwane błędem krytycznym - szczegóły w logach zadania">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 border border-rose-800 text-rose-400 cursor-help">
                            <AlertCircle className="w-3 h-3" />
                            BŁĄD
                        </span>
                    </Tooltip>
                );
            case 'processing':
                return (
                    <Tooltip content="Zadanie jest aktualnie przetwarzane przez proces roboczy Worker">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-sky-950 border border-sky-800 text-sky-400 cursor-help">
                            <Cpu className="w-3 h-3 animate-spin" />
                            W TOKU
                        </span>
                    </Tooltip>
                );
            case 'pending':
                return (
                    <Tooltip content="Zadanie oczekuje w kolejce asynchronicznej Redis">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 border border-amber-800 text-amber-400 cursor-help">
                            <Clock className="w-3 h-3" />
                            KOLEJKA
                        </span>
                    </Tooltip>
                );
            default:
                return (
                    <Tooltip content={`Status zadania: ${status}`}>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300 cursor-help">
                            {status}
                        </span>
                    </Tooltip>
                );
        }
    };

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden font-mono shadow-xl">
            <div className="px-4 py-3 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-zinc-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                        Dziennik Zadań Asynchronicznych (Import Audit Trail)
                    </span>
                    <InfoTooltip
                        size="xs"
                        title="Dziennik Zadań Asynchronicznych"
                        ariaLabel="Więcej informacji o dzienniku importów"
                        content="Niezmienny rejestr audytowy wszystkich zadań importu wsadowego zrealizowanych dla wybranego podmiotu gospodarczego."
                    />
                </div>
                <Tooltip content="Pobierz najnowszy stan zadań asynchronicznych i odśwież rejestr historii">
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={RefreshCw}
                        onClick={onRefresh}
                        loading={loading}
                        aria-label="Odśwież Historię"
                        className="text-xs"
                    >
                        Odśwież Historię
                    </Button>
                </Tooltip>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                    <thead>
                        <tr className="bg-zinc-950/70 border-b border-zinc-800 text-[10px] text-zinc-400 uppercase tracking-wider">
                            <th className="py-2.5 px-4 font-semibold w-40">
                                <Tooltip content="Data i czas przesłania pliku oraz zarejestrowania zadania w kolejce">
                                    <span className="cursor-help">Data Utworzenia</span>
                                </Tooltip>
                            </th>
                            <th className="py-2.5 px-4 font-semibold">
                                <Tooltip content="Nazwa źródłowego pliku CSV oraz identyfikator UUID zadania">
                                    <span className="cursor-help">Nazwa Pliku CSV</span>
                                </Tooltip>
                            </th>
                            <th className="py-2.5 px-4 font-semibold w-32 text-center">
                                <Tooltip content="Stan realizacji zadania w kolejce asynchronicznej">
                                    <span className="cursor-help">Status</span>
                                </Tooltip>
                            </th>
                            <th className="py-2.5 px-4 font-semibold w-36 text-right">
                                <Tooltip content="Stosunek liczby pomyślnie zaksięgowanych wierszy do łącznej liczby pozycji">
                                    <span className="cursor-help">Wiersze (Sukces/Razem)</span>
                                </Tooltip>
                            </th>
                            <th className="py-2.5 px-4 font-semibold w-24 text-center">
                                <Tooltip content="Liczba wierszy odrzuconych z powodu błędów walidacyjnych">
                                    <span className="cursor-help">Błędy</span>
                                </Tooltip>
                            </th>
                            <th className="py-2.5 px-4 font-semibold w-36 text-right">
                                <Tooltip content="Dokładny czas zakończenia asynchronicznego przetwarzania">
                                    <span className="cursor-help">Zakończono</span>
                                </Tooltip>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850">
                        {loading && history.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="py-8 text-center text-zinc-500">
                                    Wczytywanie historii importów...
                                </td>
                            </tr>
                        ) : history.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="py-8 text-center text-zinc-500">
                                    Brak zarejestrowanych operacji importu dla bieżącego podmiotu.
                                </td>
                            </tr>
                        ) : (
                            history.map((item) => (
                                <tr key={item.id} className="hover:bg-zinc-850/40 transition-colors">
                                    <td className="py-2.5 px-4 text-zinc-400 text-[11px] whitespace-nowrap">
                                        <Tooltip content={`Czas utworzenia: ${item.created_at ? new Date(item.created_at).toLocaleString() : '–'}`}>
                                            <span className="cursor-help">
                                                {item.created_at ? new Date(item.created_at).toLocaleString() : '–'}
                                            </span>
                                        </Tooltip>
                                    </td>
                                    <td className="py-2.5 px-4 font-semibold text-zinc-200">
                                        <div className="flex items-center gap-1.5">
                                            <Tooltip content={`Pełna nazwa pliku źródłowego: ${item.file_name}`}>
                                                <span className="truncate max-w-xs cursor-help">{item.file_name}</span>
                                            </Tooltip>
                                        </div>
                                        <Tooltip content={`Identyfikator zadania UUID: ${item.id}`}>
                                            <div className="text-[10px] text-zinc-500 font-normal cursor-help">
                                                ID: {item.id.substring(0, 8)}...
                                            </div>
                                        </Tooltip>
                                    </td>
                                    <td className="py-2.5 px-4 text-center whitespace-nowrap">
                                        {getStatusBadge(item.status)}
                                    </td>
                                    <td className="py-2.5 px-4 text-right font-bold text-zinc-100 tabular-nums whitespace-nowrap">
                                        <Tooltip content={`Pomyślnie zaimportowano ${item.imported_rows} z ${item.total_rows} wierszy`}>
                                            <span className="cursor-help">
                                                {item.imported_rows} / {item.total_rows}
                                            </span>
                                        </Tooltip>
                                    </td>
                                    <td className="py-2.5 px-4 text-center tabular-nums whitespace-nowrap">
                                        <Tooltip content={item.error_count > 0 ? `Liczba wierszy z błędami: ${item.error_count}` : 'Brak błędów walidacyjnych'}>
                                            <span className="cursor-help">
                                                {item.error_count > 0 ? (
                                                    <span className="text-rose-400 font-bold">{item.error_count}</span>
                                                ) : (
                                                    <span className="text-zinc-500">0</span>
                                                )}
                                            </span>
                                        </Tooltip>
                                    </td>
                                    <td className="py-2.5 px-4 text-right text-zinc-400 text-[11px] whitespace-nowrap">
                                        <Tooltip content={`Czas zakończenia: ${item.completed_at ? new Date(item.completed_at).toLocaleString() : 'W toku lub przerwane'}`}>
                                            <span className="cursor-help">
                                                {item.completed_at ? new Date(item.completed_at).toLocaleTimeString() : '–'}
                                            </span>
                                        </Tooltip>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
