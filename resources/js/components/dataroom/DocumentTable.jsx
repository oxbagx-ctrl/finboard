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
    Eye
} from 'lucide-react';
import { formatFileSize, formatFinancialDate } from '../../utils/formatters';
import { WatermarkBadge } from './VdrPermissionBadge';

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
            return <Presentation className="w-4 h-4 text-amber-400" />;
        }
        return <File className="w-4 h-4 text-zinc-400" />;
    };

    const getCategoryBadge = (doc) => {
        const typeLabels = {
            'financial_report': { label: 'Raport Finansowy', cls: 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300' },
            'contract': { label: 'Umowa / Aneks', cls: 'bg-blue-950/60 border-blue-800/80 text-blue-300' },
            'tax_declaration': { label: 'Deklaracja Podatkowa', cls: 'bg-purple-950/60 border-purple-800/80 text-purple-300' },
            'audit_report': { label: 'Raport z Audytu', cls: 'bg-amber-950/60 border-amber-800/80 text-amber-300' },
            'presentation': { label: 'Prezentacja Inwestorska', cls: 'bg-cyan-950/60 border-cyan-800/80 text-cyan-300' },
            'other': { label: 'Inny Dokument', cls: 'bg-zinc-850 border-zinc-750 text-zinc-300' },
        };

        const config = typeLabels[doc.type] || { label: doc.type_label || doc.type, cls: 'bg-zinc-850 border-zinc-750 text-zinc-300' };

        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${config.cls}`}>
                {config.label}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center text-zinc-500 font-mono text-xs">
                <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-200 rounded-full animate-spin mx-auto mb-2" />
                Ładowanie rejestru dokumentów pokoju danych...
            </div>
        );
    }

    if (!documents || documents.length === 0) {
        return (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center text-zinc-500 font-mono text-xs">
                <FolderLock className="w-10 h-10 mx-auto text-zinc-600 mb-2 opacity-80" />
                <div className="text-zinc-300 font-bold">Brak dokumentów spełniających wybrane kryteria</div>
                <div className="text-[10px] text-zinc-500 mt-1">
                    Zmień filtry kategoryzacji lub wgraj nowy dokument do repozytorium VDR.
                </div>
            </div>
        );
    }

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-xl font-mono text-xs">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-zinc-950 border-b border-zinc-800 text-[10px] text-zinc-400 uppercase tracking-wider">
                            <th className="py-2.5 px-4 font-semibold">Tytuł i Plik Źródłowy</th>
                            <th className="py-2.5 px-3 font-semibold w-40">Kategoria VDR</th>
                            <th className="py-2.5 px-3 font-semibold w-36">Suma SHA-256</th>
                            <th className="py-2.5 px-3 font-semibold w-24 text-right">Rozmiar</th>
                            <th className="py-2.5 px-3 font-semibold w-36">Wgrał / Data</th>
                            <th className="py-2.5 px-3 font-semibold w-20 text-center">Pobrania</th>
                            <th className="py-2.5 px-4 font-semibold w-44 text-right">Akcje</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850">
                        {documents.map((doc) => (
                            <tr
                                key={doc.id}
                                className={`hover:bg-zinc-850/40 transition-colors ${
                                    doc.is_archived ? 'opacity-60 bg-zinc-950/40' : ''
                                }`}
                            >
                                {/* Title & Filename */}
                                <td className="py-2.5 px-4">
                                    <div className="flex items-start gap-2.5">
                                        <div className="mt-0.5 shrink-0 p-1 rounded bg-zinc-950 border border-zinc-800">
                                            {getFileIcon(doc.mime_type, doc.type)}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {doc.index_code && (
                                                    <span
                                                        className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-indigo-950/80 border border-indigo-700/80 text-indigo-300 shrink-0"
                                                        title={`Indeks Dewey: ${doc.index_code}${doc.folder?.name ? ` (${doc.folder.name})` : ''}`}
                                                    >
                                                        {doc.index_code}
                                                    </span>
                                                )}
                                                <span className="font-bold text-zinc-100 truncate hover:text-white" title={doc.title}>
                                                    {doc.title}
                                                </span>
                                                {(doc.watermark_required || doc.mime_type?.includes('pdf') || doc.original_name?.toLowerCase().endsWith('.pdf')) && (
                                                    <WatermarkBadge required={true} size="xs" />
                                                )}
                                                {doc.is_archived && (
                                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-950/80 border border-amber-800 text-amber-300">
                                                        Archiwum
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-zinc-500 truncate mt-0.5">
                                                <span title={doc.original_name}>{doc.original_name}</span>
                                                {doc.folder && (
                                                    <>
                                                        <span className="text-zinc-650">•</span>
                                                        <span
                                                            className="text-zinc-400 truncate max-w-[220px]"
                                                            title={`Folder: ${doc.folder.index_code} ${doc.folder.name}`}
                                                        >
                                                            📁 {doc.folder.index_code} {doc.folder.name}
                                                        </span>
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
                                        <span
                                            className="text-[10px] text-zinc-400 font-mono truncate max-w-[90px]"
                                            title={`Pełny skrót SHA-256: ${doc.checksum_sha256}`}
                                        >
                                            {doc.checksum_sha256 ? `${doc.checksum_sha256.substring(0, 8)}...` : '—'}
                                        </span>
                                        {doc.checksum_sha256 && (
                                            <button
                                                type="button"
                                                onClick={() => handleCopyHash(doc.id, doc.checksum_sha256)}
                                                title="Kopiuj pełną sumę kontrolną SHA-256"
                                                className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                                            >
                                                {copiedHashId === doc.id ? (
                                                    <Check className="w-3 h-3 text-emerald-400" />
                                                ) : (
                                                    <Copy className="w-3 h-3" />
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </td>

                                {/* File Size */}
                                <td className="py-2.5 px-3 text-right font-mono text-zinc-300 tabular-nums whitespace-nowrap">
                                    {doc.formatted_size || formatFileSize(doc.size_bytes)}
                                </td>

                                {/* Uploader & Date */}
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                    <div className="text-[11px] text-zinc-300 truncate">
                                        {doc.uploader?.name || 'Użytkownik'}
                                    </div>
                                    <div className="text-[10px] text-zinc-500">
                                        {formatFinancialDate(doc.created_at)}
                                    </div>
                                </td>

                                {/* Download count */}
                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-950 border border-zinc-800 text-zinc-300 tabular-nums">
                                        {doc.download_count || 0}
                                    </span>
                                </td>

                                {/* Actions */}
                                <td className="py-2.5 px-4 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1">
                                        {/* Preview with Dynamic Watermark */}
                                        {onPreview && (
                                            <button
                                                type="button"
                                                onClick={() => onPreview(doc)}
                                                title="Podgląd dokumentu (otwiera zabezpieczony plik ze znakiem wodnym)"
                                                className="p-1.5 rounded text-cyan-400 hover:bg-cyan-950/60 hover:text-cyan-300 border border-cyan-900/60 transition-colors"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                            </button>
                                        )}

                                        {/* Download */}
                                        <button
                                            type="button"
                                            onClick={() => onDownload(doc)}
                                            disabled={doc.can_download === false}
                                            title={doc.can_download === false
                                                ? 'Pobieranie zablokowane przez uprawnienia VDR (skorzystaj z podglądu)'
                                                : 'Pobierz dokument (rejestruje pobranie w audycie)'
                                            }
                                            className={`p-1.5 rounded transition-colors ${
                                                doc.can_download === false
                                                    ? 'text-zinc-600 border border-zinc-800 cursor-not-allowed opacity-40'
                                                    : 'text-emerald-400 hover:bg-emerald-950/60 hover:text-emerald-300 border border-emerald-900/60'
                                            }`}
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                        </button>

                                        {/* View Audit Trail */}
                                        <button
                                            type="button"
                                            onClick={() => onViewAudit(doc)}
                                            title="Przeglądaj wpisy ścieżki audytowej"
                                            className="p-1.5 rounded text-blue-400 hover:bg-blue-950/60 hover:text-blue-300 border border-blue-900/60 transition-colors"
                                        >
                                            <ShieldCheck className="w-3.5 h-3.5" />
                                        </button>

                                        {/* Edit */}
                                        <button
                                            type="button"
                                            onClick={() => onEdit(doc)}
                                            title="Edytuj tytuł i kategorię"
                                            className="p-1.5 rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                        </button>

                                        {/* Toggle Archive */}
                                        <button
                                            type="button"
                                            onClick={() => onToggleArchive(doc)}
                                            title={doc.is_archived ? 'Przywróć z archiwum' : 'Przenieś do archiwum'}
                                            className="p-1.5 rounded text-zinc-400 hover:bg-zinc-800 hover:text-amber-300 transition-colors"
                                        >
                                            {doc.is_archived ? (
                                                <RotateCcw className="w-3.5 h-3.5" />
                                            ) : (
                                                <Archive className="w-3.5 h-3.5" />
                                            )}
                                        </button>

                                        {/* Delete */}
                                        <button
                                            type="button"
                                            onClick={() => onDelete(doc)}
                                            title="Trwale usuń z repozytorium"
                                            className="p-1.5 rounded text-zinc-500 hover:bg-rose-950/60 hover:text-rose-400 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
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
