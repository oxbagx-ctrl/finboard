import React, { useState } from 'react';
import {
    Download,
    ShieldCheck,
    Edit3,
    Archive,
    RotateCcw,
    Trash2,
    FileText,
    FileSpreadsheet,
    File,
    Presentation,
    Copy,
    Check,
    FolderLock,
    Eye,
    Lock
} from 'lucide-react';
import { formatFileSize, formatFinancialDate } from '../../utils/formatters';
import { WatermarkBadge } from './VdrPermissionBadge';
import { Tooltip } from '../ui/Tooltip';

export const DocumentTable = ({
    documents = [],
    loading = false,
    onDownload,
    onPreview,
    onViewAudit,
    onEdit,
    onToggleArchive,
    onDelete,
}) => {
    const [copiedHashId, setCopiedHashId] = useState(null);

    const handleCopyHash = (docId, hash) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(hash);
            setCopiedHashId(docId);
            setTimeout(() => setCopiedHashId(null), 2000);
        }
    };

    const getFileIcon = (mimeType, type) => {
        if (mimeType?.includes('pdf') || type === 'financial_report' || type === 'audit_report') {
            return <FileText className="w-4 h-4 text-rose-400" />;
        }
        if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel') || mimeType?.includes('csv')) {
            return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
        }
        if (type === 'presentation' || mimeType?.includes('presentation') || mimeType?.includes('powerpoint')) {
            return <Presentation className="w-4 h-4 text-amber-500" />;
        }
        return <File className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />;
    };

    const getCategoryBadge = (doc) => {
        const typeLabels = {
            'financial_report': { label: 'Raport Finansowy', cls: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300' },
            'contract': { label: 'Umowa / Aneks', cls: 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800/80 text-blue-700 dark:text-blue-300' },
            'tax_declaration': { label: 'Deklaracja Podatkowa', cls: 'bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800/80 text-purple-700 dark:text-purple-300' },
            'audit_report': { label: 'Raport z Audytu', cls: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/80 text-amber-700 dark:text-amber-300' },
            'presentation': { label: 'Prezentacja Inwestorska', cls: 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-200 dark:border-cyan-800/80 text-cyan-700 dark:text-cyan-300' },
            'other': { label: 'Inny Dokument', cls: 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300' },
        };

        const config = typeLabels[doc.type] || { label: doc.type_label || doc.type, cls: 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300' };

        return (
            <Tooltip content={`Kategoria dokumentu: ${config.label}`}>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border cursor-help ${config.cls}`}>
                    {config.label}
                </span>
            </Tooltip>
        );
    };

    if (loading) {
        return (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-12 text-center text-zinc-500 font-mono text-xs shadow-sm">
                <div className="w-6 h-6 border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-800 dark:border-t-zinc-200 rounded-full animate-spin mx-auto mb-2" />
                Ładowanie rejestru dokumentów pokoju danych...
            </div>
        );
    }

    if (!documents || documents.length === 0) {
        return (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-12 text-center text-zinc-500 font-mono text-xs shadow-sm">
                <FolderLock className="w-10 h-10 mx-auto text-zinc-400 dark:text-zinc-600 mb-2 opacity-80" />
                <div className="text-zinc-800 dark:text-zinc-300 font-bold">Brak dokumentów spełniających wybrane kryteria</div>
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                    Zmień filtry kategoryzacji lub wgraj nowy dokument do repozytorium VDR.
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-sm font-mono text-xs">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-zinc-100 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                            <th className="py-2.5 px-4 font-semibold">
                                <Tooltip content="Nazwa transakcyjna dokumentu, kod taksonomii Dewey oraz fizyczna nazwa pliku źródłowego">
                                    <span className="cursor-help">Tytuł i Plik Źródłowy</span>
                                </Tooltip>
                            </th>
                            <th className="py-2.5 px-3 font-semibold w-40">
                                <Tooltip content="Klasyfikacja dokumentu w taksonomii due diligence (np. raport finansowy, umowa, podatki)">
                                    <span className="cursor-help">Kategoria VDR</span>
                                </Tooltip>
                            </th>
                            <th className="py-2.5 px-3 font-semibold w-36">
                                <Tooltip content="Kryptograficzny skrót SHA-256 gwarantujący integralność pliku (tamper detection)">
                                    <span className="cursor-help">Suma SHA-256</span>
                                </Tooltip>
                            </th>
                            <th className="py-2.5 px-3 font-semibold w-24 text-right">
                                <Tooltip content="Fizyczny rozmiar pliku w formacie binarnym">
                                    <span className="cursor-help">Rozmiar</span>
                                </Tooltip>
                            </th>
                            <th className="py-2.5 px-3 font-semibold w-36">
                                <Tooltip content="Operator wprowadzający dokument oraz data wgrania w czasie lokalnym">
                                    <span className="cursor-help">Wgrał / Data</span>
                                </Tooltip>
                            </th>
                            <th className="py-2.5 px-3 font-semibold w-20 text-center">
                                <Tooltip content="Liczba zarejestrowanych pobrań pliku odnotowanych w audycie WORM">
                                    <span className="cursor-help">Pobrania</span>
                                </Tooltip>
                            </th>
                            <th className="py-2.5 px-4 font-semibold w-44 text-right">
                                <Tooltip content="Dostępne operacje: podgląd ze znakiem wodnym, pobieranie, audyt WORM, edycja, archiwizacja i usunięcie">
                                    <span className="cursor-help">Akcje</span>
                                </Tooltip>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {documents.map((doc) => (
                            <tr
                                key={doc.id}
                                className={`hover:bg-zinc-50 dark:hover:bg-zinc-850/40 transition-colors ${
                                    doc.is_archived ? 'opacity-60 bg-zinc-50/60 dark:bg-zinc-950/40' : ''
                                }`}
                            >
                                {/* Title & Filename */}
                                <td className="py-2.5 px-4">
                                    <div className="flex items-start gap-2.5">
                                        <Tooltip content={`Format pliku: ${doc.mime_type || 'plik binarny'}`}>
                                            <div className="mt-0.5 shrink-0 p-1 rounded bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 cursor-help">
                                                {getFileIcon(doc.mime_type, doc.type)}
                                            </div>
                                        </Tooltip>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {doc.index_code && (
                                                    <Tooltip content={`Indeks Dewey: ${doc.index_code}${doc.folder?.name ? ` (${doc.folder.name})` : ''}`}>
                                                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-700/80 text-indigo-700 dark:text-indigo-300 shrink-0 cursor-help">
                                                            {doc.index_code}
                                                        </span>
                                                    </Tooltip>
                                                )}
                                                <Tooltip content={doc.title}>
                                                    <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate hover:text-zinc-700 dark:hover:text-white cursor-help">
                                                        {doc.title}
                                                    </span>
                                                </Tooltip>
                                                {(doc.watermark_required || doc.mime_type?.includes('pdf') || doc.original_name?.toLowerCase().endsWith('.pdf')) && (
                                                    <WatermarkBadge required={true} size="xs" />
                                                )}
                                                {doc.is_encrypted ? (
                                                    <Tooltip content={`Szyfrowanie fizyczne: ${doc.encryption_algo?.toUpperCase() || 'AES-256-GCM'} (Klucz: ${doc.key_id || 'vdr-key-1'})`}>
                                                        <span data-testid={`encryption-badge-${doc.id}`} className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-700/80 text-emerald-700 dark:text-emerald-300 flex items-center gap-1 cursor-help shrink-0">
                                                            <Lock className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                                                            AES-256
                                                        </span>
                                                    </Tooltip>
                                                ) : (
                                                    <Tooltip content="Plik nieszyfrowany (legacy plain-text)">
                                                        <span data-testid={`encryption-badge-${doc.id}`} className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 cursor-help shrink-0">
                                                            Jawny
                                                        </span>
                                                    </Tooltip>
                                                )}
                                                {doc.is_archived && (
                                                    <Tooltip content="Dokument zarchiwizowany — wyłączony ze standardowych audytów">
                                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 cursor-help">
                                                            Archiwum
                                                        </span>
                                                    </Tooltip>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                                                <Tooltip content={`Oryginalna nazwa pliku: ${doc.original_name}`}>
                                                    <span className="truncate cursor-help">{doc.original_name}</span>
                                                </Tooltip>
                                                {doc.folder && (
                                                    <>
                                                        <span className="text-zinc-300 dark:text-zinc-650">•</span>
                                                        <Tooltip content={`Folder: ${doc.folder.index_code} ${doc.folder.name}`}>
                                                            <span className="text-zinc-600 dark:text-zinc-400 truncate max-w-[220px] cursor-help">
                                                                📁 {doc.folder.index_code} {doc.folder.name}
                                                            </span>
                                                        </Tooltip>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </td>

                                {/* Category */}
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                    {getCategoryBadge(doc)}
                                </td>

                                {/* SHA-256 Checksum */}
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                    <div className="flex items-center gap-1.5">
                                        <Tooltip content={`Pełny skrót SHA-256: ${doc.checksum_sha256}`}>
                                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono truncate max-w-[90px] cursor-help">
                                                {doc.checksum_sha256 ? `${doc.checksum_sha256.substring(0, 8)}...` : '—'}
                                            </span>
                                        </Tooltip>
                                        {doc.checksum_sha256 && (
                                            <Tooltip content={copiedHashId === doc.id ? 'Skopiowano sumę SHA-256!' : 'Kopiuj pełną sumę kontrolną SHA-256'}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyHash(doc.id, doc.checksum_sha256)}
                                                    aria-label="Kopiuj pełną sumę kontrolną SHA-256"
                                                    className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                                >
                                                    {copiedHashId === doc.id ? (
                                                        <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                                    ) : (
                                                        <Copy className="w-3 h-3" />
                                                    )}
                                                </button>
                                            </Tooltip>
                                        )}
                                    </div>
                                </td>

                                {/* File Size */}
                                <td className="py-2.5 px-3 text-right font-mono text-zinc-700 dark:text-zinc-300 tabular-nums whitespace-nowrap">
                                    <Tooltip content={`Fizyczny rozmiar pliku: ${doc.size_bytes?.toLocaleString('pl-PL') || 0} bajtów`}>
                                        <span className="cursor-help">
                                            {doc.formatted_size || formatFileSize(doc.size_bytes)}
                                        </span>
                                    </Tooltip>
                                </td>

                                {/* Uploader & Date */}
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                    <Tooltip content={`Wgrany przez: ${doc.uploader?.name || 'Użytkownik'}${doc.uploader?.email ? ` (${doc.uploader.email})` : ''} w dniu ${formatFinancialDate(doc.created_at)}`}>
                                        <div className="cursor-help">
                                            <div className="text-[11px] text-zinc-800 dark:text-zinc-300 truncate">
                                                {doc.uploader?.name || 'Użytkownik'}
                                            </div>
                                            <div className="text-[10px] text-zinc-500">
                                                {formatFinancialDate(doc.created_at)}
                                            </div>
                                        </div>
                                    </Tooltip>
                                </td>

                                {/* Download count */}
                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                    <Tooltip content={`Łączna liczba pobrań: ${doc.download_count || 0}. Zdarzenia są rejestrowane w audycie WORM.`}>
                                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 tabular-nums cursor-help">
                                            {doc.download_count || 0}
                                        </span>
                                    </Tooltip>
                                </td>

                                {/* Actions */}
                                <td className="py-2.5 px-4 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1">
                                        {/* Preview with Dynamic Watermark */}
                                        {onPreview && (
                                            <Tooltip content="Podgląd dokumentu (otwiera zabezpieczony plik ze znakiem wodnym)">
                                                <button
                                                    type="button"
                                                    onClick={() => onPreview(doc)}
                                                    aria-label="Podgląd dokumentu"
                                                    className="p-1.5 rounded text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/60 hover:text-cyan-700 dark:hover:text-cyan-300 border border-cyan-200 dark:border-cyan-900/60 transition-colors"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                            </Tooltip>
                                        )}

                                        {/* Download */}
                                        <Tooltip
                                            content={doc.can_download === false
                                                ? 'Pobieranie zablokowane przez uprawnienia VDR (skorzystaj z podglądu)'
                                                : 'Pobierz dokument (rejestruje pobranie w audycie)'
                                            }
                                        >
                                            <span>
                                                <button
                                                    type="button"
                                                    onClick={() => onDownload(doc)}
                                                    disabled={doc.can_download === false}
                                                    aria-label={doc.can_download === false ? 'Pobieranie zablokowane' : 'Pobierz dokument'}
                                                    className={`p-1.5 rounded transition-colors ${
                                                        doc.can_download === false
                                                            ? 'text-zinc-400 dark:text-zinc-600 border border-zinc-200 dark:border-zinc-800 cursor-not-allowed opacity-40'
                                                            : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-700 dark:hover:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60'
                                                    }`}
                                                >
                                                    <Download className="w-3.5 h-3.5" />
                                                </button>
                                            </span>
                                        </Tooltip>

                                        {/* View Audit Trail */}
                                        <Tooltip content="Przeglądaj wpisy ścieżki audytowej">
                                            <button
                                                type="button"
                                                onClick={() => onViewAudit(doc)}
                                                aria-label="Ścieżka audytowa"
                                                className="p-1.5 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-900/60 transition-colors"
                                            >
                                                <ShieldCheck className="w-3.5 h-3.5" />
                                            </button>
                                        </Tooltip>

                                        {/* Edit */}
                                        <Tooltip content="Edytuj tytuł i kategorię">
                                            <button
                                                type="button"
                                                onClick={() => onEdit(doc)}
                                                aria-label="Edytuj dokument"
                                                className="p-1.5 rounded text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 border border-zinc-200 dark:border-transparent transition-colors"
                                            >
                                                <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                        </Tooltip>

                                        {/* Toggle Archive */}
                                        <Tooltip content={doc.is_archived ? 'Przywróć z archiwum' : 'Przenieś do archiwum'}>
                                            <button
                                                type="button"
                                                onClick={() => onToggleArchive(doc)}
                                                aria-label={doc.is_archived ? 'Przywróć z archiwum' : 'Przenieś do archiwum'}
                                                className="p-1.5 rounded text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-amber-600 dark:hover:text-amber-300 border border-zinc-200 dark:border-transparent transition-colors"
                                            >
                                                {doc.is_archived ? (
                                                    <RotateCcw className="w-3.5 h-3.5" />
                                                ) : (
                                                    <Archive className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                        </Tooltip>

                                        {/* Delete */}
                                        <Tooltip content="Trwale usuń z repozytorium">
                                            <button
                                                type="button"
                                                onClick={() => onDelete(doc)}
                                                aria-label="Usuń dokument"
                                                className="p-1.5 rounded text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:text-rose-700 dark:hover:text-rose-300 border border-rose-200 dark:border-rose-900/60 transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </Tooltip>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
