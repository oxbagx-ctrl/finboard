import React, { useState, useRef } from 'react';
import apiClient from '../../api/client';
import { useNotification } from '../../context/NotificationContext';
import { Button } from '../ui/Button';
import {
    X,
    UploadCloud,
    FileText,
    CheckCircle2,
    AlertCircle,
    FileSpreadsheet,
    Shield,
    HardDrive
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
}) => {
    const { success, error } = useNotification();
    const fileInputRef = useRef(null);

    const [file, setFile] = useState(null);
    const [title, setTitle] = useState('');
    const [type, setType] = useState('financial_report');
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [errors, setErrors] = useState({});

    if (!isOpen) return null;

    const handleFileSelect = (selectedFile) => {
        if (!selectedFile) return;

        // Max 50 MB check
        if (selectedFile.size > 50 * 1024 * 1024) {
            setErrors(prev => ({ ...prev, file: 'Maksymalny dopuszczalny rozmiar pliku wynosi 50 MB.' }));
            return;
        }

        setFile(selectedFile);
        setErrors(prev => ({ ...prev, file: null }));

        // Auto-fill title if empty
        if (!title.trim()) {
            const cleanName = selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
            setTitle(cleanName);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    };

    const validate = () => {
        const errs = {};
        if (!file) errs.file = 'Wybierz plik do wgrania do repozytorium VDR.';
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

            await apiClient.post('/documents', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            success('Dokument został bezpiecznie zdeponowany w Pokoju Danych (VDR).');
            onSuccess();
            handleClose();
        } catch (err) {
            const errData = err.response?.data;
            if (errData?.errors) {
                setErrors(errData.errors);
            } else {
                error(errData?.message || 'Wystąpił błąd podczas wgrywania pliku do VDR.');
            }
        } finally {
            setUploading(false);
        }
    };

    const handleClose = () => {
        setFile(null);
        setTitle('');
        setType('financial_report');
        setErrors({});
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-xs font-mono">
            <div className="bg-zinc-900 border border-zinc-750 rounded-lg shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="px-5 py-3.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-zinc-850 border border-zinc-750 flex items-center justify-center text-zinc-300">
                            <UploadCloud className="w-3.5 h-3.5" />
                        </div>
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-100">
                                Deponowanie Dokumentu w VDR
                            </h2>
                            <p className="text-[10px] text-zinc-500">
                                BEZPIECZNE REPOZYTORIUM Z WERYFIKACJĄ SUMY SHA-256
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={uploading}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Drag & Drop File Zone */}
                    <div>
                        <label className="block text-[10px] uppercase font-semibold text-zinc-400 mb-1 flex items-center gap-1.5">
                            <HardDrive className="w-3 h-3 text-zinc-500" />
                            Plik Źródłowy Dokumentu (PDF, XLSX, DOCX, ZIP do 50 MB)
                        </label>

                        {!file ? (
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
                                    isDragging
                                        ? 'border-zinc-400 bg-zinc-800/60'
                                        : 'border-zinc-750 bg-zinc-950 hover:bg-zinc-850/50 hover:border-zinc-600'
                                }`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    onChange={(e) => handleFileSelect(e.target.files?.[0])}
                                    className="hidden"
                                    accept=".pdf,.xlsx,.xls,.doc,.docx,.pptx,.ppt,.csv,.txt,.zip,.rar"
                                />
                                <UploadCloud className="w-8 h-8 mx-auto text-zinc-400 mb-2 opacity-80" />
                                <div className="text-xs font-bold text-zinc-200">
                                    Przeciągnij plik tutaj lub kliknij, aby wybrać z dysku
                                </div>
                                <div className="text-[10px] text-zinc-500 mt-1">
                                    Automatyczne obliczenie skrótu kryptograficznego SHA-256 po stronie serwera
                                </div>
                            </div>
                        ) : (
                            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 flex items-center justify-between">
                                <div className="flex items-center gap-2.5 overflow-hidden">
                                    <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-750 flex items-center justify-center text-zinc-200 shrink-0">
                                        <FileText className="w-4 h-4" />
                                    </div>
                                    <div className="truncate">
                                        <div className="text-xs font-bold text-zinc-200 truncate">
                                            {file.name}
                                        </div>
                                        <div className="text-[10px] text-zinc-400">
                                            Rozmiar: <span className="text-zinc-200 font-semibold">{formatFileSize(file.size)}</span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFile(null)}
                                    disabled={uploading}
                                    className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-900 transition-colors ml-2 shrink-0"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {errors.file && (
                            <div className="text-[10px] text-rose-400 mt-1.5 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {errors.file}
                            </div>
                        )}
                    </div>

                    {/* Document Title */}
                    <div>
                        <label className="block text-[10px] uppercase font-semibold text-zinc-400 mb-1">
                            Tytuł Biznesowy Dokumentu (w repozytorium VDR)
                        </label>
                        <input
                            type="text"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="np. Sprawozdanie Finansowe i Bilans za 2025 r."
                            className="w-full bg-zinc-950 border border-zinc-750 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                        />
                        {errors.title && (
                            <div className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {errors.title}
                            </div>
                        )}
                    </div>

                    {/* Category Selection */}
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

                    {/* Security notice */}
                    <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded text-[10px] text-zinc-500 font-mono flex items-start gap-2">
                        <Shield className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                        <div>
                            Wgrany plik zostanie poddany haszowaniu SHA-256 oraz zapisany w odizolowanej przestrzeni spółki z pełną rejestracją audytową.
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 border-t border-zinc-800 flex items-center justify-end gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            type="button"
                            onClick={handleClose}
                            disabled={uploading}
                        >
                            Anuluj
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            type="submit"
                            loading={uploading}
                            disabled={!file || !title.trim()}
                        >
                            Zdeponuj w VDR
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
