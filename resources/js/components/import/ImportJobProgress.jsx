import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { Button } from '../ui/Button';
import { Tooltip, InfoTooltip } from '../ui/Tooltip';
import {
    Clock,
    Cpu,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    RefreshCw,
    FileSpreadsheet
} from 'lucide-react';

export const ImportJobProgress = ({
    importJob,
    onComplete,
    onReset,
    onNavigateRecords
}) => {
    const [statusData, setStatusData] = useState(importJob);
    const [isPolling, setIsPolling] = useState(true);

    useEffect(() => {
        if (!statusData?.id) return;
        if (statusData.status === 'completed' || statusData.status === 'failed') {
            setIsPolling(false);
            return;
        }

        const pollInterval = setInterval(async () => {
            try {
                const res = await apiClient.get(`/finance/imports/${statusData.id}`);
                const updated = res.data.data;
                setStatusData(updated);

                if (updated.status === 'completed' || updated.status === 'failed') {
                    setIsPolling(false);
                    clearInterval(pollInterval);
                    if (onComplete) onComplete(updated);
                }
            } catch (err) {
                console.error('Error polling import status', err);
            }
        }, 1500);

        return () => clearInterval(pollInterval);
    }, [statusData?.id, statusData?.status, onComplete]);

    const {
        id,
        file_name,
        status,
        total_rows = 0,
        imported_rows = 0,
        error_count = 0,
        errors = [],
        completed_at,
        created_at
    } = statusData || {};

    const percent = total_rows > 0 ? Math.min(100, Math.round((imported_rows / total_rows) * 100)) : (status === 'completed' ? 100 : 25);

    const getStatusHeader = () => {
        switch (status) {
            case 'pending':
                return {
                    label: 'OCZEKIWANIE W KOLEJCE (REDIS)',
                    badgeClass: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400',
                    icon: Clock,
                };
            case 'processing':
                return {
                    label: 'PRZETWARZANIE PRZEZ WORKERA (PHP-FPM)',
                    badgeClass: 'bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-400',
                    icon: Cpu,
                };
            case 'completed':
                return {
                    label: 'IMPORT ZAKOŃCZONY SUKCESEM',
                    badgeClass: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400',
                    icon: CheckCircle2,
                };
            case 'failed':
                return {
                    label: 'BŁĄD PRZETWARZANIA ZADANIA',
                    badgeClass: 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400',
                    icon: AlertCircle,
                };
            default:
                return {
                    label: status?.toUpperCase(),
                    badgeClass: 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300',
                    icon: RefreshCw,
                };
        }
    };

    const header = getStatusHeader();
    const HeaderIcon = header.icon;

    return (
        <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-750 rounded-lg space-y-4 font-mono shadow-2xl">
            {/* Status Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                    <Tooltip content="Aktywne zadanie asynchronicznego importu w kolejce Redis">
                        <div className="w-8 h-8 rounded bg-zinc-100 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-750 flex items-center justify-center text-zinc-600 dark:text-zinc-300 cursor-help">
                            <FileSpreadsheet className="w-4 h-4" />
                        </div>
                    </Tooltip>
                    <div>
                        <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <span>Zadanie Importu:</span>
                            <Tooltip content={`Nazwa przetwarzanego pliku: ${file_name}`}>
                                <code className="text-[11px] text-zinc-600 dark:text-zinc-400 cursor-help">{file_name}</code>
                            </Tooltip>
                        </div>
                        <Tooltip content={`Identyfikator zadania w kolejce Redis: ${id}`}>
                            <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 cursor-help">
                                ID KOLEJKI: {id}
                            </div>
                        </Tooltip>
                    </div>
                </div>

                <Tooltip content={`Status asynchroniczny: ${header.label}`}>
                    <div className={`px-2.5 py-1 rounded border text-[10px] font-bold tracking-wider flex items-center gap-1.5 cursor-help ${header.badgeClass}`}>
                        <HeaderIcon className={`w-3.5 h-3.5 ${isPolling ? 'animate-spin' : ''}`} />
                        <span>{header.label}</span>
                    </div>
                </Tooltip>
            </div>

            {/* Progress Bar & Indicators */}
            <div className="space-y-2">
                <div className="flex justify-between text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400 text-[11px] flex items-center gap-1">
                        <span>Postęp zaksięgowania transakcji:</span>
                        <InfoTooltip
                            size="xs"
                            title="Postęp Przetwarzania Asynchronicznego"
                            ariaLabel="Informacje o postępie importu"
                            content="Wskaźnik postępu prezentuje liczbę wierszy pomyślnie przetworzonych i zapisanych w bazie danych przez proces Worker."
                        />
                    </span>
                    <Tooltip content={`Zaksięgowano ${imported_rows} z ${total_rows || '?'} wierszy`}>
                        <span className="text-zinc-900 dark:text-zinc-100 font-bold tabular-nums cursor-help">
                            {imported_rows} / {total_rows || '?'} wierszy ({percent}%)
                        </span>
                    </Tooltip>
                </div>

                <Tooltip content={`Stopień zaawansowania operacji: ${percent}%`}>
                    <div className="w-full bg-zinc-100 dark:bg-zinc-950 rounded h-2.5 overflow-hidden border border-zinc-200 dark:border-zinc-800 cursor-help">
                        <div
                            className={`h-full transition-all duration-300 ${
                                status === 'failed'
                                    ? 'bg-rose-600'
                                    : status === 'completed'
                                    ? 'bg-emerald-500'
                                    : 'bg-sky-500 animate-pulse'
                            }`}
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                </Tooltip>
            </div>

            {/* Error box if failed */}
            {status === 'failed' && errors && errors.length > 0 && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded text-xs space-y-1 text-rose-800 dark:text-rose-300">
                    <div className="font-bold flex items-center gap-1 text-rose-700 dark:text-rose-400">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                        <span>Szczegóły zgłoszonych błędów:</span>
                        <InfoTooltip
                            size="xs"
                            title="Błędy Przetwarzania Zadaniowego"
                            ariaLabel="Informacje o błędach zadania"
                            content="Błędy zgłoszone przez proces roboczy Worker podczas asynchronicznego przetwarzania pliku CSV."
                        />
                    </div>
                    {errors.map((e, idx) => (
                        <div key={idx} className="text-[11px] text-rose-700/90 dark:text-rose-300/90 pl-4">
                            • {e.message || JSON.stringify(e)}
                        </div>
                    ))}
                </div>
            )}

            {/* Actions on Completion */}
            {(status === 'completed' || status === 'failed') && (
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
                    <Tooltip content="Zresetuj stan widoku i załaduj kolejny plik CSV">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={onReset}
                            aria-label="Importuj Kolejny Plik"
                        >
                            Importuj Kolejny Plik
                        </Button>
                    </Tooltip>
                    {status === 'completed' && (
                        <Tooltip content="Przejdź do Księgi Transakcji Finansowych, aby zweryfikować zaimportowane zapisy">
                            <Button
                                variant="primary"
                                size="sm"
                                icon={ArrowRight}
                                onClick={onNavigateRecords}
                                aria-label="Przejdź do Księgi Operacji"
                            >
                                Przejdź do Księgi Operacji
                            </Button>
                        </Tooltip>
                    )}
                </div>
            )}
        </div>
    );
};
