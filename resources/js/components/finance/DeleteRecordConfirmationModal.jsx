import React, { useState } from 'react';
import apiClient from '../../api/client';
import { useNotification } from '../../context/NotificationContext';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { AlertTriangle, X, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export const DeleteRecordConfirmationModal = ({
    isOpen,
    onClose,
    onSuccess,
    record
}) => {
    const { success, error } = useNotification();
    const [deleting, setDeleting] = useState(false);

    if (!isOpen || !record) return null;

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await apiClient.delete(`/finance/records/${record.id}`);
            success('Zapis księgowy został pomyślnie usunięty.');
            onSuccess();
            onClose();
        } catch (err) {
            error(err.response?.data?.message || 'Nie udało się usunąć wskazanego rekordu.');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-xs font-mono">
            <div className="bg-white dark:bg-zinc-900 border border-rose-300 dark:border-rose-900/50 rounded-lg shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="px-5 py-3.5 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400">
                            <AlertTriangle className="w-3.5 h-3.5" />
                        </div>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                            Potwierdzenie Usunięcia Wpisu
                        </h2>
                    </div>
                    <Tooltip content="Zamknij okno potwierdzenia">
                        <button
                            onClick={onClose}
                            className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            aria-label="Zamknij okno potwierdzenia"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </Tooltip>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4 text-xs">
                    <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                        Czy na pewno chcesz usunąć poniższą transakcję z księgi głównej? Operacja ta wpłynie na wyliczenia wskaźników finansowych i P&L.
                    </p>

                    <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded space-y-1.5 font-mono text-[11px]">
                        <div className="flex justify-between">
                            <span className="text-zinc-500 dark:text-zinc-400">ID REKORDU:</span>
                            <span className="text-zinc-700 dark:text-zinc-300">{record.id.substring(0, 16)}...</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-zinc-500 dark:text-zinc-400">DATA:</span>
                            <span className="text-zinc-700 dark:text-zinc-300">{record.record_date}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-zinc-500 dark:text-zinc-400">KWOTA:</span>
                            <span className="text-zinc-900 dark:text-zinc-100 font-bold tabular-nums">
                                {formatCurrency(record.amount, record.currency)}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-zinc-500 dark:text-zinc-400">OPIS:</span>
                            <span className="text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]">{record.description}</span>
                        </div>
                    </div>

                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        Zdarzenie usunięcia zostanie odnotowane w niezmiennym dzienniku zdarzeń audytowych.
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-5 py-3 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={onClose} disabled={deleting}>
                        Anuluj
                    </Button>
                    <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting} icon={Trash2}>
                        Trwale Usuń Rekord
                    </Button>
                </div>
            </div>
        </div>
    );
};
