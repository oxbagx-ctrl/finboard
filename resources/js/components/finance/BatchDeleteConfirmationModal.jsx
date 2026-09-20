import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, X, ShieldAlert } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../ui/Button';

export const MAX_BATCH_DELETE_SIZE = 500;

export const BatchDeleteConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    selectedCount = 0,
    totalAmount = 0,
    incomeAmount = 0,
    expenseAmount = 0,
    currency = 'PLN',
    loading = false,
}) => {
    const [confirmText, setConfirmText] = useState('');
    const isExceeded = selectedCount > MAX_BATCH_DELETE_SIZE;
    const requiresKeyword = selectedCount > 10 && !isExceeded;
    const isKeywordValid = !requiresKeyword || confirmText.trim().toUpperCase() === 'USUŃ';
    const canConfirm = !isExceeded && isKeywordValid && !loading;

    useEffect(() => {
        if (isOpen) {
            setConfirmText('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (canConfirm && onConfirm) {
            onConfirm();
        }
    };

    const getItemsLabel = (count) => {
        if (count === 1) return 'transakcję';
        if (count >= 2 && count <= 4) return 'transakcje';
        return 'transakcji';
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-xs font-mono"
            data-testid="batch-delete-modal"
        >
            <div className="bg-zinc-900 border border-zinc-750 rounded-lg shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Modal Header */}
                <div className="px-5 py-3.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                            <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-wider text-rose-300">
                                Potwierdzenie Masowego Usunięcia
                            </h2>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
                                Audytowana operacja niszcząca
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
                        data-testid="batch-modal-close-btn"
                        title="Zamknij"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleFormSubmit}>
                    <div className="p-5 space-y-4 font-sans text-xs">
                        {/* Main Warning Banner */}
                        <div className="p-3.5 rounded-lg bg-rose-950/20 border border-rose-900/40 text-rose-200 text-xs leading-relaxed flex items-start gap-3">
                            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-rose-300">
                                    Zamierzasz bezpowrotnie usunąć{' '}
                                    <span className="font-mono font-bold text-white tabular-nums" data-testid="batch-modal-count">
                                        {selectedCount}
                                    </span>{' '}
                                    {getItemsLabel(selectedCount)} o łącznej wartości{' '}
                                    <span className="font-mono font-bold text-white tabular-nums" data-testid="batch-modal-total">
                                        {formatCurrency(totalAmount, currency)}
                                    </span>.
                                </p>
                                <p className="text-[11px] text-rose-300/80 mt-1">
                                    Operacja jest nieodwracalna. Rekordy zostaną usunięte z bazy danych, a zdarzenie zostanie zarejestrowane w rejestrze audytowym spółki.
                                </p>
                            </div>
                        </div>

                        {/* Financial Metrics Summary Breakdown */}
                        <div className="bg-zinc-950/60 border border-zinc-800 rounded-lg p-3 grid grid-cols-2 gap-3 font-mono">
                            <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800/80">
                                <span className="text-[10px] uppercase text-zinc-500 block mb-1">Przychody (Income)</span>
                                <span className="text-emerald-400 font-bold text-sm tabular-nums" data-testid="batch-modal-income">
                                    {formatCurrency(incomeAmount, currency)}
                                </span>
                            </div>
                            <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800/80">
                                <span className="text-[10px] uppercase text-zinc-500 block mb-1">Koszty (Expense)</span>
                                <span className="text-rose-400 font-bold text-sm tabular-nums" data-testid="batch-modal-expense">
                                    {formatCurrency(expenseAmount, currency)}
                                </span>
                            </div>
                        </div>

                        {/* Exceeded batch limit warning */}
                        {isExceeded && (
                            <div
                                className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2.5 font-mono leading-relaxed"
                                data-testid="batch-limit-exceeded-alert"
                            >
                                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                                <span>
                                    Przekroczono maksymalny limit operacji masowej (500 rekordów). Wybrano {selectedCount} pozycji. Zmniejsz liczbę zaznaczonych transakcji, aby kontynuować.
                                </span>
                            </div>
                        )}

                        {/* Keyword Safety Input for batches > 10 */}
                        {requiresKeyword && (
                            <div className="space-y-2 pt-1 border-t border-zinc-800" data-testid="batch-keyword-section">
                                <label className="block text-[11px] text-zinc-300" htmlFor="batch-confirm-input-field">
                                    Ze względów bezpieczeństwa (operacja dotyczy ponad 10 rekordów), wpisz słowo{' '}
                                    <span className="font-mono font-bold text-rose-400 select-all">USUŃ</span> w poniższym polu:
                                </label>
                                <input
                                    id="batch-confirm-input-field"
                                    type="text"
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    placeholder='Wpisz "USUŃ"'
                                    disabled={loading}
                                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 uppercase transition-colors"
                                    data-testid="batch-confirm-input"
                                    autoFocus
                                />
                            </div>
                        )}
                    </div>

                    {/* Modal Footer */}
                    <div className="px-5 py-3.5 bg-zinc-950 border-t border-zinc-800 flex items-center justify-end gap-3 font-sans">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={onClose}
                            disabled={loading}
                            data-testid="batch-modal-cancel-btn"
                        >
                            Anuluj
                        </Button>
                        <Button
                            type="submit"
                            variant="danger"
                            size="sm"
                            loading={loading}
                            disabled={!canConfirm}
                            icon={Trash2}
                            data-testid="batch-confirm-delete-btn"
                            className={!canConfirm ? 'opacity-40 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-500 text-white font-semibold'}
                        >
                            {loading ? 'Usuwanie...' : 'Potwierdź usunięcie'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
