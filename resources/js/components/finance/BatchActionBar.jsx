import React from 'react';
import { CheckSquare, Trash2, X, Layers } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { Tooltip } from '../ui/Tooltip';


export const BatchActionBar = ({
    selectedCount,
    totalAmount,
    incomeAmount = 0,
    expenseAmount = 0,
    currency = 'PLN',
    onClearSelection,
    onOpenBatchDelete,
    disabled = false
}) => {
    if (selectedCount <= 0) {
        return null;
    }

    return (
        <div
            data-testid="batch-action-bar"
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-4xl w-[92%] sm:w-auto bg-zinc-900/95 backdrop-blur-md border border-zinc-700/90 shadow-2xl rounded-xl px-4 py-2.5 sm:px-5 sm:py-3 flex flex-wrap items-center justify-between sm:justify-start gap-4 sm:gap-6 text-xs text-zinc-200 animate-in fade-in slide-in-from-bottom-4 duration-200 font-mono"
        >
            {/* Selected Count Indicator */}
            <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <CheckSquare className="w-3.5 h-3.5" />
                </span>
                <span className="text-zinc-300">
                    Zaznaczono:{' '}
                    <strong className="text-white text-sm tabular-nums" data-testid="batch-selected-count">
                        {selectedCount}
                    </strong>
                </span>
            </div>

            {/* Divider */}
            <div className="hidden sm:block h-5 w-px bg-zinc-800" aria-hidden="true" />

            {/* Aggregated Total Value */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                    <span className="text-zinc-400 uppercase text-[10px] tracking-wider">Łączna wartość:</span>
                    <span
                        className="font-bold text-sm text-zinc-100 tabular-nums"
                        data-testid="batch-total-amount"
                    >
                        {formatCurrency(totalAmount, currency)}
                    </span>
                </div>

                {/* Optional breakdown when both income and expense present */}
                {(incomeAmount > 0 || expenseAmount > 0) && (
                    <div className="hidden md:flex items-center gap-2 text-[11px] text-zinc-400 border-l border-zinc-800 pl-3">
                        {incomeAmount > 0 && (
                            <span className="text-emerald-400 font-medium">
                                +{formatCurrency(incomeAmount, currency)}
                            </span>
                        )}
                        {incomeAmount > 0 && expenseAmount > 0 && <span className="text-zinc-600">|</span>}
                        {expenseAmount > 0 && (
                            <span className="text-rose-400 font-medium">
                                -{formatCurrency(expenseAmount, currency)}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end ml-auto">
                <Tooltip content="Odznacz wszystkie zaznaczone transakcje">
                    <button
                        type="button"
                        onClick={onClearSelection}
                        disabled={disabled}
                        aria-label="Odznacz wszystkie zaznaczone transakcje"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-750 text-zinc-300 hover:text-white transition-colors text-xs font-sans disabled:opacity-50 cursor-pointer"
                        data-testid="batch-clear-btn"
                    >
                        <X className="w-3.5 h-3.5" />
                        <span>Odznacz</span>
                    </button>
                </Tooltip>

                <Tooltip content="Usuń wybrane transakcje">
                    <button
                        type="button"
                        onClick={onOpenBatchDelete}
                        disabled={disabled}
                        aria-label="Usuń wybrane transakcje"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-medium shadow-sm transition-colors text-xs font-sans disabled:opacity-50 cursor-pointer"
                        data-testid="batch-delete-btn"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Usuń zaznaczone</span>
                    </button>
                </Tooltip>
            </div>
        </div>
    );
};



