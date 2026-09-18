import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { Button } from '../ui/Button';
import {
    X,
    ShieldCheck,
    DownloadCloud,
    UploadCloud,
    Archive,
    RotateCcw,
    Clock,
    User,
    Globe,
    RefreshCw,
    FileText
} from 'lucide-react';
import { formatDateTime } from '../../utils/formatters';

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

    const getActionBadge = (action) => {
        switch (action) {
            case 'upload':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950/60 border border-emerald-800 text-emerald-300">
                        <UploadCloud className="w-3 h-3" />
                        Upload
                    </span>
                );
            case 'download':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-950/60 border border-blue-800 text-blue-300">
                        <DownloadCloud className="w-3 h-3" />
                        Pobranie
                    </span>
                );
            case 'archive':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-950/60 border border-amber-800 text-amber-300">
                        <Archive className="w-3 h-3" />
                        Archiwizacja
                    </span>
                );
            case 'unarchive':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-800 border border-zinc-700 text-zinc-200">
                        <RotateCcw className="w-3 h-3" />
                        Przywrócenie
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-850 border border-zinc-750 text-zinc-300">
                        {action}
                    </span>
                );
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-xs font-mono">
            <div className="bg-zinc-900 border border-zinc-750 rounded-lg shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="px-5 py-3.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-zinc-850 border border-zinc-750 flex items-center justify-center text-zinc-300">
                            <ShieldCheck className="w-3.5 h-3.5" />
                        </div>
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-100">
                                Rejestr Ścieżki Audytowej Dokumentu
                            </h2>
                            <p className="text-[10px] text-zinc-500">
                                IMMUTABLE ACCESS & DOWNLOAD TRAIL
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchLogs}
                            disabled={loading}
                            title="Odśwież wpisy"
                            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Subheader info */}
                <div className="px-5 py-2.5 bg-zinc-950/50 border-b border-zinc-800/80 text-[11px] flex items-center justify-between text-zinc-400 shrink-0">
                    <div className="flex items-center gap-2 truncate">
                        <FileText className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span className="font-bold text-zinc-200 truncate">{document.title}</span>
                        <span className="text-zinc-500 text-[10px]">({document.original_name})</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 shrink-0 ml-3">
                        Łącznie zdarzeń: <strong className="text-zinc-200 font-bold">{logs.length}</strong>
                    </div>
                </div>

                {/* Body / Log List */}
                <div className="p-5 overflow-y-auto flex-1 space-y-2">
                    {loading ? (
                        <div className="py-12 text-center text-zinc-500 text-xs">
                            <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2 text-zinc-400" />
                            Ładowanie rejestru audytowego zdarzeń...
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="py-12 text-center text-zinc-500 text-xs">
                            Brak zarejestrowanych operacji audytowych dla tego dokumentu.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {logs.map((log) => (
                                <div
                                    key={log.id}
                                    className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-zinc-700 transition-colors"
                                >
                                    <div className="flex items-start sm:items-center gap-3">
                                        <div className="shrink-0 mt-0.5 sm:mt-0">
                                            {getActionBadge(log.action)}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-zinc-200 text-xs flex items-center gap-1.5">
                                                <User className="w-3 h-3 text-zinc-500" />
                                                {log.user?.name || 'Użytkownik nieznany'}
                                                <span className="text-[10px] text-zinc-500 font-normal">
                                                    ({log.user?.email || 'brak e-mail'}) [{log.user?.role || 'N/A'}]
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-zinc-500 mt-0.5 flex flex-wrap items-center gap-3">
                                                <span className="flex items-center gap-1">
                                                    <Globe className="w-2.5 h-2.5" />
                                                    IP: <strong className="text-zinc-400">{log.ip_address || '127.0.0.1'}</strong>
                                                </span>
                                                <span className="truncate max-w-xs text-zinc-500" title={log.user_agent}>
                                                    Agent: {log.user_agent || 'Klient FinBoard'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-[10px] text-zinc-400 shrink-0 flex items-center gap-1 sm:self-center font-mono">
                                        <Clock className="w-3 h-3 text-zinc-500" />
                                        {formatDateTime(log.created_at)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between shrink-0">
                    <div className="text-[10px] text-zinc-500">
                        Zdarzenia audytowe są trwale chronione przed modyfikacją (append-only ledger).
                    </div>
                    <Button variant="secondary" size="sm" onClick={onClose}>
                        Zamknij
                    </Button>
                </div>
            </div>
        </div>
    );
};
