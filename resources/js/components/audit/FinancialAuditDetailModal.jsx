import React, { useEffect, useCallback } from 'react';
import {
    X,
    Shield,
    Activity,
    User,
    Globe,
    Monitor,
    Database,
    Clock,
    FileText,
    AlertTriangle,
    Trash2,
    CheckCircle2,
    Layers,
    ArrowRightLeft,
    Tag
} from 'lucide-react';
import { formatDateTime, formatCurrency } from '../../utils/formatters';
import { Button } from '../ui/Button';
import { AuditActionBadge, getAuditBadgeColorClass as getActionBadgeClass } from './AuditActionBadge';

/**
 * Pretty-formats JSON value or returns null if empty.
 */
const formatJson = (val) => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'object' && Object.keys(val).length === 0) return null;
    try {
        return JSON.stringify(val, null, 2);
    } catch {
        return String(val);
    }
};

export const FinancialAuditDetailModal = ({ isOpen, onClose, log }) => {
    // Handle Escape key listener
    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === 'Escape' && isOpen && onClose) {
                onClose();
            }
        },
        [isOpen, onClose]
    );

    useEffect(() => {
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, handleKeyDown]);

    if (!isOpen || !log) return null;

    const isDelete = log.action === 'RECORD_DELETED' || log.action === 'RECORDS_BATCH_DELETED';
    const isBatchDelete = log.action === 'RECORDS_BATCH_DELETED';
    const oldValuesFormatted = formatJson(log.old_values);
    const newValuesFormatted = formatJson(log.new_values);

    const oldVals = log.old_values || {};

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-xs font-mono"
            onClick={onClose}
            data-testid="financial-audit-detail-modal"
        >
            <div
                className="bg-zinc-900 border border-zinc-750 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="px-5 py-3.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded bg-zinc-850 border border-zinc-750 flex items-center justify-center text-zinc-300 shrink-0">
                            <Shield className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-100 truncate">
                                    Inspekcja Wpisu Audytowego
                                </h2>
                                <AuditActionBadge
                                    action={log.action}
                                    label={log.action_label}
                                    color={log.action_color}
                                    category={log.action_category}
                                    testId="audit-modal-action-badge"
                                />
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-zinc-500 mt-0.5 truncate">
                                <span className="flex items-center gap-1 text-zinc-400">
                                    <Clock className="w-3 h-3 text-zinc-500" />
                                    {formatDateTime(log.created_at)} (CET)
                                </span>
                                <span className="text-zinc-600">|</span>
                                <span className="text-zinc-500 font-mono select-all truncate" title={log.id}>
                                    ID: {log.id}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors p-1.5 rounded hover:bg-zinc-800 cursor-pointer ml-3 shrink-0"
                        data-testid="audit-modal-close-btn"
                        title="Zamknij"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Modal Body - Scrollable */}
                <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
                    {/* Event Description Banner */}
                    {log.description && (
                        <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 text-zinc-200 flex items-start gap-2.5">
                            <FileText className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                            <div className="flex-1 text-[11px] leading-relaxed">
                                <span className="text-zinc-400 uppercase tracking-wider text-[10px] block font-semibold mb-0.5">
                                    Opis Operacji:
                                </span>
                                <span className="text-zinc-100">{log.description}</span>
                            </div>
                        </div>
                    )}

                    {/* Prominent Deletion Highlight Banner */}
                    {isDelete && (
                        <div
                            className="p-3.5 rounded-lg bg-rose-950/30 border border-rose-900/60 text-rose-200 space-y-2 font-sans"
                            data-testid="audit-modal-deleted-summary"
                        >
                            <div className="flex items-center gap-2 text-rose-300 font-semibold font-mono text-xs uppercase">
                                <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
                                <span>Szczegóły operacji niszczącej (Usunięcie danych)</span>
                            </div>

                            {isBatchDelete ? (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs font-mono">
                                    <div className="p-2 rounded bg-rose-950/50 border border-rose-900/40">
                                        <div className="text-[10px] text-rose-400 uppercase">Liczba Usuniętych</div>
                                        <div className="text-sm font-bold text-white tabular-nums mt-0.5">
                                            {oldVals.count ?? oldVals.record_ids?.length ?? 0} rekordów
                                        </div>
                                    </div>
                                    <div className="p-2 rounded bg-rose-950/50 border border-rose-900/40 sm:col-span-2">
                                        <div className="text-[10px] text-rose-400 uppercase">Łączna Usunięta Kwota</div>
                                        <div className="text-sm font-bold text-white tabular-nums mt-0.5">
                                            {formatCurrency(oldVals.total_amount ?? 0, 'PLN')}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs font-mono">
                                    <div className="p-2 rounded bg-rose-950/50 border border-rose-900/40">
                                        <div className="text-[10px] text-rose-400 uppercase">Kwota Transakcji</div>
                                        <div className="text-sm font-bold text-white tabular-nums mt-0.5">
                                            {formatCurrency(oldVals.amount ?? 0, oldVals.currency || 'PLN')}
                                        </div>
                                    </div>
                                    <div className="p-2 rounded bg-rose-950/50 border border-rose-900/40">
                                        <div className="text-[10px] text-rose-400 uppercase">Data Transakcji</div>
                                        <div className="text-sm font-bold text-zinc-100 mt-0.5">
                                            {oldVals.record_date || '—'}
                                        </div>
                                    </div>
                                    <div className="p-2 rounded bg-rose-950/50 border border-rose-900/40">
                                        <div className="text-[10px] text-rose-400 uppercase">Typ / Kategoria</div>
                                        <div className="text-sm font-bold text-zinc-100 truncate mt-0.5" title={oldVals.category || oldVals.record_type}>
                                            {oldVals.record_type || 'EXPENSE'} {oldVals.category ? `(${oldVals.category})` : ''}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Operator / Actor Profile */}
                        <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 space-y-2">
                            <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                                <span className="text-[10px] uppercase text-zinc-500 font-bold flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-zinc-400" />
                                    Operator (Użytkownik)
                                </span>
                                {log.user?.role && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-800 border border-zinc-700 text-zinc-300">
                                        {log.user.role}
                                    </span>
                                )}
                            </div>

                            <div className="text-xs space-y-1 pt-0.5" data-testid="audit-modal-operator">
                                <div className="text-zinc-100 font-semibold truncate">
                                    {log.user?.name || 'System / Zadanie Automatyczne'}
                                </div>
                                <div className="text-zinc-400 text-[11px] truncate">
                                    {log.user?.email || `ID użytkownika: ${log.user_id || 'Brak'}`}
                                </div>
                            </div>
                        </div>

                        {/* Network & Device Context */}
                        <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 space-y-2">
                            <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                                <span className="text-[10px] uppercase text-zinc-500 font-bold flex items-center gap-1.5">
                                    <Globe className="w-3.5 h-3.5 text-zinc-400" />
                                    Środowisko i Sieć
                                </span>
                            </div>

                            <div className="text-xs space-y-1.5 pt-0.5">
                                <div className="flex items-center justify-between text-[11px]" data-testid="audit-modal-ip">
                                    <span className="text-zinc-500">Adres IP:</span>
                                    <span className="text-zinc-200 font-mono">{log.ip_address || '127.0.0.1 / Wewnętrzny'}</span>
                                </div>
                                <div className="flex items-start justify-between text-[11px] gap-2">
                                    <span className="text-zinc-500 shrink-0">Klient / Agent:</span>
                                    <span className="text-zinc-400 font-mono text-[10px] truncate max-w-[220px]" title={log.user_agent}>
                                        {log.user_agent || 'FinBoard HTTP Client'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Resource Target Details */}
                    <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Database className="w-4 h-4 text-zinc-400" />
                            <span className="text-zinc-400 text-[11px]">Dotyczy encji:</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-850 border border-zinc-750 text-zinc-200 uppercase font-semibold">
                                {log.entity_type || 'Rekord Finansowy'}
                            </span>
                        </div>
                        <div className="text-[11px] font-mono text-zinc-400 truncate" data-testid="audit-modal-entity-id">
                            <span className="text-zinc-500">ID encji: </span>
                            <span className="text-zinc-200 select-all">{log.entity_id || '—'}</span>
                        </div>
                    </div>

                    {/* JSON Snapshot Diff Section */}
                    <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                                <ArrowRightLeft className="w-3.5 h-3.5 text-zinc-400" />
                                Zrzut Stanu Danych (JSON Snapshots)
                            </span>
                            <span className="text-[10px] text-zinc-500 font-normal">
                                Porównanie wartości przed i po modyfikacji
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Old Values Snapshot */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[11px] px-1">
                                    <span className="text-rose-400 font-semibold uppercase flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-rose-500/80 inline-block" />
                                        Stan Początkowy (old_values)
                                    </span>
                                    {oldValuesFormatted && (
                                        <span className="text-[10px] text-zinc-500">
                                            {Object.keys(oldVals).length} pól
                                        </span>
                                    )}
                                </div>

                                <div
                                    className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] leading-relaxed font-mono min-h-[140px] max-h-[260px] overflow-auto text-zinc-300"
                                    data-testid="audit-modal-old-values"
                                >
                                    {oldValuesFormatted ? (
                                        <pre className="whitespace-pre-wrap break-words">{oldValuesFormatted}</pre>
                                    ) : (
                                        <div className="text-zinc-600 italic flex items-center justify-center h-full min-h-[100px] text-center p-4">
                                            Brak wartości początkowych
                                            <br />
                                            (Nowy wpis lub brak wcześniejszego stanu)
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* New Values Snapshot */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[11px] px-1">
                                    <span className="text-emerald-400 font-semibold uppercase flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500/80 inline-block" />
                                        Stan Końcowy (new_values)
                                    </span>
                                    {newValuesFormatted && (
                                        <span className="text-[10px] text-zinc-500">
                                            {Object.keys(log.new_values || {}).length} pól
                                        </span>
                                    )}
                                </div>

                                <div
                                    className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] leading-relaxed font-mono min-h-[140px] max-h-[260px] overflow-auto text-zinc-300"
                                    data-testid="audit-modal-new-values"
                                >
                                    {newValuesFormatted ? (
                                        <pre className="whitespace-pre-wrap break-words">{newValuesFormatted}</pre>
                                    ) : (
                                        <div className="text-zinc-600 italic flex items-center justify-center h-full min-h-[100px] text-center p-4">
                                            Brak nowych wartości
                                            <br />
                                            (Rekord został usunięty z bazy danych)
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="px-5 py-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between shrink-0">
                    <div className="text-[10px] text-zinc-500 hidden sm:block">
                        Podmiot: {log.company_id} | Integralność kryptograficzna audytu
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onClose}
                        className="ml-auto"
                        data-testid="audit-modal-footer-close-btn"
                    >
                        Zamknij Podgląd
                    </Button>
                </div>
            </div>
        </div>
    );
};
