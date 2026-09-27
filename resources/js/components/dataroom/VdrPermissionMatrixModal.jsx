import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useNotification } from '../../context/NotificationContext';
import { Button } from '../ui/Button';
import { Tooltip, InfoTooltip } from '../ui/Tooltip';
import {
    Shield,
    X,
    Lock,
    Trash2,
    Plus,
    RefreshCw,
    Folder,
    FileText,
    Users,
    KeyRound,
    AlertCircle,
    Check
} from 'lucide-react';
import { VdrPermissionBadge, WatermarkBadge } from './VdrPermissionBadge';

export const VdrPermissionMatrixModal = ({
    isOpen,
    onClose,
    companyId,
    folders = [],
    documents = [],
}) => {
    const { success, error } = useNotification();

    // Data state
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [matrix, setMatrix] = useState({
        folder_permissions: [],
        document_permissions: [],
        available_roles: [],
        available_levels: ['none', 'view', 'download', 'manage'],
    });

    // Active tab: 'folders' or 'documents'
    const [activeTab, setActiveTab] = useState('folders');

    // Grant form state
    const [resourceType, setResourceType] = useState('folder'); // 'folder' | 'document'
    const [targetId, setTargetId] = useState('');
    const [subjectType, setSubjectType] = useState('role'); // 'role' | 'user'
    const [subjectId, setSubjectId] = useState('client');
    const [permissionLevel, setPermissionLevel] = useState('view');
    const [watermarkRequired, setWatermarkRequired] = useState(true);

    // Fetch matrix data
    const fetchMatrix = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/documents/permissions/matrix', {
                params: { company_id: companyId },
            });
            setMatrix(res.data.data || {
                folder_permissions: [],
                document_permissions: [],
                available_roles: ['client', 'advisor'],
                available_levels: ['none', 'view', 'download', 'manage'],
            });
        } catch (err) {
            console.error('Failed to load permission matrix', err);
            error('Nie udało się pobrać matrycy uprawnień VDR.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchMatrix();
            // Pre-select first available folder or document
            if (folders.length > 0) {
                setTargetId(folders[0].id);
            } else if (documents.length > 0) {
                setTargetId(documents[0].id);
            }
        }
    }, [isOpen, companyId]);

    // Flatten tree folders for select list
    const flattenedFolders = React.useMemo(() => {
        const result = [];
        const traverse = (items, depth = 0) => {
            for (const item of items) {
                result.push({
                    id: item.id,
                    index_code: item.index_code,
                    name: item.name,
                    depth,
                });
                if (item.children && item.children.length > 0) {
                    traverse(item.children, depth + 1);
                }
            }
        };
        traverse(folders);
        return result;
    }, [folders]);

    if (!isOpen) return null;

    const handleGrantSubmit = async (e) => {
        e.preventDefault();
        if (!targetId || !subjectId) {
            error('Wybierz zasób i podmiot uprawnienia.');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                subject_type: subjectType,
                subject_id: subjectId,
                permission_level: permissionLevel,
                watermark_required: watermarkRequired,
                company_id: companyId,
            };

            const endpoint = resourceType === 'folder'
                ? `/documents/permissions/folders/${targetId}`
                : `/documents/permissions/documents/${targetId}`;

            await apiClient.post(endpoint, payload);
            success('Zdefiniowano nowe uprawnienie w matrycy VDR.');
            fetchMatrix();
        } catch (err) {
            error(err.response?.data?.message || 'Błąd podczas zapisywania uprawnienia.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRevoke = async (type, grantId) => {
        if (!window.confirm('Czy na pewno chcesz odwołać to uprawnienie VDR?')) {
            return;
        }

        try {
            await apiClient.delete(`/documents/permissions/${type}/${grantId}`, {
                params: { company_id: companyId },
            });
            success('Uprawnienie zostało pomyślnie odwołane.');
            fetchMatrix();
        } catch (err) {
            error(err.response?.data?.message || 'Błąd podczas odwoływania uprawnienia.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-zinc-950/85 backdrop-blur-xs font-mono">
            <div className="bg-zinc-900 border border-zinc-750 rounded-lg shadow-2xl max-w-4xl w-full h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="px-5 py-3.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded bg-zinc-850 border border-zinc-750 flex items-center justify-center text-zinc-300">
                            <Lock className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-100">
                                    Matryca Uprawnień VDR (Virtual Data Room)
                                </h2>
                                <InfoTooltip
                                    size="xs"
                                    title="Matryca Uprawnień VDR (RBAC)"
                                    content="Granularny silnik kontroli dostępu do folderów i dokumentów. Pozwala definiować poziomy dostępu (Brak, Podgląd, Pobieranie, Zarządzanie) oraz wymóg dynamicznego znaku wodnego."
                                    ariaLabel="Więcej informacji o matrycy uprawnień VDR"
                                />
                            </div>
                            <p className="text-[10px] text-zinc-500">
                                RBAC, DYNAMICZNE ZNAKI WODNE I NADPISANIA PLIKÓW M&A
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Tooltip content="Odśwież reguły matrycy uprawnień">
                            <button
                                onClick={fetchMatrix}
                                disabled={loading}
                                title="Odśwież matrycę"
                                aria-label="Odśwież matrycę"
                                className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </Tooltip>
                        <Tooltip content="Zamknij okno matrycy uprawnień">
                            <button
                                onClick={onClose}
                                title="Zamknij"
                                aria-label="Zamknij"
                                className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </Tooltip>
                    </div>
                </div>

                {/* Sub-header Navigation Tabs */}
                <div className="px-5 py-2 bg-zinc-950/60 border-b border-zinc-800 flex items-center gap-2 shrink-0">
                    <Tooltip content="Przeglądaj uprawnienia zdefiniowane na poziomie folderów taksonomii Dewey">
                        <button
                            type="button"
                            onClick={() => setActiveTab('folders')}
                            aria-label="Uprawnienia Folderów M&A"
                            className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                                activeTab === 'folders'
                                    ? 'bg-zinc-100 text-zinc-900 shadow-sm'
                                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                            }`}
                        >
                            <Folder className="w-3.5 h-3.5" />
                            Uprawnienia Folderów ({matrix.folder_permissions?.length || 0})
                        </button>
                    </Tooltip>
                    <Tooltip content="Przeglądaj granularne nadpisania uprawnień dla pojedynczych plików">
                        <button
                            type="button"
                            onClick={() => setActiveTab('documents')}
                            aria-label="Nadpisania Plików"
                            className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                                activeTab === 'documents'
                                    ? 'bg-zinc-100 text-zinc-900 shadow-sm'
                                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                            }`}
                        >
                            <FileText className="w-3.5 h-3.5" />
                            Nadpisania Plików ({matrix.document_permissions?.length || 0})
                        </button>
                    </Tooltip>
                </div>

                {/* Body split: List of rules on top/left, Add form at bottom */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* Permission table view */}
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-zinc-900/80 border-b border-zinc-800 text-[10px] text-zinc-400 uppercase tracking-wider">
                                    <th className="py-2.5 px-4 font-semibold">
                                        <Tooltip content="Zasób transakcyjny (katalog Dewey lub plik)">
                                            <span className="cursor-help">Zasób</span>
                                        </Tooltip>
                                    </th>
                                    <th className="py-2.5 px-3 font-semibold">
                                        <Tooltip content="Rola systemowa lub identyfikator użytkownika">
                                            <span className="cursor-help">Podmiot (Rola / Użytkownik)</span>
                                        </Tooltip>
                                    </th>
                                    <th className="py-2.5 px-3 font-semibold">
                                        <Tooltip content="Efektywny poziom dostępu">
                                            <span className="cursor-help">Poziom Uprawnień</span>
                                        </Tooltip>
                                    </th>
                                    <th className="py-2.5 px-3 font-semibold">
                                        <Tooltip content="Status wymogu dynamicznego znaku wodnego">
                                            <span className="cursor-help">Znak Wodny</span>
                                        </Tooltip>
                                    </th>
                                    <th className="py-2.5 px-4 font-semibold text-right">
                                        <Tooltip content="Akcje administracyjne">
                                            <span className="cursor-help">Akcja</span>
                                        </Tooltip>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-855">
                                {activeTab === 'folders' ? (
                                    matrix.folder_permissions?.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="py-8 text-center text-zinc-500">
                                                Brak zdefiniowanych uprawnień dla folderów. Wszyscy uprawnieni użytkownicy dziedziczą rolę globalną.
                                            </td>
                                        </tr>
                                    ) : (
                                        matrix.folder_permissions.map((grant) => (
                                            <tr key={grant.id} className="hover:bg-zinc-900/50">
                                                <td className="py-2.5 px-4 font-semibold text-zinc-200">
                                                    <Tooltip content={`Folder: [${grant.folder_index_code || '00.00'}] ${grant.folder_name || grant.folder_id}`}>
                                                        <div className="flex items-center gap-1.5 cursor-help">
                                                            <Folder className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                                            <span className="text-indigo-400 font-mono text-[10px]">
                                                                [{grant.folder_index_code || '00.00'}]
                                                            </span>
                                                            <span className="truncate">{grant.folder_name || grant.folder_id}</span>
                                                        </div>
                                                    </Tooltip>
                                                </td>
                                                <td className="py-2.5 px-3 text-zinc-300">
                                                    <span className="inline-flex items-center gap-1">
                                                        <Users className="w-3 h-3 text-zinc-500" />
                                                        {grant.subject_label || `${grant.subject_type}: ${grant.subject_id}`}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <VdrPermissionBadge level={grant.permission_level} />
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <WatermarkBadge required={grant.watermark_required} size="xs" />
                                                </td>
                                                <td className="py-2.5 px-4 text-right">
                                                    <Tooltip content="Odwołaj uprawnienie do folderu">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRevoke('folder', grant.id)}
                                                            title="Odwołaj uprawnienie"
                                                            aria-label="Odwołaj uprawnienie"
                                                            className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </Tooltip>
                                                </td>
                                            </tr>
                                        ))
                                    )
                                ) : (
                                    matrix.document_permissions?.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="py-8 text-center text-zinc-500">
                                                Brak jawnych nadpisań dla pojedynczych plików. Wszystkie pliki dziedziczą uprawnienia ze swoich folderów.
                                            </td>
                                        </tr>
                                    ) : (
                                        matrix.document_permissions.map((grant) => (
                                            <tr key={grant.id} className="hover:bg-zinc-900/50">
                                                <td className="py-2.5 px-4 font-semibold text-zinc-200">
                                                    <Tooltip content={`Dokument: ${grant.document_title || grant.document_id}`}>
                                                        <div className="flex items-center gap-1.5 cursor-help">
                                                            <FileText className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                                            <span className="truncate">{grant.document_title || grant.document_id}</span>
                                                        </div>
                                                    </Tooltip>
                                                </td>
                                                <td className="py-2.5 px-3 text-zinc-300">
                                                    <span className="inline-flex items-center gap-1">
                                                        <Users className="w-3 h-3 text-zinc-500" />
                                                        {grant.subject_label || `${grant.subject_type}: ${grant.subject_id}`}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <VdrPermissionBadge level={grant.permission_level} />
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <WatermarkBadge required={grant.watermark_required} size="xs" />
                                                </td>
                                                <td className="py-2.5 px-4 text-right">
                                                    <Tooltip content="Odwołaj nadpisanie uprawnienia dla dokumentu">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRevoke('document', grant.id)}
                                                            title="Odwołaj nadpisanie"
                                                            aria-label="Odwołaj nadpisanie"
                                                            className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </Tooltip>
                                                </td>
                                            </tr>
                                        ))
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Grant New Rule Form */}
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-855 text-xs font-bold uppercase tracking-wider text-zinc-200">
                            <Plus className="w-4 h-4 text-emerald-400" />
                            <span>Dodaj / Zaktualizuj Regułę Uprawnień</span>
                        </div>

                        <form onSubmit={handleGrantSubmit} className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {/* Resource Type */}
                                <div>
                                    <label className="block text-[10px] uppercase font-semibold text-zinc-400 mb-1 flex items-center gap-1.5">
                                        Typ Zasobu
                                        <InfoTooltip
                                            size="xs"
                                            title="Typ Zasobu"
                                            content="Wybierz czy uprawnienie dotyczy całego folderu taksonomii Dewey czy pojedynczego pliku."
                                            ariaLabel="Informacje o typie zasobu"
                                        />
                                    </label>
                                    <select
                                        value={resourceType}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setResourceType(val);
                                            if (val === 'folder' && folders.length > 0) {
                                                setTargetId(folders[0].id);
                                            } else if (val === 'document' && documents.length > 0) {
                                                setTargetId(documents[0].id);
                                            }
                                        }}
                                        aria-label="Typ Zasobu"
                                        className="w-full bg-zinc-900 border border-zinc-750 rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                                    >
                                        <option value="folder">Folder transakcyjny</option>
                                        <option value="document">Pojedynczy dokument (plik)</option>
                                    </select>
                                </div>

                                {/* Resource Selector */}
                                <div className="sm:col-span-2">
                                    <label className="block text-[10px] uppercase font-semibold text-zinc-400 mb-1 flex items-center gap-1.5">
                                        Wybierz Zasób ({resourceType === 'folder' ? 'Folder' : 'Dokument'})
                                    </label>
                                    {resourceType === 'folder' ? (
                                        <select
                                            value={targetId}
                                            onChange={(e) => setTargetId(e.target.value)}
                                            aria-label="Wybierz Folder"
                                            className="w-full bg-zinc-900 border border-zinc-750 rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 truncate"
                                        >
                                            {flattenedFolders.map(f => (
                                                <option key={f.id} value={f.id}>
                                                    {'\u00A0'.repeat(f.depth * 2)}[{f.index_code}] {f.name}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <select
                                            value={targetId}
                                            onChange={(e) => setTargetId(e.target.value)}
                                            aria-label="Wybierz Dokument"
                                            className="w-full bg-zinc-900 border border-zinc-750 rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 truncate"
                                        >
                                            {documents.map(d => (
                                                <option key={d.id} value={d.id}>
                                                    {d.title} ({d.original_name})
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                {/* Subject Type */}
                                <div>
                                    <label className="block text-[10px] uppercase font-semibold text-zinc-400 mb-1 flex items-center gap-1.5">
                                        Typ Podmiotu
                                        <InfoTooltip
                                            size="xs"
                                            title="Typ Podmiotu"
                                            content="Nadaj uprawnienie ogólnej roli transakcyjnej (Doradca / Klient) lub konkretnemu użytkownikowi."
                                            ariaLabel="Informacje o typie podmiotu"
                                        />
                                    </label>
                                    <select
                                        value={subjectType}
                                        onChange={(e) => setSubjectType(e.target.value)}
                                        aria-label="Typ Podmiotu"
                                        className="w-full bg-zinc-900 border border-zinc-750 rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                                    >
                                        <option value="role">Rola systemowa</option>
                                        <option value="user">Użytkownik (ID)</option>
                                    </select>
                                </div>

                                {/* Subject ID / Role */}
                                <div>
                                    <label className="block text-[10px] uppercase font-semibold text-zinc-400 mb-1 flex items-center gap-1.5">
                                        Podmiot ({subjectType === 'role' ? 'Rola' : 'ID Użytkownika'})
                                    </label>
                                    {subjectType === 'role' ? (
                                        <select
                                            value={subjectId}
                                            onChange={(e) => setSubjectId(e.target.value)}
                                            aria-label="Wybierz Rolę"
                                            className="w-full bg-zinc-900 border border-zinc-750 rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                                        >
                                            <option value="client">Klient / Kupujący (client)</option>
                                            <option value="advisor">Doradca Transakcyjny (advisor)</option>
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={subjectId}
                                            onChange={(e) => setSubjectId(e.target.value)}
                                            placeholder="np. UUID użytkownika"
                                            aria-label="ID Użytkownika"
                                            className="w-full bg-zinc-900 border border-zinc-750 rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                                        />
                                    )}
                                </div>

                                {/* Permission Level */}
                                <div>
                                    <label className="block text-[10px] uppercase font-semibold text-zinc-400 mb-1 flex items-center gap-1.5">
                                        Poziom Uprawnień
                                        <InfoTooltip
                                            size="xs"
                                            title="Poziom Uprawnień"
                                            content="Poziomy dostępu: Brak (blokada), Podgląd (tylko w przeglądarce), Pobieranie (zapis na dysk), Zarządzanie (edycja i usuwanie)."
                                            ariaLabel="Informacje o poziomach uprawnień"
                                        />
                                    </label>
                                    <select
                                        value={permissionLevel}
                                        onChange={(e) => setPermissionLevel(e.target.value)}
                                        aria-label="Poziom Uprawnień"
                                        className="w-full bg-zinc-900 border border-zinc-750 rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                                    >
                                        <option value="none">Brak dostępu (none)</option>
                                        <option value="view">Tylko podgląd (view)</option>
                                        <option value="download">Podgląd i pobieranie (download)</option>
                                        <option value="manage">Pełne zarządzanie (manage)</option>
                                    </select>
                                </div>

                                {/* Watermark checkbox & submit button */}
                                <div className="flex items-center gap-3 pt-5">
                                    <Tooltip content="Nanoszenie znaku wodnego z danymi tożsamości, adresem IP i czasem dostępu na każdą stronę pliku PDF">
                                        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-zinc-300 select-none">
                                            <input
                                                type="checkbox"
                                                checked={watermarkRequired}
                                                onChange={(e) => setWatermarkRequired(e.target.checked)}
                                                aria-label="Wymagaj dynamicznego znaku wodnego"
                                                className="rounded border-zinc-750 bg-zinc-900 text-zinc-200 focus:ring-0"
                                            />
                                            <span className="text-[11px]">Znak wodny</span>
                                        </label>
                                    </Tooltip>

                                    <Tooltip content="Zastosuj nowe reguły uprawnień w silniku RBAC VDR">
                                        <span className="flex-1">
                                            <Button
                                                type="submit"
                                                variant="primary"
                                                size="sm"
                                                loading={submitting}
                                                className="w-full"
                                                aria-label="Zapisz Uprawnienie"
                                            >
                                                Zapisz Uprawnienie
                                            </Button>
                                        </span>
                                    </Tooltip>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between shrink-0">
                    <Tooltip content="Uprawnienia podmiotów są ewaluowane hierarchicznie: najpierw plik, następnie folder, a na końcu rola globalna">
                        <div className="text-[10px] text-zinc-500 cursor-help">
                            Uprawnienia plików nadpisują uprawnienia folderów (Hierarchiczne RBAC).
                        </div>
                    </Tooltip>
                    <Tooltip content="Zamknij okno konfiguracji matrycy">
                        <span>
                            <Button variant="secondary" size="sm" onClick={onClose} aria-label="Zamknij">
                                Zamknij
                            </Button>
                        </span>
                    </Tooltip>
                </div>
            </div>
        </div>
    );
};
