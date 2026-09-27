import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, X, CheckCircle2, Download } from 'lucide-react';
import { Button } from '../ui/Button';
import { Tooltip, InfoTooltip } from '../ui/Tooltip';

export const CsvDropzone = ({
    selectedFile,
    onFileSelected,
    onClearFile,
    onDownloadTemplate,
    loading
}) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef(null);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            validateAndSelect(files[0]);
        }
    };

    const handleFileInput = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            validateAndSelect(e.target.files[0]);
        }
    };

    const validateAndSelect = (file) => {
        if (!file.name.toLowerCase().endsWith('.csv')) {
            alert('Wymagany jest plik w formacie CSV (.csv).');
            return;
        }
        onFileSelected(file);
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    return (
        <div className="space-y-3 font-mono">
            {/* Template Download Prompt */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs">
                <div className="text-zinc-400 flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-zinc-200">Format wejściowy:</span> Kolumny <code className="text-emerald-400 font-bold">kategoria</code>, <code className="text-emerald-400 font-bold">kwota</code>, <code className="text-emerald-400 font-bold">data</code>, <code className="text-emerald-400 font-bold">opis</code>, opcjonalnie <code className="text-emerald-400 font-bold">waluta</code>. Separatory: przecinek (,) lub średnik (;).
                    <InfoTooltip
                        size="xs"
                        title="Specyfikacja Formatowania Pliku CSV"
                        ariaLabel="Więcej informacji o specyfikacji formatu CSV"
                        content="Wymagane nagłówki kolumn: kategoria (kod kategorii, np. cat-revenue, cat-payroll), kwota (wartość numeryczna), data (format RRRR-MM-DD) oraz opis (tytuł operacji). Domyślna waluta operacji to PLN."
                    />
                </div>
                <Tooltip content="Pobierz przykładowy plik szablonu CSV z poprawną strukturą kolumn i danymi demonstracyjnymi">
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={Download}
                        onClick={onDownloadTemplate}
                        aria-label="Pobierz Szablon CSV"
                        className="shrink-0 text-xs"
                    >
                        Pobierz Szablon CSV
                    </Button>
                </Tooltip>
            </div>

            {/* Dropzone Box */}
            {!selectedFile ? (
                <Tooltip content="Przeciągnij i upuść plik .csv lub kliknij, aby otworzyć okno wyboru pliku (maksymalnie 10 MB, UTF-8)">
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                fileInputRef.current?.click();
                            }
                        }}
                        aria-label="Przeciągnij i upuść plik CSV lub kliknij, aby wybrać z dysku"
                        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-150 ${
                            isDragOver
                                ? 'border-emerald-500 bg-emerald-950/20'
                                : 'border-zinc-750 hover:border-zinc-500 bg-zinc-950/60'
                        }`}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,text/csv"
                            className="hidden"
                            onChange={handleFileInput}
                            aria-hidden="true"
                        />

                        <div className="w-12 h-12 rounded-lg bg-zinc-900 border border-zinc-750 flex items-center justify-center mx-auto text-zinc-400 mb-3 shadow-inner">
                            <UploadCloud className="w-6 h-6 text-zinc-300" />
                        </div>

                        <div className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                            Przeciągnij i upuść plik CSV lub kliknij, aby wybrać z dysku
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-1 max-w-sm mx-auto">
                            Maksymalny rozmiar pliku: 10 MB. Obsługiwane kodowanie UTF-8 lub Windows-1250.
                        </p>
                    </div>
                </Tooltip>
            ) : (
                <div className="p-4 bg-zinc-950 border border-zinc-750 rounded-lg flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <Tooltip content="Plik CSV wczytany do pamięci podręcznej i przygotowany do weryfikacji Dry-Run">
                            <div className="w-10 h-10 rounded bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400 shrink-0 cursor-help">
                                <FileSpreadsheet className="w-5 h-5" />
                            </div>
                        </Tooltip>
                        <div className="min-w-0">
                            <div className="text-xs font-bold text-zinc-100 truncate flex items-center gap-2">
                                <Tooltip content={`Wybrany plik: ${selectedFile.name}`}>
                                    <span className="truncate cursor-help">{selectedFile.name}</span>
                                </Tooltip>
                                <Tooltip content={`Dokładny rozmiar pliku: ${selectedFile.size} bajtów`}>
                                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-850 border border-zinc-750 text-zinc-400 shrink-0 cursor-help">
                                        {formatFileSize(selectedFile.size)}
                                    </span>
                                </Tooltip>
                            </div>
                            <Tooltip content="Data ostatniej modyfikacji pliku na Twoim dysku">
                                <div className="text-[10px] text-zinc-500 mt-0.5 cursor-help">
                                    Ostatnia modyfikacja: {new Date(selectedFile.lastModified).toLocaleString()}
                                </div>
                            </Tooltip>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <Tooltip content="Odrzuć ten plik i wskaż inny zestaw danych z dysku">
                            <Button
                                variant="secondary"
                                size="sm"
                                icon={X}
                                onClick={onClearFile}
                                disabled={loading}
                                aria-label="Zmień wybrany plik CSV"
                            >
                                Zmień Plik
                            </Button>
                        </Tooltip>
                    </div>
                </div>
            )}
        </div>
    );
};
