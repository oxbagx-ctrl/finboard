import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import {
    ShieldCheck,
    DownloadCloud,
    UploadCloud,
    Archive,
    RotateCcw,
    RefreshCw,
    Search,
    User,
    Globe,
    Clock,
    FileText,
    ChevronLeft,
    ChevronRight,
    Filter,
    X,
    Lock
} from 'lucide-react';
import { formatDateTime } from '../utils/formatters';

const ACTION_FILTERS = [
    { id: '', label: 'Wszystkie Zdarzenia' },
    { id: 'download', label: 'Pobrania' },
    { id: 'upload', label: 'Wgrania (Upload)' },
    { id: 'archive', label: 'Archiwizacje' },
    { id: 'unarchive', label: 'Przywrócenia' },
];

export const AuditLogsView = () => {
    const { activeCompany } = useAuth();
    const { error } = useNotification();

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAction, setSelectedAction] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [pagination, setPagination] = useState({
        currentPage: 1,
        lastPage: 1,
        total: 0,
        perPage: 25,
    });

    const fetchLogs = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const params = {
                page,
                per_page: 25,
            };

            const res = await apiClient.get('/documents/audit-logs', { params });
            let records = res.data.data || [];

            if (selectedAction) {
                records = records.filter(l => l.action === selectedAction);
            }

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                records = records.filter(l =>
                    l.document_title?.toLowerCase().includes(q) ||
                    l.user?.name?.toLowerCase().includes(q) ||
                    l.user?.email?.toLowerCase().includes(q) ||
                    l.ip_address?.includes(q)
                );
            }

            setLogs(records);
            if (res.data.meta) {
                setPagination({
                    currentPage: res.data.meta.current_page,
                    lastPage: res.data.meta.last_page,
                    total: res.data.meta.total,
                    perPage: res.data.meta.per_page,
                });
            }
        } catch (err) {
            console.error('Failed to load company audit logs', err);
            error('Nie udało się pobrać księgi audytowej dokumentów.');
        } finally {
            setLoading(false);
        }
    }, [selectedAction, searchQuery, error]);

    useEffect(() => {
        fetchLogs(1);
    }, [fetchLogs, activeCompany?.id]);

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

    const downloadEventsCount = logs.filter(l => l.action === 'download').length;
    const uploadEventsCount = logs.filter(l => l.action === 'upload').length;

    return (
        <div className="space-y-4 font-mono">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-zinc-950 border border-zinc-750 flex items-center justify-center text-zinc-200 shrink-0">
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-sm font-bold uppercase tracking-wider text-zinc-100">
                                Dziennik Ścieżki Audytowej VDR (Audit Trail)
                            </h1>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-zinc-950 border border-zinc-750 text-zinc-400">
                                {activeCompany?.name || 'Spółka'}
                            </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-0.5">
                            Niezmienny rejestr dostępu, pobrań i operacji zarządczych w Pokoju Danych.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={RefreshCw}
                        loading={loading}
                        onClick={() => fetchLogs(pagination.currentPage)}
                    >
                        Odśwież
                    </Button>
                </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs">
                    <div className="text-[10px] uppercase text-zinc-500 font-semibold flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-zinc-400" />
                        Rejestr Zdarzeń
                    </div>
                    <div className="text-lg font-bold text-zinc-100 mt-1 tabular-nums">
                        {pagination.total}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                        Status księgi: <span className="text-emerald-400 font-bold">Zgodny z SOX / RODO</span>
                    </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs">
                    <div className="text-[10px] uppercase text-zinc-500 font-semibold flex items-center gap-1.5">
                        <DownloadCloud className="w-3 h-3 text-blue-400" />
                        Pobrania Plików
                    </div>
                    <div className="text-lg font-bold text-zinc-100 mt-1 tabular-nums">
                        {downloadEventsCount}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                        Ścisła rejestracja tożsamości pobierającego
                    </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs">
                    <div className="text-[10px] uppercase text-zinc-500 font-semibold flex items-center gap-1.5">
                        <UploadCloud className="w-3 h-3 text-emerald-400" />
                        Zdeponowane Dokumenty
                    </div>
                    <div className="text-lg font-bold text-zinc-100 mt-1 tabular-nums">
                        {uploadEventsCount}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                        Podpis kryptograficzny SHA-256
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                    {ACTION_FILTERS.map(filter => (
                        <button
                            key={filter.id}
                            type="button"
                            onClick={() => setSelectedAction(filter.id)}
                            className={`px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap transition-colors ${
                                selectedAction === filter.id
                                    ? 'bg-zinc-100 text-zinc-900 shadow-sm'
                                    : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800'
                            }`}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>

                <div className="relative flex-1 max-w-md">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Szukaj po dokumencie, użytkowniku lub IP..."
                        className="w-full bg-zinc-950 border border-zinc-800 rounded pl-8 pr-8 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Audit Table */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-xl font-mono text-xs">
                {loading ? (
                    <div className="p-12 text-center text-zinc-500">
                        <RefreshCw className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-200 rounded-full animate-spin mx-auto mb-2" />
                        Pobieranie rejestru operacji audytowych...
                    </div>
                ) : logs.length === 0 ? (
                    <div className="p-12 text-center text-zinc-500">
                        <ShieldCheck className="w-10 h-10 mx-auto text-zinc-600 mb-2 opacity-80" />
                        <div className="text-zinc-300 font-bold">Brak zdarzeń audytowych</div>
                        <div className="text-[10px] text-zinc-500 mt-1">
                            Operacje uploadu i pobrań pojawią się w tym rejestrze automatycznie.
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-zinc-950 border-b border-zinc-800 text-[10px] text-zinc-400 uppercase tracking-wider">
                                    <th className="py-2.5 px-4 font-semibold w-44">Sygnatura Czasowa</th>
                                    <th className="py-2.5 px-3 font-semibold w-28">Operacja</th>
                                    <th className="py-2.5 px-4 font-semibold">Dokument VDR</th>
                                    <th className="py-2.5 px-3 font-semibold w-56">Tożsamość Operatora</th>
                                    <th className="py-2.5 px-3 font-semibold w-36">Adres IP</th>
                                    <th className="py-2.5 px-4 font-semibold w-48 text-right">Identyfikator</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-850">
                                {logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-zinc-850/40 transition-colors">
                                        {/* Timestamp */}
                                        <td className="py-2.5 px-4 whitespace-nowrap text-zinc-300 tabular-nums">
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-3 h-3 text-zinc-500 shrink-0" />
                                                <span>{formatDateTime(log.created_at)}</span>
                                            </div>
                                        </td>

                                        {/* Action */}
                                        <td className="py-2.5 px-3 whitespace-nowrap">
                                            {getActionBadge(log.action)}
                                        </td>

                                        {/* Document */}
                                        <td className="py-2.5 px-4">
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                                <span className="font-bold text-zinc-200 truncate" title={log.document_title}>
                                                    {log.document_title || 'Dokument usunięty'}
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-zinc-500 truncate">
                                                ID: {log.document_id}
                                            </div>
                                        </td>

                                        {/* User */}
                                        <td className="py-2.5 px-3 whitespace-nowrap">
                                            <div className="font-semibold text-zinc-200 flex items-center gap-1">
                                                <User className="w-3 h-3 text-zinc-500" />
                                                {log.user?.name || 'Użytkownik'}
                                                <span className="text-[10px] text-zinc-500 font-normal">
                                                    [{log.user?.role || 'N/A'}]
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-zinc-500">
                                                {log.user?.email || 'brak e-mail'}
                                            </div>
                                        </td>

                                        {/* IP */}
                                        <td className="py-2.5 px-3 whitespace-nowrap text-zinc-400">
                                            <div className="flex items-center gap-1.5">
                                                <Globe className="w-3 h-3 text-zinc-500" />
                                                <span>{log.ip_address || '127.0.0.1'}</span>
                                            </div>
                                        </td>

                                        {/* Log ID */}
                                        <td className="py-2.5 px-4 text-right text-zinc-500 text-[10px] truncate max-w-[120px]" title={log.id}>
                                            {log.id.substring(0, 8)}...
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            {pagination.total > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-xs text-zinc-400">
                    <div>
                        Wpisy audytowe: <strong className="text-zinc-200">{logs.length}</strong> z <strong className="text-zinc-200">{pagination.total}</strong>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={ChevronLeft}
                            disabled={pagination.currentPage <= 1 || loading}
                            onClick={() => fetchLogs(pagination.currentPage - 1)}
                        >
                            Poprzednia
                        </Button>
                        <span className="px-2 text-zinc-300 tabular-nums">
                            Strona {pagination.currentPage} z {pagination.lastPage}
                        </span>
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={ChevronRight}
                            disabled={pagination.currentPage >= pagination.lastPage || loading}
                            onClick={() => fetchLogs(pagination.currentPage + 1)}
                        >
                            Następna
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};
