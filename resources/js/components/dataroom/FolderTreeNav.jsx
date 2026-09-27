import React, { useState } from 'react';
import {
    Folder,
    FolderOpen,
    FolderTree,
    FolderPlus,
    ChevronDown,
    ChevronRight,
    Sparkles,
    Files,
    FolderX,
    RefreshCw
} from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';

export const FolderTreeNav = ({
    folders = [],
    selectedFolderId = '',
    onSelectFolder,
    onInitStandardFolders,
    onOpenCreateFolder,
    loading = false,
    initLoading = false,
    totalCount = 0,
    unassignedCount = 0,
}) => {
    // Keep track of expanded root folders by ID (default: all expanded)
    const [expandedFolders, setExpandedFolders] = useState({});

    const isExpanded = (folderId) => {
        // Default to expanded if not explicitly set to false
        return expandedFolders[folderId] !== false;
    };

    const toggleExpand = (folderId, e) => {
        e.stopPropagation();
        setExpandedFolders(prev => ({
            ...prev,
            [folderId]: !isExpanded(folderId),
        }));
    };

    const expandAll = () => {
        const nextState = {};
        folders.forEach(f => {
            nextState[f.id] = true;
        });
        setExpandedFolders(nextState);
    };

    const collapseAll = () => {
        const nextState = {};
        folders.forEach(f => {
            nextState[f.id] = false;
        });
        setExpandedFolders(nextState);
    };

    const isAllSelected = !selectedFolderId;
    const isUnassignedSelected = selectedFolderId === 'unassigned';

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 font-mono text-xs shadow-sm flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                    <FolderTree className="w-4 h-4 text-emerald-400" />
                    <div>
                        <h2 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
                            Taksonomia M&A
                        </h2>
                        <span className="text-[9px] text-zinc-500 uppercase tracking-wider block">
                            Hierarchia Dziesiętna Dewey
                        </span>
                    </div>
                </div>

                {folders.length > 0 && (
                    <div className="flex items-center gap-1">
                        <Tooltip content="Rozwiń wszystkie gałęzie">
                            <button
                                type="button"
                                onClick={expandAll}
                                aria-label="Rozwiń wszystkie gałęzie"
                                className="px-1.5 py-0.5 text-[9px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                            >
                                +Rozwiń
                            </button>
                        </Tooltip>
                        <span className="text-zinc-650">|</span>
                        <Tooltip content="Zwiń wszystkie gałęzie">
                            <button
                                type="button"
                                onClick={collapseAll}
                                aria-label="Zwiń wszystkie gałęzie"
                                className="px-1.5 py-0.5 text-[9px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                            >
                                -Zwiń
                            </button>
                        </Tooltip>
                    </div>
                )}
            </div>

            {/* Action to create new folder */}
            {onOpenCreateFolder && (
                <button
                    type="button"
                    onClick={onOpenCreateFolder}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 mb-2.5 rounded bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-all text-xs font-semibold"
                >
                    <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />
                    + Nowy Folder Dewey
                </button>
            )}

            {/* Quick selectors: All documents & Unassigned */}
            <div className="space-y-1 mb-2.5">
                {/* All documents */}
                <button
                    type="button"
                    onClick={() => onSelectFolder('')}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded transition-all text-left ${
                        isAllSelected
                            ? 'bg-zinc-800 text-zinc-100 font-bold border border-zinc-700 shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/60'
                    }`}
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <Files className={`w-3.5 h-3.5 shrink-0 ${isAllSelected ? 'text-emerald-400' : 'text-zinc-500'}`} />
                        <span className="truncate">Wszystkie dokumenty</span>
                    </div>
                    <span className="px-1.5 py-0.2 rounded text-[10px] tabular-nums font-bold bg-zinc-950 border border-zinc-800 text-zinc-300 ml-2 shrink-0">
                        {totalCount}
                    </span>
                </button>

                {/* Unassigned documents */}
                <button
                    type="button"
                    onClick={() => onSelectFolder('unassigned')}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded transition-all text-left ${
                        isUnassignedSelected
                            ? 'bg-zinc-800 text-zinc-100 font-bold border border-zinc-700 shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/60'
                    }`}
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <FolderX className={`w-3.5 h-3.5 shrink-0 ${isUnassignedSelected ? 'text-amber-400' : 'text-zinc-500'}`} />
                        <span className="truncate">Nieprzypisane do folderu</span>
                    </div>
                    {unassignedCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] tabular-nums font-bold bg-amber-950/60 border border-amber-800/80 text-amber-300 ml-2 shrink-0">
                            {unassignedCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Folder Tree Body */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-1 max-h-[520px]">
                {loading ? (
                    <div className="py-8 text-center text-zinc-500 text-xs">
                        <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1.5 text-zinc-400" />
                        Ładowanie folderów...
                    </div>
                ) : folders.length === 0 ? (
                    <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-md text-center my-2">
                        <Sparkles className="w-6 h-6 text-emerald-400 mx-auto mb-1.5 opacity-90" />
                        <div className="font-bold text-zinc-200 text-xs mb-1">
                            Brak folderów transakcyjnych
                        </div>
                        <p className="text-[10px] text-zinc-400 mb-3 leading-relaxed">
                            Zainicjalizuj 33 standardowe foldery M&A Due Diligence zgodne z taksonomią Dewey.
                        </p>
                        <button
                            type="button"
                            onClick={onInitStandardFolders}
                            disabled={initLoading}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-[11px] transition-colors disabled:opacity-50"
                        >
                            {initLoading ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Sparkles className="w-3.5 h-3.5" />
                            )}
                            Inicjalizuj Taksonomię M&A
                        </button>
                    </div>
                ) : (
                    folders.map(folder => {
                        const hasChildren = folder.children && folder.children.length > 0;
                        const expanded = isExpanded(folder.id);
                        const isFolderSelected = selectedFolderId === folder.id;

                        return (
                            <div key={folder.id} className="space-y-0.5">
                                {/* Root Folder Row */}
                                <div
                                    onClick={() => onSelectFolder(folder.id)}
                                    className={`group flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors ${
                                        isFolderSelected
                                            ? 'bg-zinc-800 text-zinc-100 font-bold border border-zinc-700 shadow-sm'
                                            : 'text-zinc-300 hover:text-white hover:bg-zinc-850/60'
                                    }`}
                                >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        {hasChildren ? (
                                            <button
                                                type="button"
                                                onClick={(e) => toggleExpand(folder.id, e)}
                                                className="p-0.5 text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-800 shrink-0"
                                            >
                                                {expanded ? (
                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                ) : (
                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                        ) : (
                                            <span className="w-4 shrink-0" />
                                        )}

                                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-zinc-950 border border-zinc-750 text-emerald-400 shrink-0">
                                            {folder.index_code}
                                        </span>

                                        <Tooltip content={folder.name}>
                                            <span className="truncate text-xs">
                                                {folder.name}
                                            </span>
                                        </Tooltip>
                                    </div>

                                    <span
                                        className={`px-1.5 py-0.2 rounded text-[10px] tabular-nums font-bold ml-2 shrink-0 ${
                                            (folder.documents_count || 0) > 0
                                                ? 'bg-zinc-950 border border-zinc-800 text-zinc-200'
                                                : 'text-zinc-600'
                                        }`}
                                    >
                                        {folder.documents_count || 0}
                                    </span>
                                </div>

                                {/* Nested Child Folders */}
                                {hasChildren && expanded && (
                                    <div className="pl-5 space-y-0.5 border-l border-zinc-800/80 ml-3.5 my-0.5">
                                        {folder.children.map(child => {
                                            const isChildSelected = selectedFolderId === child.id;

                                            return (
                                                <div
                                                    key={child.id}
                                                    onClick={() => onSelectFolder(child.id)}
                                                    className={`group flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-colors ${
                                                        isChildSelected
                                                            ? 'bg-zinc-800 text-zinc-100 font-bold border border-zinc-700 shadow-sm'
                                                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-zinc-950 border border-zinc-800 text-cyan-400 shrink-0">
                                                            {child.index_code}
                                                        </span>
                                                        <Tooltip content={child.name}>
                                                            <span className="truncate text-[11px]">
                                                                {child.name}
                                                            </span>
                                                        </Tooltip>
                                                    </div>

                                                    <span
                                                        className={`px-1 py-0.2 rounded text-[9px] tabular-nums font-bold ml-1.5 shrink-0 ${
                                                            (child.documents_count || 0) > 0
                                                                ? 'bg-zinc-950 border border-zinc-800 text-zinc-200'
                                                                : 'text-zinc-600'
                                                        }`}
                                                    >
                                                        {child.documents_count || 0}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Bottom action to initialize if folders exist */}
            {folders.length > 0 && (
                <div className="pt-2 mt-2 border-t border-zinc-800">
                    <Tooltip content="Zainicjalizuj brakujące foldery standardu M&A">
                        <button
                            type="button"
                            onClick={onInitStandardFolders}
                            disabled={initLoading}
                            aria-label="Zainicjalizuj brakujące foldery standardu M&A"
                            className="w-full flex items-center justify-center gap-1.5 py-1 text-[10px] text-zinc-400 hover:text-emerald-400 hover:bg-zinc-850 rounded transition-colors disabled:opacity-50"
                        >
                            {initLoading ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                                <Sparkles className="w-3 h-3 text-emerald-400" />
                            )}
                            Uzupełnij standard M&A (33 foldery)
                        </button>
                    </Tooltip>
                </div>
            )}
        </div>
    );
};
