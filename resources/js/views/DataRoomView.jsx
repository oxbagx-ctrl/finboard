import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import { DataRoomStats } from '../components/dataroom/DataRoomStats';
import { DocumentTable } from '../components/dataroom/DocumentTable';
import { FolderTreeNav } from '../components/dataroom/FolderTreeNav';
import { CreateFolderModal } from '../components/dataroom/CreateFolderModal';
import { DocumentUploadModal } from '../components/dataroom/DocumentUploadModal';
import { DocumentEditModal } from '../components/dataroom/DocumentEditModal';
import { DocumentAuditModal } from '../components/dataroom/DocumentAuditModal';
import { DeleteDocumentModal } from '../components/dataroom/DeleteDocumentModal';
import {
    FolderLock,
    UploadCloud,
    Search,
    RefreshCw,
    ShieldCheck,
    Archive,
    Filter,
    X,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    FolderTree,
    Folder,
    FolderPlus
} from 'lucide-react';

const CATEGORY_TABS = [
    { id: '', label: 'Wszystkie' },
    { id: 'financial_report', label: 'Raporty Finansowe' },
    { id: 'contract', label: 'Umowy i Aneksy' },
    { id: 'tax_declaration', label: 'Deklaracje Podatkowe' },
    { id: 'audit_report', label: 'Raporty Audytu' },
    { id: 'presentation', label: 'Prezentacje' },
    { id: 'other', label: 'Inne' },
];

export const DataRoomView = () => {
    const { activeCompany } = useAuth();
    const { success, error } = useNotification();

    // Data states
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({
        currentPage: 1,
        lastPage: 1,
        total: 0,
        perPage: 20,
    });

    // Dewey M&A Folders state
    const [folders, setFolders] = useState([]);
    const [foldersLoading, setFoldersLoading] = useState(false);
    const [selectedFolderId, setSelectedFolderId] = useState('');
    const [initLoading, setInitLoading] = useState(false);
    const [isFolderSidebarOpen, setIsFolderSidebarOpen] = useState(true);
    const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
    const [createFolderParentId, setCreateFolderParentId] = useState('');

    // Filters
    const [selectedCategory, setSelectedCategory] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [includeArchived, setIncludeArchived] = useState(false);

    // Modals
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [editingDoc, setEditingDoc] = useState(null);
    const [auditDoc, setAuditDoc] = useState(null);
    const [deletingDoc, setDeletingDoc] = useState(null);

    const fetchFolders = useCallback(async () => {
        setFoldersLoading(true);
        try {
            const res = await apiClient.get('/documents/folders', {
                params: { tree: 1 },
            });
            setFolders(res.data.data || []);
        } catch (err) {
            console.error('Failed to load folders', err);
        } finally {
            setFoldersLoading(false);
        }
    }, []);

    const fetchDocuments = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const params = {
                page,
                per_page: 20,
            };

            if (selectedCategory) {
                params.type = selectedCategory;
            }

            if (searchQuery.trim()) {
                params.search = searchQuery.trim();
            }

            if (includeArchived) {
                params.include_archived = 1;
            }

            if (selectedFolderId) {
                params.folder_id = selectedFolderId;
            }

            const res = await apiClient.get('/documents', { params });
            setDocuments(res.data.data || []);
            if (res.data.meta) {
                setPagination({
                    currentPage: res.data.meta.current_page,
                    lastPage: res.data.meta.last_page,
                    total: res.data.meta.total,
                    perPage: res.data.meta.per_page,
                });
            }
        } catch (err) {
            console.error('Failed to load documents', err);
            error('Nie udało się pobrać listy dokumentów z repozytorium VDR.');
        } finally {
            setLoading(false);
        }
    }, [selectedCategory, searchQuery, includeArchived, selectedFolderId, error]);

    const handleInitStandardFolders = async () => {
        setInitLoading(true);
        try {
            const res = await apiClient.post('/documents/folders/init-standard');
            success(res.data?.message || 'Zainicjalizowano standardową taksonomię M&A.');
            await fetchFolders();
            fetchDocuments(1);
        } catch (err) {
            error(err.response?.data?.message || 'Nie udało się zainicjalizować folderów standardu M&A.');
        } finally {
            setInitLoading(false);
        }
    };

    // Calculate unassigned documents count
    const unassignedCount = useMemo(() => {
        const assignedInFolders = folders.reduce((sum, f) => {
            const childrenCount = (f.children || []).reduce((cSum, c) => cSum + (c.documents_count || 0), 0);
            return sum + (f.documents_count || 0) + childrenCount;
        }, 0);
        return Math.max(0, pagination.total - assignedInFolders);
    }, [folders, pagination.total]);

    // Active folder label resolver
    const activeFolderLabel = useMemo(() => {
        if (!selectedFolderId) return null;
        if (selectedFolderId === 'unassigned') return 'Dokumenty nieprzypisane do folderu';

        const search = (list) => {
            for (const item of list) {
                if (item.id === selectedFolderId) {
                    return `${item.index_code} ${item.name}`;
                }
                if (item.children && item.children.length > 0) {
                    const found = search(item.children);
                    if (found) return found;
                }
            }
            return null;
        };

        return search(folders) || 'Wybrany folder';
    }, [selectedFolderId, folders]);

    useEffect(() => {
        fetchFolders();
    }, [fetchFolders, activeCompany?.id]);

    useEffect(() => {
        fetchDocuments(1);
    }, [fetchDocuments, activeCompany?.id]);

    const handleDownload = async (doc) => {
        try {
            const response = await apiClient.get(`/documents/${doc.id}/download`, {
                responseType: 'blob',
            });

            // Create download link
            const blob = new Blob([response.data], {
                type: doc.mime_type || 'application/octet-stream',
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', doc.original_name || 'document.pdf');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            success(`Pobrano plik: ${doc.original_name}. Zdarzenie odnotowano w rejestrze audytowym.`);

            // Inkrementuj lokalnie licznik pobrań
            setDocuments(prev => prev.map(item =>
                item.id === doc.id ? { ...item, download_count: (item.download_count || 0) + 1 } : item
            ));
        } catch (err) {
            console.error('Download failed', err);
            error('Wystąpił błąd podczas pobierania pliku dokumentu.');
        }
    };

    const handleToggleArchive = async (doc) => {
        try {
            const res = await apiClient.patch(`/documents/${doc.id}/archive`);
            const updated = res.data.data;
            success(updated.is_archived
                ? `Dokument "${doc.title}" przeniesiono do archiwum.`
                : `Dokument "${doc.title}" przywrócono z archiwum.`
            );
            fetchDocuments(pagination.currentPage);
        } catch (err) {
            error(err.response?.data?.message || 'Błąd podczas zmiany statusu archiwalnego.');
        }
    };

    return (
        <div className="space-y-4 font-mono">
            {/* Header & Main Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-zinc-950 border border-zinc-750 flex items-center justify-center text-zinc-200 shrink-0">
                        <FolderLock className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-sm font-bold uppercase tracking-wider text-zinc-100">
                                Wirtualny Pokój Danych (Virtual Data Room)
                            </h1>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-zinc-950 border border-zinc-750 text-zinc-400">
                                {activeCompany?.name || 'Spółka'}
                            </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-0.5">
                            Kryptograficznie audytowane repozytorium transakcyjne due diligence, umów i audytów M&A.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <Button
                        variant={isFolderSidebarOpen ? 'secondary' : 'primary'}
                        size="sm"
                        icon={FolderTree}
                        onClick={() => setIsFolderSidebarOpen(prev => !prev)}
                        title="Przełącz widok drzewa folderów M&A"
                    >
                        {isFolderSidebarOpen ? 'Ukryj Foldery' : 'Foldery M&A'}
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={RefreshCw}
                        loading={loading || foldersLoading}
                        onClick={() => {
                            fetchDocuments(pagination.currentPage);
                            fetchFolders();
                        }}
                        title="Odśwież repozytorium"
                    >
                        Odśwież
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        icon={UploadCloud}
                        onClick={() => setIsUploadOpen(true)}
                    >
                        Wgraj Dokument
                    </Button>
                </div>
            </div>

            {/* Stats strip */}
            <DataRoomStats documents={documents} totalCount={pagination.total} />

            {/* Main Content with Folder Tree Navigation Sidebar */}
            <div className="flex flex-col lg:flex-row gap-4 items-start">
                {/* Folder Tree Navigation Sidebar */}
                {isFolderSidebarOpen && (
                    <div className="w-full lg:w-72 xl:w-80 shrink-0">
                        <FolderTreeNav
                            folders={folders}
                            selectedFolderId={selectedFolderId}
                            onSelectFolder={(fId) => setSelectedFolderId(fId)}
                            onInitStandardFolders={handleInitStandardFolders}
                            onOpenCreateFolder={() => {
                                setCreateFolderParentId(selectedFolderId && selectedFolderId !== 'unassigned' ? selectedFolderId : '');
                                setIsCreateFolderOpen(true);
                            }}
                            loading={foldersLoading}
                            initLoading={initLoading}
                            totalCount={pagination.total}
                            unassignedCount={unassignedCount}
                        />
                    </div>
                )}

                {/* Document Main Column */}
                <div className="flex-1 min-w-0 space-y-4 w-full">
                    {/* Active Folder Filter Chip (if selected) */}
                    {selectedFolderId && (
                        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-indigo-950/60 border border-indigo-800/80 text-xs text-indigo-300">
                            <div className="flex items-center gap-2 min-w-0">
                                <Folder className="w-4 h-4 text-indigo-400 shrink-0" />
                                <span className="text-zinc-400">Filtrowanie folderu:</span>
                                <strong className="text-zinc-100 font-bold truncate">
                                    {activeFolderLabel}
                                </strong>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedFolderId('')}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors shrink-0 ml-2"
                            >
                                <X className="w-3.5 h-3.5" />
                                Wyczyść filtr folderu
                            </button>
                        </div>
                    )}

                    {/* Filter bar & Category Tabs */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-3">
                        {/* Category tabs */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                            {CATEGORY_TABS.map(tab => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setSelectedCategory(tab.id)}
                                    className={`px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap transition-colors ${
                                        selectedCategory === tab.id
                                            ? 'bg-zinc-100 text-zinc-900 shadow-sm'
                                            : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Search & Archived Toggle */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-zinc-855">
                            <div className="relative flex-1 max-w-md">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Szukaj po nazwie dokumentu lub pliku źródłowym..."
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded pl-8 pr-8 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-400 select-none">
                                <input
                                    type="checkbox"
                                    checked={includeArchived}
                                    onChange={(e) => setIncludeArchived(e.target.checked)}
                                    className="rounded border-zinc-750 bg-zinc-950 text-zinc-200 focus:ring-0 focus:ring-offset-0"
                                />
                                <span className="flex items-center gap-1">
                                    <Archive className="w-3 h-3 text-zinc-500" />
                                    Pokaż zarchiwizowane dokumenty
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* Document Table */}
                    <DocumentTable
                        documents={documents}
                        loading={loading}
                        onDownload={handleDownload}
                        onViewAudit={(doc) => setAuditDoc(doc)}
                        onEdit={(doc) => setEditingDoc(doc)}
                        onToggleArchive={handleToggleArchive}
                        onDelete={(doc) => setDeletingDoc(doc)}
                    />

                    {/* Pagination Controls */}
                    {pagination.total > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-xs text-zinc-400">
                            <div>
                                Dokumenty: <strong className="text-zinc-200">{documents.length}</strong> z <strong className="text-zinc-200">{pagination.total}</strong>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    icon={ChevronLeft}
                                    disabled={pagination.currentPage <= 1 || loading}
                                    onClick={() => fetchDocuments(pagination.currentPage - 1)}
                                >
                                    Poprzednia
                                </Button>
                                <span className="px-2 text-zinc-300 tabular-nums">
                                    Strona {pagination.currentPage} z {pagination.lastPage}
                                </span>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    icon={ChevronRight}
                                    disabled={pagination.currentPage >= pagination.lastPage || loading}
                                    onClick={() => fetchDocuments(pagination.currentPage + 1)}
                                >
                                    Następna
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <DocumentUploadModal
                isOpen={isUploadOpen}
                onClose={() => setIsUploadOpen(false)}
                folders={folders}
                defaultFolderId={selectedFolderId !== 'unassigned' ? selectedFolderId : ''}
                onSuccess={() => {
                    fetchDocuments(1);
                    fetchFolders();
                }}
            />

            <DocumentEditModal
                document={editingDoc}
                isOpen={!!editingDoc}
                folders={folders}
                onClose={() => setEditingDoc(null)}
                onSuccess={() => {
                    fetchDocuments(pagination.currentPage);
                    fetchFolders();
                }}
            />

            <CreateFolderModal
                isOpen={isCreateFolderOpen}
                onClose={() => setIsCreateFolderOpen(false)}
                folders={folders}
                defaultParentId={createFolderParentId}
                onSuccess={(newFolder) => {
                    fetchFolders();
                    if (newFolder?.id) {
                        setSelectedFolderId(newFolder.id);
                    }
                }}
            />

            <DocumentAuditModal
                document={auditDoc}
                isOpen={!!auditDoc}
                onClose={() => setAuditDoc(null)}
            />

            <DeleteDocumentModal
                document={deletingDoc}
                isOpen={!!deletingDoc}
                onClose={() => setDeletingDoc(null)}
                onSuccess={() => {
                    fetchDocuments(pagination.currentPage);
                    fetchFolders();
                }}
            />
        </div>
    );
};
