import React, { useState } from 'react';
import apiClient from '../../api/client';
import { useNotification } from '../../context/NotificationContext';
import { Button } from '../ui/Button';
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
            <div className="bg-zinc-900 border border-zinc-750 rounded-lg shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="px-5 py-3.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-400">
                        <AlertTriangle className="w-4 h-4" />
                        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-100">
                            Potwierdzenie Usunięcia Dokumentu
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={deleting}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <div className="text-xs text-zinc-300">
                        Czy na pewno chcesz bezpowrotnie usunąć dokument z wirtualnego pokoju danych?
                    </div>

                    <div className="p-3 bg-zinc-950 border border-zinc-800 rounded text-xs space-y-1">
                        <div className="font-bold text-zinc-200 truncate">{document.title}</div>
                        <div className="text-[10px] text-zinc-500 truncate">Plik: {document.original_name}</div>
                        <div className="text-[10px] text-zinc-500">ID: {document.id}</div>
                    </div>

                    <div className="text-[10px] text-rose-400 bg-rose-950/30 border border-rose-900/60 p-2.5 rounded flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                            Operacja jest nieodwracalna. Plik binarny oraz rekord w bazie zostaną trwale wykasowane.
                        </span>
                    </div>

                    <div className="pt-2 border-t border-zinc-800 flex items-center justify-end gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={onClose}
                            disabled={deleting}
                        >
                            Anuluj
                        </Button>
                        <Button
                            variant="danger"
                            size="sm"
                            icon={Trash2}
                            loading={deleting}
                            onClick={handleDelete}
                        >
                            Usuń Dokument
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
