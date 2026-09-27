import React, { useState, useEffect } from 'react';
import {
    X,
    Eye,
    Download,
    ShieldAlert,
    FileText,
    ExternalLink,
    Lock
} from 'lucide-react';
import { Button } from '../ui/Button';
import { WatermarkBadge } from './VdrPermissionBadge';
import { formatFileSize } from '../../utils/formatters';

export const DocumentPreviewModal = ({
    isOpen = false,
    onClose,
    document = null,
    previewUrl = null,
    loading = false,
    onDownload,
    canDownload = true,
}) => {
    if (!isOpen || !document) {
        return null;
    }

    const isPdf = document.mime_type?.includes('pdf') || document.original_name?.toLowerCase().endsWith('.pdf');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-fade-in font-mono">
            <div className="bg-zinc-900 border border-zinc-750 rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-xs">
                {/* Header */}
                <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-zinc-800 bg-zinc-950 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-750 flex items-center justify-center text-cyan-400 shrink-0">
                            <Eye className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                {document.index_code && (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-950 border border-indigo-750 text-indigo-300">
                                        {document.index_code}
                                    </span>
                                )}
                                <h3 className="font-bold text-zinc-100 text-sm truncate" title={document.title}>
                                    {document.title}
                                </h3>
                                <WatermarkBadge required={true} size="xs" />
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-0.5 truncate">
                                <span>{document.original_name}</span>
                                <span>•</span>
                                <span>{formatFileSize(document.size_bytes)}</span>
                                {document.folder && (
                                    <>
                                        <span>•</span>
                                        <span>📁 {document.folder.index_code} {document.folder.name}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {canDownload && onDownload && (
                            <Button
                                variant="secondary"
                                size="sm"
                                icon={Download}
                                onClick={() => onDownload(document)}
                                title="Pobierz plik dokumentu"
                            >
                                Pobierz
                            </Button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                            title="Zamknij podgląd"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Watermark Security Banner */}
                <div className="bg-amber-950/40 border-b border-amber-900/60 px-4 py-2 flex items-center gap-2 text-[10px] text-amber-300 shrink-0">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                        <strong>POUFNY PODGLĄD VDR:</strong> Dokument jest chroniony dynamicznym znakiem wodnym z Twoimi danymi (identyfikator, adres IP, znacznik czasu). Pobieranie i kopiowanie bez uprawnień jest monitorowane.
                    </span>
                </div>

                {/* Preview Content Area */}
                <div className="flex-1 bg-zinc-950 p-2 sm:p-4 overflow-hidden flex flex-col items-center justify-center min-h-[450px]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center text-zinc-400 gap-2">
                            <div className="w-7 h-7 border-2 border-zinc-600 border-t-cyan-400 rounded-full animate-spin" />
                            <span>Generowanie zabezpieczonego podglądu z dynamicznym znakiem wodnym...</span>
                        </div>
                    ) : previewUrl ? (
                        isPdf ? (
                            <iframe
                                src={`${previewUrl}#toolbar=1&navpanes=0`}
                                className="w-full h-full min-h-[580px] rounded border border-zinc-800 bg-zinc-900"
                                title={`Podgląd PDF: ${document.title}`}
                            />
                        ) : (
                            <div className="text-center p-8 bg-zinc-900 border border-zinc-800 rounded-lg max-w-md">
                                <FileText className="w-12 h-12 text-zinc-500 mx-auto mb-3" />
                                <div className="text-sm font-bold text-zinc-200">Podgląd bezpośredni niedostępny</div>
                                <div className="text-[11px] text-zinc-400 mt-1 mb-4">
                                    Format pliku ({document.mime_type}) nie wspiera natywnego osadzania w przeglądarce. Skorzystaj z opcji pobierania.
                                </div>
                                {canDownload && onDownload && (
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        icon={Download}
                                        onClick={() => onDownload(document)}
                                    >
                                        Pobierz Plik
                                    </Button>
                                )}
                            </div>
                        )
                    ) : (
                        <div className="text-center text-zinc-500">
                            Nie udało się załadować podglądu dokumentu.
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="px-4 py-2.5 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-500 shrink-0">
                    <span className="truncate max-w-md">
                        Suma SHA-256: <code className="text-zinc-400">{document.checksum_sha256 || 'brak'}</code>
                    </span>
                    <span className="text-zinc-400">
                        FinBoard Virtual Data Room • WORM Audit Protected
                    </span>
                </div>
            </div>
        </div>
    );
};
