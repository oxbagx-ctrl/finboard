import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useNotification } from '../../context/NotificationContext';
import { Button } from '../ui/Button';
import { X, FolderPlus, AlertCircle, FolderTree, Hash, FileText } from 'lucide-react';

export const CreateFolderModal = ({
    isOpen,
    onClose,
    onSuccess,
    folders = [],
    defaultParentId = '',
}) => {
    const { success, error } = useNotification();

    const [parentId, setParentId] = useState('');
    const [indexCode, setIndexCode] = useState('');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [sortOrder, setSortOrder] = useState('10');
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    // Flatten folders list for parent select
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
        if (isOpen) {
            setParentId(defaultParentId || '');
            setIndexCode('');
            setName('');
            setDescription('');
            setSortOrder('10');
            setErrors({});
        }
    }, [isOpen, defaultParentId]);

    // Suggest index code prefix when parent changes
    const handleParentChange = (e) => {
        const newParentId = e.target.value;
        setParentId(newParentId);

        if (!newParentId) {
            // Suggest next root code
            const rootCodes = folders.map(f => parseFloat(f.index_code)).filter(n => !isNaN(n));
            const maxRoot = rootCodes.length > 0 ? Math.max(...rootCodes) : 0;
            const nextRoot = Math.floor(maxRoot) + 1;
            setIndexCode(nextRoot < 10 ? `0${nextRoot}.00` : `${nextRoot}.00`);
        } else {
            const parent = flattenedFolders.find(f => f.id === newParentId);
            if (parent) {
                setIndexCode(`${parent.index_code}.`);
            }
        }
    };

    if (!isOpen) return null;

    const validate = () => {
        const errs = {};
        if (!name.trim()) errs.name = 'Nazwa folderu transakcyjnego jest wymagana.';
        if (!indexCode.trim()) {
            errs.index_code = 'Kod indeksu dziesiętnego Dewey jest wymagany.';
        } else if (!/^\d+(\.\d+)*$/.test(indexCode.trim())) {
            errs.index_code = 'Niepoprawny format kodu Dewey (dozwolone np. 01.00 lub 01.01.02).';
        }
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
                name: name.trim(),
                index_code: indexCode.trim(),
                parent_id: parentId || null,
                description: description.trim() || null,
                sort_order: parseInt(sortOrder, 10) || 0,
            };

            const res = await apiClient.post('/documents/folders', payload);
            success(`Folder "${name.trim()}" (${indexCode.trim()}) został pomyślnie utworzony.`);
            onSuccess(res.data?.data);
            onClose();
        } catch (err) {
            const errData = err.response?.data;
            if (errData?.errors) {
                setErrors(errData.errors);
            } else {
                error(errData?.message || 'Wystąpił błąd podczas tworzenia folderu.');
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
                            <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-100">
                                Nowy Folder Transakcyjny (Dewey)
                            </h2>
                            <p className="text-[10px] text-zinc-500">
                                HIERARCHIA STRUKTURY DUE DILIGENCE M&A
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
                    {/* Parent Folder selection */}
                    <div>
                        <label className="block text-[11px] font-semibold text-zinc-300 mb-1 flex items-center gap-1.5">
                            <FolderTree className="w-3.5 h-3.5 text-zinc-400" />
                            Folder Nadrzędny (Katalog)
                        </label>
                        <select
                            value={parentId}
                            onChange={handleParentChange}
                            disabled={saving}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                        >
                            <option value="">— Kategoria Główna (Root) —</option>
                            {flattenedFolders.map(f => (
                                <option key={f.id} value={f.id}>
                                    {'\u00A0'.repeat(f.depth * 3)}[{f.index_code}] {f.name}
                                </option>
                            ))}
                        </select>
                        <p className="text-[10px] text-zinc-500 mt-1">
                            Wybierz folder rodzica, aby utworzyć podkategorię w drzewie.
                        </p>
                    </div>

                    {/* Dewey Index Code & Sort Order row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-semibold text-zinc-300 mb-1 flex items-center gap-1.5">
                                <Hash className="w-3.5 h-3.5 text-indigo-400" />
                                Kod Dewey *
                            </label>
                            <input
                                type="text"
                                value={indexCode}
                                onChange={(e) => setIndexCode(e.target.value)}
                                placeholder="np. 01.00 lub 01.01.02"
                                disabled={saving}
                                className={`w-full bg-zinc-950 border rounded px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 ${
                                    errors.index_code
                                        ? 'border-rose-500 focus:ring-rose-400'
                                        : 'border-zinc-800 focus:ring-zinc-400'
                                }`}
                            />
                            {errors.index_code && (
                                <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3 shrink-0" />
                                    {Array.isArray(errors.index_code) ? errors.index_code[0] : errors.index_code}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                                Kolejność Sortowania
                            </label>
                            <input
                                type="number"
                                value={sortOrder}
                                onChange={(e) => setSortOrder(e.target.value)}
                                min="0"
                                max="999"
                                disabled={saving}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                            />
                        </div>
                    </div>

                    {/* Folder Name */}
                    <div>
                        <label className="block text-[11px] font-semibold text-zinc-300 mb-1 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-emerald-400" />
                            Nazwa Folderu *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="np. Umowy Finansowania i Kredyty"
                            disabled={saving}
                            className={`w-full bg-zinc-950 border rounded px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 ${
                                errors.name
                                    ? 'border-rose-500 focus:ring-rose-400'
                                    : 'border-zinc-800 focus:ring-zinc-400'
                            }`}
                        />
                        {errors.name && (
                            <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 shrink-0" />
                                {Array.isArray(errors.name) ? errors.name[0] : errors.name}
                            </p>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                            Opis / Zakres Dokumentów (opcjonalny)
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Krótki opis przeznaczenia folderu transakcyjnego..."
                            rows={2}
                            disabled={saving}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 resize-none"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={saving}
                            onClick={onClose}
                        >
                            Anuluj
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                            loading={saving}
                            icon={FolderPlus}
                        >
                            Utwórz Folder
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
