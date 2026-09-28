import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { Button } from '../ui/Button';
import { Tooltip, InfoTooltip } from '../ui/Tooltip';
import {
    X,
    ShieldCheck,
    Clock,
    User,
    Globe,
    RefreshCw,
    FileText
} from 'lucide-react';
import { formatDateTime } from '../../utils/formatters';
import { AuditActionBadge } from '../audit/AuditActionBadge';

export const DocumentAuditModal = ({
    document,
    isOpen,
    onClose,
}) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && document) {
            fetchLogs();
        }
    }, [isOpen, document]);

    const fetchLogs = async () => {
        if (!document) return;
        setLoading(true);
        try {
            const res = await apiClient.get(`/documents/${document.id}/audit-logs`);
            setLogs(res.data.data || []);
        } catch (err) {
            console.error('Failed to load document audit logs', err);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !document) return null;

    const getActionBadge = (action) => <AuditActionBadge action={action} />;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-xs font-mono">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-750 rounded-lg shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="px-5 py-3.5 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-750 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                                    Rejestr Ścieżki Audytowej Dokumentu
                                </h2>
                                <InfoTooltip
                                    size="xs"
                                    title="Niezmienny Dziennik Audytowy (WORM)"
                                    content="Każde pobranie, zmiana metadanych, zarchiwizowanie oraz modyfikacja uprawnień są trwale logowane w chronionym rejestrze zdarzeń."
                                    ariaLabel="Więcej informacji o rejestrze audytowym"
                                />
                            </div>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                IMMUTABLE ACCESS & DOWNLOAD TRAIL
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Tooltip content="Odśwież wpisy audytowe">
                            <button
                                onClick={fetchLogs}
                                disabled={loading}
                                title="Odśwież wpisy"
                                aria-label="Odśwież wpisy"
                                className="p-1 rounded text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </Tooltip>
                        <Tooltip content="Zamknij rejestr audytowy">
                            <button
                                onClick={onClose}
                                title="Zamknij"
                                aria-label="Zamknij rejestr audytowy"
                                className="p-1 rounded text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </Tooltip>
                    </div>
                </div>

                {/* Subheader info */}
                <div className="px-5 py-2.5 bg-zinc-100/60 dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800/80 text-[11px] flex items-center justify-between text-zinc-600 dark:text-zinc-400 shrink-0">
                    <Tooltip content={`Dokument: ${document.title} (${document.original_name})`}>
                        <div className="flex items-center gap-2 truncate cursor-help">
                            <FileText className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                            <span className="font-bold text-zinc-900 dark:text-zinc-200 truncate">{document.title}</span>
                            <span className="text-zinc-500 dark:text-zinc-400 text-[10px]">({document.original_name})</span>
                        </div>
                    </Tooltip>
                    <Tooltip content="Łączna liczba zarejestrowanych zdarzeń audytowych">
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 shrink-0 ml-3 cursor-help">
                            Łącznie zdarzeń: <strong className="text-zinc-900 dark:text-zinc-200 font-bold">{logs.length}</strong>
                        </div>
                    </Tooltip>
                </div>

                {/* Body / Log List */}
                <div className="p-5 overflow-y-auto flex-1 space-y-2">
                    {loading ? (
                        <div className="py-12 text-center text-zinc-500 dark:text-zinc-400 text-xs">
                            <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2 text-zinc-400 dark:text-zinc-500" />
                            Ładowanie rejestru audytowego zdarzeń...
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="py-12 text-center text-zinc-500 dark:text-zinc-400 text-xs">
                            Brak zarejestrowanych operacji audytowych dla tego dokumentu.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {logs.map((log) => (
                                <div
                                    key={log.id}
                                    className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 rounded-lg p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                                >
                                    <div className="flex items-start sm:items-center gap-3">
                                        <div className="shrink-0 mt-0.5 sm:mt-0">
                                            {getActionBadge(log.action)}
                                        </div>
                                        <div>
                                            <Tooltip content={`Użytkownik: ${log.user?.name || 'Nieznany'} | Email: ${log.user?.email || 'brak'} | Rola: ${log.user?.role || 'N/A'}`}>
                                                <div className="font-semibold text-zinc-900 dark:text-zinc-200 text-xs flex items-center gap-1.5 cursor-help">
                                                    <User className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
                                                    {log.user?.name || 'Użytkownik nieznany'}
                                                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-normal">
                                                        ({log.user?.email || 'brak e-mail'}) [{log.user?.role || 'N/A'}]
                                                    </span>
                                                </div>
                                            </Tooltip>
                                            <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 flex flex-wrap items-center gap-3">
                                                <Tooltip content={`Adres IP klienta wywołującego żądanie: ${log.ip_address || '127.0.0.1'}`}>
                                                    <span className="flex items-center gap-1 cursor-help">
                                                        <Globe className="w-2.5 h-2.5" />
                                                        IP: <strong className="text-zinc-700 dark:text-zinc-400">{log.ip_address || '127.0.0.1'}</strong>
                                                    </span>
                                                </Tooltip>
                                                <Tooltip content={`Pełny identyfikator User-Agent: ${log.user_agent || 'Klient FinBoard'}`}>
                                                    <span className="truncate max-w-xs text-zinc-500 dark:text-zinc-400 cursor-help" title={log.user_agent}>
                                                        Agent: {log.user_agent || 'Klient FinBoard'}
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </div>
                                    </div>

                                    <Tooltip content={`Dokładny znacznik czasu zdarzenia: ${formatDateTime(log.created_at)}`}>
                                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 shrink-0 flex items-center gap-1 sm:self-center font-mono cursor-help">
                                            <Clock className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
                                            {formatDateTime(log.created_at)}
                                        </div>
                                    </Tooltip>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
                    <Tooltip content="Rejestr zdarzeń WORM chroni przed manipulacją danymi audytowymi">
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 cursor-help">
                            Zdarzenia audytowe są trwale chronione przed modyfikacją (append-only ledger).
                        </div>
                    </Tooltip>
                    <Tooltip content="Zamknij rejestr audytowy">
                        <span>
                            <Button variant="secondary" size="sm" onClick={onClose} aria-label="Zamknij">
                                Zamknij
                            </Button>
                        </span>
                    </Tooltip>
                </div>
            </div>
        </div>
    );
};
