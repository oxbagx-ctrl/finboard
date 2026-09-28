import React, { useState, useRef, useEffect } from 'react';
import apiClient from '../../api/client';
import { useNotification } from '../../context/NotificationContext';
import { Button } from '../ui/Button';
import { Tooltip, InfoTooltip } from '../ui/Tooltip';
import {
    X,
    UploadCloud,
    FileText,
    AlertCircle,
    CheckCircle2,
    Shield,
    FolderTree,
    Hash
} from 'lucide-react';
import { formatFileSize } from '../../utils/formatters';

const DOCUMENT_CATEGORIES = [
    { value: 'financial_report', label: 'Raport Finansowy' },
    { value: 'contract', label: 'Umowa / Aneks' },
    { value: 'tax_declaration', label: 'Deklaracja Podatkowa' },
    { value: 'audit_report', label: 'Raport z Audytu' },
    { value: 'presentation', label: 'Prezentacja Inwestorska' },
    { value: 'other', label: 'Inny Dokument' },
];

export const DocumentUploadModal = ({
    isOpen,
    onClose,
    onSuccess,
    folders = [],
    defaultFolderId = '',
}) => {
    const { success, error } = useNotification();
    const fileInputRef = useRef(null);

    const [file, setFile] = useState(null);
    const [title, setTitle] = useState('');
    const [type, setType] = useState('financial_report');
    const [folderId, setFolderId] = useState('');
    const [indexCode, setIndexCode] = useState('');
    const [watermarkRequired, setWatermarkRequired] = useState(false);
    const [uploading, setUploading] = useState(false);
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
        if (isOpen) {
            setFolderId(defaultFolderId || '');
            if (defaultFolderId) {
                const folder = flattenedFolders.find(f => f.id === defaultFolderId);
                if (folder) {
                    setIndexCode(`${folder.index_code}.01`);
                }
            }
        }
    }, [isOpen, defaultFolderId, flattenedFolders]);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const selected = e.target.files[0];
        if (selected) {
            setFile(selected);
            if (!title) {
                // Auto-fill title from filename removing extension
                const cleanName = selected.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
                setTitle(cleanName);
            }
            if (errors.file) {
                setErrors(prev => ({ ...prev, file: null }));
            }
        }
    };

    const handleFolderChange = (e) => {
        const selectedId = e.target.value;
        setFolderId(selectedId);
        if (selectedId) {
            const folder = flattenedFolders.find(f => f.id === selectedId);
            if (folder && (!indexCode || indexCode.startsWith(folder.index_code))) {
                setIndexCode(`${folder.index_code}.01`);
            }
        }
    };

    const validate = () => {
        const errs = {};
        if (!file) errs.file = 'Wybór pliku jest wymagany.';
        if (!title.trim()) errs.title = 'Tytuł biznesowy dokumentu jest wymagany.';
        if (!type) errs.type = 'Kategoria dokumentu jest wymagana.';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setUploading(true);
        setErrors({});

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('title', title.trim());
            formData.append('type', type);
            if (folderId) formData.append('folder_id', folderId);
            if (indexCode.trim()) formData.append('index_code', indexCode.trim());
            if (watermarkRequired) formData.append('watermark_required', '1');

            await apiClient.post('/documents', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            success('Dokument został pomyślnie zdeponowany i zarejestrowany w VDR.');
            onSuccess();
            onClose();
            // Reset
            setFile(null);
            setTitle('');
            setType('financial_report');
            setFolderId('');
            setIndexCode('');
            setWatermarkRequired(false);
        } catch (err) {
            const errData = err.response?.data;
            if (errData?.errors) {
                setErrors(errData.errors);
            } else {
                error(errData?.message || 'Wystąpił błąd podczas deponowania pliku w VDR.');
            }
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-xs font-mono">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-750 rounded-lg shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="px-5 py-3.5 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-750 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                            <UploadCloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                                Deponowanie Dokumentu w VDR
                            </h2>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                SZYFROWANY ZAPIS Z SUMĄ KONTROLNĄ SHA-256
                            </p>
                        </div>
                    </div>
                    <Tooltip content="Zamknij formularz deponowania dokumentu">
                        <button
                            onClick={onClose}
                            disabled={uploading}
                            aria-label="Zamknij formularz deponowania"
                            className="p-1 rounded text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </Tooltip>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* File Dropzone / Picker */}
                    <div>
                        <label className="block text-[10px] uppercase font-semibold text-zinc-600 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
                            Plik Źródłowy *
                            <InfoTooltip
                                size="xs"
                                title="Plik Źródłowy"
                                content="Dozwolone formaty: PDF, arkusze kalkulacyjne XLSX/XLS, dokumenty tekstowe DOCX oraz archiwa ZIP do 50 MB."
                                ariaLabel="Informacje o pliku źródłowym"
                            />
                        </label>
                        <Tooltip content="Kliknij lub przeciągnij plik dokumentu do zdeponowania w bezpiecznym VDR">
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                                    file
                                        ? 'border-emerald-600/60 bg-emerald-50 dark:bg-emerald-950/20'
                                        : errors.file
                                            ? 'border-rose-400 dark:border-rose-600/60 bg-rose-50 dark:bg-rose-950/20'
                                            : 'border-zinc-300 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-650 bg-zinc-50 dark:bg-zinc-950/50'
                                }`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    onChange={handleFileChange}
                                    aria-label="Wybierz plik do wgrania"
                                    className="hidden"
                                    accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.ppt,.pptx,.zip"
                                />

                                {file ? (
                                    <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs">
                                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                                        <span className="font-bold truncate max-w-xs">{file.name}</span>
                                        <span className="text-zinc-500 dark:text-zinc-400 text-[10px]">({formatFileSize(file.size)})</span>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <FileText className="w-6 h-6 mx-auto text-zinc-400 dark:text-zinc-500" />
                                        <div className="text-xs text-zinc-700 dark:text-zinc-300">
                                            Kliknij, aby wybrać plik lub upuść go tutaj
                                        </div>
                                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                            PDF, XLSX, DOCX, ZIP (maks. 50 MB)
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Tooltip>
                        {errors.file && (
                            <div className="text-[10px] text-rose-500 dark:text-rose-400 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {errors.file}
                            </div>
                        )}
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-[10px] uppercase font-semibold text-zinc-600 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
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
                            placeholder="np. Sprawozdanie Finansowe 2025 ze stemplem biegłego"
                            aria-label="Tytuł Biznesowy Dokumentu"
                            className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-750 rounded px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                        />
                        {errors.title && (
                            <div className="text-[10px] text-rose-500 dark:text-rose-400 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {errors.title}
                            </div>
                        )}
                    </div>

                    {/* Category & Folder */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] uppercase font-semibold text-zinc-600 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
                                Kategoria Due Diligence *
                                <InfoTooltip
                                    size="xs"
                                    title="Kategoria Due Diligence"
                                    content="Obszar transakcyjny lub merytoryczny pliku (raport finansowy, umowa, podatki, audyt itp.)."
                                    ariaLabel="Informacje o kategorii Due Diligence"
                                />
                            </label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                aria-label="Kategoria Due Diligence"
                                className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-750 rounded px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                            >
                                {DOCUMENT_CATEGORIES.map(cat => (
                                    <option key={cat.value} value={cat.value}>
                                        {cat.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] uppercase font-semibold text-zinc-600 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
                                <FolderTree className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
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
                                onChange={handleFolderChange}
                                aria-label="Folder M&A"
                                className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-750 rounded px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                            >
                                <option value="">— Brak folderu (Nieprzypisany) —</option>
                                {flattenedFolders.map(f => (
                                    <option key={f.id} value={f.id}>
                                        {'\u00A0'.repeat(f.depth * 2)}[{f.index_code}] {f.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Dewey Index Code & Watermark */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                        <div>
                            <label className="block text-[10px] uppercase font-semibold text-zinc-600 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
                                <Hash className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                Kod Indeksu Dewey
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
                                className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-750 rounded px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                            />
                        </div>

                        <div className="pt-4 sm:pt-3">
                            <Tooltip content="Wymuś nanoszenie znaku wodnego z danymi tożsamości i adresem IP przy podglądzie i pobieraniu pliku PDF">
                                <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-700 dark:text-zinc-300 select-none">
                                    <input
                                        type="checkbox"
                                        checked={watermarkRequired}
                                        onChange={(e) => setWatermarkRequired(e.target.checked)}
                                        aria-label="Wymagaj dynamicznego znaku wodnego"
                                        className="rounded border-zinc-300 dark:border-zinc-750 bg-white dark:bg-zinc-950 text-emerald-600 focus:ring-0 focus:ring-offset-0"
                                    />
                                    <span className="flex items-center gap-1 text-[11px]">
                                        <Shield className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                        Znak wodny (Watermark)
                                    </span>
                                </label>
                            </Tooltip>
                        </div>
                    </div>

                    {/* Security notice */}
                    <Tooltip content="Plik zostanie zaszyfrowany kluczem spółki w algorytmie AES-256 GCM z automatycznym wyliczeniem sumy SHA-256">
                        <div className="text-[10px] text-zinc-600 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-2.5 rounded flex items-center gap-2 cursor-help">
                            <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>Plik zostanie zaszyfrowany (AES-256 GCM) i zweryfikowany sumą SHA-256.</span>
                        </div>
                    </Tooltip>

                    {/* Actions */}
                    <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
                        <Tooltip content="Anuluj i zamknij okno deponowania">
                            <span>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    type="button"
                                    onClick={onClose}
                                    disabled={uploading}
                                    aria-label="Anuluj"
                                >
                                    Anuluj
                                </Button>
                            </span>
                        </Tooltip>
                        <Tooltip content={!file ? 'Wybierz najpierw plik dokumentu' : 'Zdeponuj dokument w repozytorium VDR'}>
                            <span>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    type="submit"
                                    loading={uploading}
                                    disabled={!file || !title.trim()}
                                    icon={UploadCloud}
                                    aria-label="Zdeponuj w VDR"
                                >
                                    Zdeponuj w VDR
                                </Button>
                            </span>
                        </Tooltip>
                    </div>
                </form>
            </div>
        </div>
    );
};
