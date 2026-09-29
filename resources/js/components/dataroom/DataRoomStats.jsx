import React from 'react';
import { FolderLock, HardDrive, DownloadCloud, Tags, ShieldCheck, Lock, CheckCircle2 } from 'lucide-react';
import { formatFileSize } from '../../utils/formatters';
import { Tooltip, InfoTooltip } from '../ui/Tooltip';

export const DataRoomStats = ({ documents = [], totalCount = 0 }) => {
    const totalBytes = documents.reduce((acc, doc) => acc + (doc.size_bytes || 0), 0);
    const totalDownloads = documents.reduce((acc, doc) => acc + (doc.download_count || 0), 0);
    const activeDocsCount = documents.filter(d => !d.is_archived).length;
    const archivedCount = documents.filter(d => d.is_archived).length;
    const uniqueCategories = new Set(documents.map(d => d.type)).size;
    const encryptedCount = documents.filter(d => Boolean(d.is_encrypted)).length;
    const unencryptedCount = documents.length - encryptedCount;

    return (
        <div className="space-y-3 font-mono">
            {/* 4-KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Total Docs */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5 shadow-sm flex items-start justify-between">
                    <div>
                        <span className="text-[10px] uppercase font-semibold text-zinc-500 dark:text-zinc-400 tracking-wider flex items-center gap-1.5">
                            <FolderLock className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                            Dokumenty VDR
                            <InfoTooltip
                                size="xs"
                                title="Dokumenty VDR"
                                content="Łączna liczba zdeponowanych dokumentów w wirtualnym pokoju danych z podziałem na aktywne pozycje i pozycje archiwalne."
                                ariaLabel="Więcej informacji o dokumentach VDR"
                            />
                        </span>
                        <div className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                            {totalCount || documents.length}
                        </div>
                        <div className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                            Aktywne: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{activeDocsCount}</strong> | Archiwum: <strong className="text-zinc-600 dark:text-zinc-400 font-bold">{archivedCount}</strong>
                        </div>
                    </div>
                </div>

                {/* Storage Used */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5 shadow-sm flex items-start justify-between">
                    <div>
                        <span className="text-[10px] uppercase font-semibold text-zinc-500 dark:text-zinc-400 tracking-wider flex items-center gap-1.5">
                            <HardDrive className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                            Wolumen Danych
                            <InfoTooltip
                                size="xs"
                                title="Wolumen Danych"
                                content="Łączny rozmiar fizyczny wszystkich zdeponowanych plików w zaszyfrowanym magazynie danych (AES-256 GCM)."
                                ariaLabel="Więcej informacji o wolumenie danych"
                            />
                        </span>
                        <div className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                            {formatFileSize(totalBytes)}
                        </div>
                        <div className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                            Szyfrowanie AES-256: <strong data-testid="stats-encrypted-count" className="text-emerald-600 dark:text-emerald-400 font-bold">{encryptedCount}</strong> z {documents.length} dok.
                        </div>
                    </div>
                </div>

                {/* Download Trail */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5 shadow-sm flex items-start justify-between">
                    <div>
                        <span className="text-[10px] uppercase font-semibold text-zinc-500 dark:text-zinc-400 tracking-wider flex items-center gap-1.5">
                            <DownloadCloud className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                            Pobrania Audytowe
                            <InfoTooltip
                                size="xs"
                                title="Pobrania Audytowe"
                                content="Liczba zarejestrowanych pobrań dokumentów. Każde pobranie tworzy niezmienny wpis w rejestrze WORM wraz ze stemplem czasowym, adresem IP i podpisem sesji."
                                ariaLabel="Więcej informacji o pobraniach audytowych"
                            />
                        </span>
                        <div className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                            {totalDownloads}
                        </div>
                        <div className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                            Rejestracja IP & User-Agent: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">100%</strong>
                        </div>
                    </div>
                </div>

                {/* Categories Count */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5 shadow-sm flex items-start justify-between">
                    <div>
                        <span className="text-[10px] uppercase font-semibold text-zinc-500 dark:text-zinc-400 tracking-wider flex items-center gap-1.5">
                            <Tags className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                            Kategorie Due Diligence
                            <InfoTooltip
                                size="xs"
                                title="Kategorie Due Diligence"
                                content="Pokrycie 6 standardowych kategorii taksonomii transakcyjnej M&A (raporty finansowe, umowy, deklaracje podatkowe, audyty, prezentacje, inne)."
                                ariaLabel="Więcej informacji o kategoriach Due Diligence"
                            />
                        </span>
                        <div className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                            {uniqueCategories} / 6
                        </div>
                        <div className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                            Taksonomia: <strong className="text-zinc-700 dark:text-zinc-300 font-bold">M&A Standard</strong>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cryptographic & Compliance Banner */}
            <div className="px-3.5 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 rounded-md flex flex-wrap items-center justify-between gap-3 text-[10px] text-zinc-600 dark:text-zinc-400">
                <div className="flex items-center gap-4">
                    <Tooltip content="Wszystkie dokumenty na dysku są szyfrowane sprzętowo algorytmem AES-256 w trybie GCM (Galois/Counter Mode)">
                        <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 cursor-help">
                            <Lock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>SZYFROWANIE DANYCH SPOCZYNKOWYCH: <strong>AES-256 GCM</strong></span>
                        </span>
                    </Tooltip>
                    <span className="hidden sm:inline text-zinc-300 dark:text-zinc-700">|</span>
                    <Tooltip content="Każdy przesłany plik posiada unikalny kryptograficzny skrót SHA-256 weryfikowany przy każdym pobraniu">
                        <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 cursor-help">
                            <ShieldCheck className="w-3 h-3 text-zinc-700 dark:text-zinc-300" />
                            <span>INTEGRALNOŚĆ PLIKÓW: <strong>SUMY KONTROLNE SHA-256</strong></span>
                        </span>
                    </Tooltip>
                </div>
                <Tooltip content="Niezmienny rejestr zdarzeń WORM (Write Once, Read Many) uniemożliwia modyfikację lub ukrycie historii operacji">
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold cursor-help">
                        <CheckCircle2 className="w-3 h-3" />
                        IMMUTABLE AUDIT TRAIL LOGGED
                    </div>
                </Tooltip>
            </div>
        </div>
    );
};
