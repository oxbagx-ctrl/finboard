import React, { useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';

export const CapexStageDeleteModal = ({
    isOpen,
    stage,
    onClose,
    onConfirm,
}) => {
    const [submitting, setSubmitting] = useState(false);

    if (!isOpen || !stage) return null;

    const handleConfirm = async () => {
        setSubmitting(true);
        try {
            await onConfirm();
            onClose();
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-xs font-mono">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
                                Usunięcie Etapu CAPEX
                            </h3>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                Ta operacja zmieni sumaryczny budżet projektu
                            </p>
                        </div>
                    </div>

                    <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
                        Czy na pewno chcesz usunąć etap <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">{stage.stage_name}</strong> o wartości netto <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">{stage.formatted_net_amount || stage.net_amount + ' ' + (stage.currency || 'PLN')}</strong>?
                    </p>

                    <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1 mb-6">
                        <p>• Suma nakładów inwestycyjnych zostanie pomniejszona.</p>
                        <p>• Harmonogram amortyzacji KŚT zostanie automatycznie przeliczony.</p>
                    </div>

                    <div className="flex items-center justify-end gap-3">
                        <Tooltip content="Anuluj usuwanie i zachowaj etap w harmonogramie">
                            <span>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={onClose}
                                    disabled={submitting}
                                    aria-label="Anuluj usuwanie etapu"
                                >
                                    Anuluj
                                </Button>
                            </span>
                        </Tooltip>
                        <Tooltip content="Potwierdź usunięcie etapu i przelicz harmonogram CAPEX">
                            <span>
                                <Button
                                    type="button"
                                    variant="danger"
                                    icon={Trash2}
                                    loading={submitting}
                                    onClick={handleConfirm}
                                    data-testid="confirm-delete-stage-btn"
                                    aria-label={`Potwierdź usunięcie etapu ${stage.stage_name}`}
                                >
                                    Usuń Etap
                                </Button>
                            </span>
                        </Tooltip>
                    </div>
                </div>
            </div>
        </div>
    );
};
