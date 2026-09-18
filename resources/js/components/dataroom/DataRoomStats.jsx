import React from 'react';
import { FolderLock, HardDrive, DownloadCloud, Tags, ShieldCheck, Lock, CheckCircle2 } from 'lucide-react';
import { formatFileSize } from '../../utils/formatters';

export const DataRoomStats = ({ documents = [], totalCount = 0 }) => {
    const totalBytes = documents.reduce((acc, doc) => acc + (doc.size_bytes || 0), 0);
    const totalDownloads = documents.reduce((acc, doc) => acc + (doc.download_count || 0), 0);
    const activeDocsCount = documents.filter(d => !d.is_archived).length;
    const archivedCount = documents.filter(d => d.is_archived).length;
    const uniqueCategories = new Set(documents.map(d => d.type)).size;

    return (
        <div className="space-y-3 font-mono">
            {/* 4-KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Total Docs */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5 shadow-sm flex items-start justify-between">
                    <div>
                        <span className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider flex items-center gap-1.5">
                            <FolderLock className="w-3.5 h-3.5 text-zinc-400" />
                            Dokumenty VDR
                        </span>
                        <div className="mt-1 text-xl font-bold text-zinc-100 tabular-nums">
                            {totalCount || documents.length}
                        </div>
                        <div className="mt-0.5 text-[10px] text-zinc-500">
                            Aktywne: <strong className="text-emerald-400 font-bold">{activeDocsCount}</strong> | Archiwum: <strong className="text-zinc-400 font-bold">{archivedCount}</strong>
                        </div>
                    </div>
                </div>

                {/* Storage Used */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5 shadow-sm flex items-start justify-between">
                    <div>
                        <span className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider flex items-center gap-1.5">
                            <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
                            Wolumen Danych
                        </span>
                        <div className="mt-1 text-xl font-bold text-zinc-100 tabular-nums">
                            {formatFileSize(totalBytes)}
                        </div>
                        <div className="mt-0.5 text-[10px] text-zinc-500">
                            Przestrzeń partycji: <strong className="text-zinc-300 font-bold">Zaszyfrowana</strong>
                        </div>
                    </div>
                </div>

                {/* Download Trail */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5 shadow-sm flex items-start justify-between">
                    <div>
                        <span className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider flex items-center gap-1.5">
                            <DownloadCloud className="w-3.5 h-3.5 text-zinc-400" />
                            Pobrania Audytowe
                        </span>
                        <div className="mt-1 text-xl font-bold text-zinc-100 tabular-nums">
                            {totalDownloads}
                        </div>
                        <div className="mt-0.5 text-[10px] text-zinc-500">
                            Rejestracja IP & User-Agent: <strong className="text-emerald-400 font-bold">100%</strong>
                        </div>
                    </div>
                </div>

                {/* Categories Count */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5 shadow-sm flex items-start justify-between">
                    <div>
                        <span className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider flex items-center gap-1.5">
                            <Tags className="w-3.5 h-3.5 text-zinc-400" />
                            Kategorie Due Diligence
                        </span>
                        <div className="mt-1 text-xl font-bold text-zinc-100 tabular-nums">
                            {uniqueCategories} / 6
                        </div>
                        <div className="mt-0.5 text-[10px] text-zinc-500">
                            Taksonomia: <strong className="text-zinc-300 font-bold">M&A Standard</strong>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cryptographic & Compliance Banner */}
            <div className="px-3.5 py-2 bg-zinc-950 border border-zinc-800/80 rounded-md flex flex-wrap items-center justify-between gap-3 text-[10px] text-zinc-400">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-zinc-300">
                        <Lock className="w-3 h-3 text-emerald-400" />
                        <span>SZYFROWANIE DANYCH SPOCZYNKOWYCH: <strong>AES-256 GCM</strong></span>
                    </span>
                    <span className="hidden sm:inline text-zinc-700">|</span>
                    <span className="flex items-center gap-1.5 text-zinc-300">
                        <ShieldCheck className="w-3 h-3 text-zinc-300" />
                        <span>INTEGRALNOŚĆ PLIKÓW: <strong>SUMY KONTROLNE SHA-256</strong></span>
                    </span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <CheckCircle2 className="w-3 h-3" />
                    IMMUTABLE AUDIT TRAIL LOGGED
                </div>
            </div>
        </div>
    );
};
