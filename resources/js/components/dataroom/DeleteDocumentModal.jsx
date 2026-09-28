import React, { useState } from 'react';
import apiClient from '../../api/client';
import { useNotification } from '../../context/NotificationContext';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { AlertTriangle, X, Trash2 } from 'lucide-react';

export const DeleteDocumentModal = ({
    document,
    isOpen,
    onClose,
    onSuccess,
}) => {
    const { success, error } = useNotification();
    const [deleting, setDeleting] = useState(false);

    if (!isOpen || !document) return null;

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await apiClient.delete(`/documents/${document.id}`);
            success('Dokument został trwale usunięty z wirtualnego pokoju danych.');
            onSuccess();
            onClose();
        } catch (err) {
            error(err.response?.data?.message || 'Wystąpił błąd podczas usuwania dokumentu.');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-xs font-mono">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-750 rounded-lg shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="px-5 py-3.5 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                        <AlertTriangle className="w-4 h-4" />
                        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                            Potwierdzenie Usunięcia Dokumentu
                        </h2>
                    </div>
                    <Tooltip content="Zamknij okno potwierdzenia">
                        <button
                            onClick={onClose}
                            disabled={deleting}
                            aria-label="Zamknij okno"
                            className="p-1 rounded text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </Tooltip>
                </div>

                <div className="p-5 space-y-4">
                    <div className="text-xs text-zinc-700 dark:text-zinc-300">
                        Czy na pewno chcesz bezpowrotnie usunąć dokument z wirtualnego pokoju danych?
                    </div>

                    <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded text-xs space-y-1">
                        <div className="font-bold text-zinc-900 dark:text-zinc-200 truncate">{document.title}</div>
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">Plik: {document.original_name}</div>
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400">ID: {document.id}</div>
                    </div>

                    <Tooltip content="Trwałe usunięcie jest nieodwracalne i zostanie odnotowane w ścieżce audytowej WORM">
                        <div className="text-[10px] text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 p-2.5 rounded flex items-start gap-2 cursor-help">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>
                                Operacja jest nieodwracalna. Plik binarny oraz rekord w bazie zostaną trwale wykasowane.
                            </span>
                        </div>
                    </Tooltip>

                    <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
                        <Tooltip content="Anuluj i powróć do listy dokumentów">
                            <span>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={onClose}
                                    disabled={deleting}
                                    aria-label="Anuluj"
                                >
                                    Anuluj
                                </Button>
                            </span>
                        </Tooltip>
                        <Tooltip content="Potwierdź trwałe skasowanie pliku i metadanych z VDR">
                            <span>
                                <Button
                                    variant="danger"
                                    size="sm"
                                    icon={Trash2}
                                    loading={deleting}
                                    onClick={handleDelete}
                                    aria-label="Usuń Dokument"
                                >
                                    Usuń Dokument
                                </Button>
                            </span>
                        </Tooltip>
                    </div>
                </div>
            </div>
        </div>
    );
};
