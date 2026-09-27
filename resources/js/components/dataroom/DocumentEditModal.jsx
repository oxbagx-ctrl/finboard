import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useNotification } from '../../context/NotificationContext';
import { Button } from '../ui/Button';
import { Tooltip, InfoTooltip } from '../ui/Tooltip';
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
    folders = [],
}) => {
    const { success, error } = useNotification();
    const [title, setTitle] = useState('');
    const [type, setType] = useState('financial_report');
    const [folderId, setFolderId] = useState('');
    const [indexCode, setIndexCode] = useState('');
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    // Flatten tree folders for select list
    const flattenedFolders = React.useMemo(() => {
        const result = [];
        const traverse = (items, depth = 0) => {
            for (const item of items) {
                result.push({
                    id: item.id,
                    index_code: item.index_code,
                    name: item.name,
                    depth,
                });
                if (item.children && item.children.length > 0) {
                    traverse(item.children, depth + 1);
                }
            }
        };
        traverse(folders);
        return result;
    }, [folders]);

    useEffect(() => {
        if (document) {
            setTitle(document.title || '');
            setType(document.type || 'financial_report');
            setFolderId(document.folder_id || '');
            setIndexCode(document.index_code || '');
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
            const payload = {
                title: title.trim(),
                type: type,
            };

            if (folderId) {
                payload.folder_id = folderId;
            } else if (document.folder_id) {
                payload.folder_id = null;
            }

            if (indexCode.trim()) {
                payload.index_code = indexCode.trim();
            } else if (document.index_code) {
                payload.index_code = null;
            }

            await apiClient.put(`/documents/${document.id}`, payload);

            success('Zaktualizowano metadane i przypisanie folderu dokumentu VDR.');
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
                    <Tooltip content="Zamknij formularz edycji">
                        <button
                            onClick={onClose}
                            disabled={saving}
                            aria-label="Zamknij formularz"
                            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </Tooltip>
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
                        <Tooltip content={`Pełna suma kontrolna SHA-256: ${document.checksum_sha256}`}>
                            <div className="flex items-center gap-2 cursor-help">
                                <Hash className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                <span className="text-zinc-500">SHA-256:</span>
                                <span className="text-zinc-300 font-mono text-[10px] truncate">{document.checksum_sha256}</span>
                            </div>
                        </Tooltip>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-[10px] uppercase font-semibold text-zinc-400 mb-1 flex items-center gap-1.5">
                            Tytuł Biznesowy Dokumentu *
                            <InfoTooltip
                                size="xs"
                                title="Tytuł Biznesowy"
                                content="Oficjalna nazwa dokumentu widoczna dla audytorów i uczestników procesu due diligence."
                                ariaLabel="Informacje o tytule biznesowym"
                            />
                        </label>
                        <input
                            type="text"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            aria-label="Tytuł Biznesowy Dokumentu"
                            className="w-full bg-zinc-950 border border-zinc-750 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                        />
                        {errors.title && (
                            <div className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {errors.title}
                            </div>
                        )}
                    </div>

                    {/* Category & Folder Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] uppercase font-semibold text-zinc-400 mb-1 flex items-center gap-1.5">
                                Kategoria Dokumentu *
                                <InfoTooltip
                                    size="xs"
                                    title="Kategoria Dokumentu"
                                    content="Obszar transakcyjny lub merytoryczny pliku (raport finansowy, umowa, podatki, audyt, prezentacja itp.)."
                                    ariaLabel="Informacje o kategorii dokumentu"
                                />
                            </label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                aria-label="Kategoria Dokumentu"
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

                        <div>
                            <label className="block text-[10px] uppercase font-semibold text-zinc-400 mb-1 flex items-center gap-1.5">
                                Folder M&A (Dewey)
                                <InfoTooltip
                                    size="xs"
                                    title="Folder M&A"
                                    content="Przypisz dokument do pozycji w hierarchicznym drzewie taksonomii Dewey."
                                    ariaLabel="Informacje o folderze M&A"
                                />
                            </label>
                            <select
                                value={folderId}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFolderId(val);
                                    if (val) {
                                        const selected = flattenedFolders.find(f => f.id === val);
                                        if (selected && (!indexCode || indexCode === '')) {
                                            setIndexCode(`${selected.index_code}.01`);
                                        }
                                    }
                                }}
                                aria-label="Folder M&A"
                                className="w-full bg-zinc-950 border border-zinc-750 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                            >
                                <option value="">— Brak folderu (Nieprzypisany) —</option>
                                {flattenedFolders.map(f => (
                                    <option key={f.id} value={f.id} className="bg-zinc-950 text-zinc-100">
                                        {'\u00A0'.repeat(f.depth * 2)}[{f.index_code}] {f.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Dewey Index Code */}
                    <div>
                        <label className="block text-[10px] uppercase font-semibold text-zinc-400 mb-1 flex items-center gap-1.5">
                            Kod Indeksu Dewey (np. 01.01.01)
                            <InfoTooltip
                                size="xs"
                                title="Kod Indeksu Dewey"
                                content="Precyzyjny identyfikator podkatalogowy (np. 01.01.01) pozycjonujący plik w strukturze folderu."
                                ariaLabel="Informacje o kodzie Dewey"
                            />
                        </label>
                        <input
                            type="text"
                            value={indexCode}
                            onChange={(e) => setIndexCode(e.target.value)}
                            placeholder="np. 01.01.01 (opcjonalny)"
                            aria-label="Kod Indeksu Dewey"
                            className="w-full bg-zinc-950 border border-zinc-750 rounded px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                        />
                        {errors.index_code && (
                            <div className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {errors.index_code}
                            </div>
                        )}
                        <p className="text-[9px] text-zinc-500 mt-0.5">
                            Hierarchiczny identyfikator dokumentu w taksonomii Dewey.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 border-t border-zinc-800 flex items-center justify-end gap-2">
                        <Tooltip content="Odrzuć zmiany i zamknij okno edycji">
                            <span>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    type="button"
                                    onClick={onClose}
                                    disabled={saving}
                                    aria-label="Anuluj"
                                >
                                    Anuluj
                                </Button>
                            </span>
                        </Tooltip>
                        <Tooltip content="Zapisz zaktualizowane metadane dokumentu VDR">
                            <span>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    type="submit"
                                    loading={saving}
                                    aria-label="Zapisz Zmiany"
                                >
                                    Zapisz Zmiany
                                </Button>
                            </span>
                        </Tooltip>
                    </div>
                </form>
            </div>
        </div>
    );
};
