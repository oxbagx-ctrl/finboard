import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useNotification } from '../../context/NotificationContext';
import { Button } from '../ui/Button';
import { X, Edit3, AlertCircle, FileText, Hash } from 'lucide-react';

const DOCUMENT_CATEGORIES = [
    { value: 'financial_report', label: 'Raport Finansowy' },
    { value: 'contract', label: 'Umowa / Aneks' },
    { value: 'tax_declaration', label: 'Deklaracja Podatkowa' },
    { value: 'audit_report', label: 'Raport z Audytu' },
    { value: 'presentation', label: 'Prezentacja Inwestorska' },
    { value: 'other', label: 'Inny Dokument' },
];

export const DocumentEditModal = ({
    document,
    isOpen,
    onClose,
    onSuccess,
}) => {
    const { success, error } = useNotification();
    const [title, setTitle] = useState('');
    const [type, setType] = useState('financial_report');
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (document) {
            setTitle(document.title || '');
            setType(document.type || 'financial_report');
            setErrors({});
        }
    }, [document, isOpen]);

    if (!isOpen || !document) return null;

    const validate = () => {
        const errs = {};
        if (!title.trim()) errs.title = 'Tytuł biznesowy dokumentu jest wymagany.';
        if (!type) errs.type = 'Kategoria dokumentu jest wymagana.';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setSaving(true);
        setErrors({});

        try {
            await apiClient.put(`/documents/${document.id}`, {
                title: title.trim(),
                type: type,
            });

            success('Zaktualizowano metadane dokumentu VDR.');
            onSuccess();
            onClose();
        } catch (err) {
            const errData = err.response?.data;
            if (errData?.errors) {
                setErrors(errData.errors);
            } else {
                error(errData?.message || 'Wystąpił błąd podczas aktualizacji dokumentu.');
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-xs font-mono">
            <div className="bg-zinc-900 border border-zinc-750 rounded-lg shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="px-5 py-3.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-zinc-850 border border-zinc-750 flex items-center justify-center text-zinc-300">
                            <Edit3 className="w-3.5 h-3.5" />
                        </div>
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-100">
                                Edycja Metadanych Dokumentu VDR
                            </h2>
                            <p className="text-[10px] text-zinc-500">
                                ID: {document.id}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Readonly info */}
                    <div className="bg-zinc-950 border border-zinc-800 rounded p-3 text-[11px] space-y-1.5 text-zinc-400">
                        <div className="flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            <span className="text-zinc-500">Plik źródłowy:</span>
                            <span className="text-zinc-200 font-semibold truncate">{document.original_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Hash className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            <span className="text-zinc-500">SHA-256:</span>
                            <span className="text-zinc-300 font-mono text-[10px] truncate">{document.checksum_sha256}</span>
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-[10px] uppercase font-semibold text-zinc-400 mb-1">
                            Tytuł Biznesowy Dokumentu
                        </label>
                        <input
                            type="text"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-750 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                        />
                        {errors.title && (
                            <div className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {errors.title}
                            </div>
                        )}
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-[10px] uppercase font-semibold text-zinc-400 mb-1">
                            Kategoria Taksonomiczna Due Diligence
                        </label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-750 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                        >
                            {DOCUMENT_CATEGORIES.map(cat => (
                                <option key={cat.value} value={cat.value} className="bg-zinc-950 text-zinc-100">
                                    {cat.label}
                                </option>
                            ))}
                        </select>
                        {errors.type && (
                            <div className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {errors.type}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="pt-2 border-t border-zinc-800 flex items-center justify-end gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                        >
                            Anuluj
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            type="submit"
                            loading={saving}
                        >
                            Zapisz Zmiany
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
