import React from 'react';
import { Button } from '../ui/Button';
import { Tooltip, InfoTooltip } from '../ui/Tooltip';
import {
    X,
    Download,
    Shield,
    FileText,
    ExternalLink,
    Loader2
} from 'lucide-react';
import { WatermarkBadge } from './VdrPermissionBadge';

export const DocumentPreviewModal = ({
    isOpen,
    document,
    previewUrl,
    loading = false,
    onClose,
    onDownload,
    canDownload = true,
}) => {
    if (!isOpen || !document) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-zinc-950/85 backdrop-blur-xs font-mono">
            <div className="bg-zinc-900 border border-zinc-750 rounded-lg shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Modal Header */}
                <div className="px-4 py-3 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded bg-zinc-850 border border-zinc-750 flex items-center justify-center text-zinc-300 shrink-0">
                            <FileText className="w-4 h-4 text-rose-400" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                {document.index_code && (
                                    <Tooltip content={`Indeks taksonomii Dewey: ${document.index_code}`}>
                                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-950/80 border border-indigo-700/80 text-indigo-300 shrink-0 cursor-help">
                                            {document.index_code}
                                        </span>
                                    </Tooltip>
                                )}
                                <Tooltip content={document.title}>
                                    <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-100 truncate cursor-help">
                                        {document.title}
                                    </h2>
                                </Tooltip>
                                <WatermarkBadge required={true} size="xs" />
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-400 truncate mt-0.5">
                                <span className="truncate">{document.original_name}</span>
                                <span>•</span>
                                <span className="text-zinc-500 tabular-nums">{document.formatted_size}</span>
                            </div>
                        </div>
                    </div>

                    {/* Top Action controls */}
                    <div className="flex items-center gap-2 shrink-0">
                        {canDownload && (
                            <Tooltip content="Pobierz plik dokumentu (rejestruje operację w rejestrze WORM)">
                                <span>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        icon={Download}
                                        onClick={() => onDownload(document)}
                                        title="Pobierz plik dokumentu"
                                        aria-label="Pobierz plik dokumentu"
                                    >
                                        Pobierz
                                    </Button>
                                </span>
                            </Tooltip>
                        )}
                        <Tooltip content="Zamknij podgląd dokumentu">
                            <button
                                onClick={onClose}
                                title="Zamknij podgląd"
                                aria-label="Zamknij podgląd"
                                className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </Tooltip>
                    </div>
                </div>

                {/* Dynamic Watermark Banner */}
                <div className="px-4 py-1.5 bg-amber-950/40 border-b border-amber-900/60 flex items-center justify-between text-[10px] text-amber-300/90 shrink-0">
                    <div className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="font-semibold tracking-wide">
                            POUFNY PODGLĄD VDR – DOKUMENT OPATRZONY DYNAMICZNYM ZNAKIEM WODNYM
                        </span>
                        <InfoTooltip
                            size="xs"
                            title="Dynamiczny Znak Wodny VDR"
                            content="Dokument zawiera automatycznie wygenerowany znak wodny z adresem IP, tożsamością użytkownika i datą otwarcia w celach zapobiegania wyciekom (DLP)."
                            ariaLabel="Informacje o dynamicznym znaku wodnym"
                        />
                    </div>
                    <span className="text-[9px] text-amber-400/80 hidden sm:inline font-mono">
                        AUDIT ID: {document.id?.substring(0, 8)}
                    </span>
                </div>

                {/* PDF Viewer Body */}
                <div className="flex-1 bg-zinc-950 relative overflow-hidden flex items-center justify-center">
                    {loading ? (
                        <div className="text-center p-8 text-zinc-400 text-xs flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
                            <div className="font-semibold text-zinc-300">
                                Generowanie zabezpieczonego podglądu z dynamicznym znakiem wodnym...
                            </div>
                            <div className="text-[10px] text-zinc-500 max-w-sm">
                                System nanosi dane sesji, adres IP oraz identyfikator audytowy na warstwę graficzną dokumentu.
                            </div>
                        </div>
                    ) : previewUrl ? (
                        <iframe
                            src={`${previewUrl}#toolbar=1&navpanes=0`}
                            title={`Podgląd PDF: ${document.title}`}
                            className="w-full h-full border-0 bg-zinc-900"
                        />
                    ) : (
                        <div className="text-center p-8 text-zinc-500 text-xs space-y-2">
                            <FileText className="w-8 h-8 mx-auto text-zinc-600" />
                            <div>Nie udało się załadować podglądu pliku.</div>
                            {canDownload && (
                                <Tooltip content="Pobierz plik bezpośrednio na dysk komputera">
                                    <div className="inline-block mt-2">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            icon={Download}
                                            onClick={() => onDownload(document)}
                                            aria-label="Pobierz plik bezpośrednio"
                                        >
                                            Pobierz plik bezpośrednio
                                        </Button>
                                    </div>
                                </Tooltip>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
