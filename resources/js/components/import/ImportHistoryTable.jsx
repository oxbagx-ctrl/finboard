import React from 'react';
import { FileSpreadsheet, RefreshCw, CheckCircle2, AlertCircle, Clock, Cpu } from 'lucide-react';
import { Button } from '../ui/Button';

export const ImportHistoryTable = ({
    history = [],
    loading,
    onRefresh
}) => {
    const getStatusBadge = (status) => {
        switch (status) {
            case 'completed':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 border border-emerald-800 text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        SUKCES
                    </span>
                );
            case 'failed':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 border border-rose-800 text-rose-400">
                        <AlertCircle className="w-3 h-3" />
                        BŁĄD
                    </span>
                );
            case 'processing':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-sky-950 border border-sky-800 text-sky-400">
                        <Cpu className="w-3 h-3 animate-spin" />
                        W TOKU
                    </span>
                );
            case 'pending':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 border border-amber-800 text-amber-400">
                        <Clock className="w-3 h-3" />
                        KOLEJKA
                    </span>
                );
            default:
                return (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300">
                        {status}
                    </span>
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
                </div>
                <Button
                    variant="secondary"
                    size="sm"
                    icon={RefreshCw}
                    onClick={onRefresh}
                    loading={loading}
                    className="text-xs"
                >
                    Odśwież Historię
                </Button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                    <thead>
                        <tr className="bg-zinc-950/70 border-b border-zinc-800 text-[10px] text-zinc-400 uppercase tracking-wider">
                            <th className="py-2.5 px-4 font-semibold w-40">Data Utworzenia</th>
                            <th className="py-2.5 px-4 font-semibold">Nazwa Pliku CSV</th>
                            <th className="py-2.5 px-4 font-semibold w-32 text-center">Status</th>
                            <th className="py-2.5 px-4 font-semibold w-36 text-right">Wiersze (Sukces/Razem)</th>
                            <th className="py-2.5 px-4 font-semibold w-24 text-center">Błędy</th>
                            <th className="py-2.5 px-4 font-semibold w-36 text-right">Zakończono</th>
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
                                        {item.created_at ? new Date(item.created_at).toLocaleString() : '–'}
                                    </td>
                                    <td className="py-2.5 px-4 font-semibold text-zinc-200">
                                        <div className="flex items-center gap-1.5">
                                            <span className="truncate max-w-xs">{item.file_name}</span>
                                        </div>
                                        <div className="text-[10px] text-zinc-500 font-normal">
                                            ID: {item.id.substring(0, 8)}...
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-4 text-center whitespace-nowrap">
                                        {getStatusBadge(item.status)}
                                    </td>
                                    <td className="py-2.5 px-4 text-right font-bold text-zinc-100 tabular-nums whitespace-nowrap">
                                        {item.imported_rows} / {item.total_rows}
                                    </td>
                                    <td className="py-2.5 px-4 text-center tabular-nums whitespace-nowrap">
                                        {item.error_count > 0 ? (
                                            <span className="text-rose-400 font-bold">{item.error_count}</span>
                                        ) : (
                                            <span className="text-zinc-500">0</span>
                                        )}
                                    </td>
                                    <td className="py-2.5 px-4 text-right text-zinc-400 text-[11px] whitespace-nowrap">
                                        {item.completed_at ? new Date(item.completed_at).toLocaleTimeString() : '–'}
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
