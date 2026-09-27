import React, { useState, useEffect, useCallback } from 'react';
import {
    X,
    Shield,
    ShieldAlert,
    ShieldCheck,
    Plus,
    Trash2,
    Folder,
    FileText,
    Users,
    User,
    Lock,
    RefreshCw,
    Check,
    AlertCircle
} from 'lucide-react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { Button } from '../ui/Button';
import { VdrPermissionBadge, WatermarkBadge } from './VdrPermissionBadge';

export const VdrPermissionMatrixModal = ({
    isOpen = false,
    onClose,
    companyId = null,
    folders = [],
    documents = [],
}) => {
    const { activeCompany } = useAuth();
    const { success, error } = useNotification();

    const currentCompanyId = companyId || activeCompany?.id;

    const [activeTab, setActiveTab] = useState('folders'); // 'folders' | 'documents'
    const [loading, setLoading] = useState(false);
    const [matrixData, setMatrixData] = useState({
        folder_permissions: [],
        document_permissions: [],
        available_roles: ['client', 'advisor'],
        available_levels: [],
    });

    // Form states for new/update grant
    const [grantType, setGrantType] = useState('folder'); // 'folder' | 'document'
    const [targetResourceId, setTargetResourceId] = useState('');
    const [subjectType, setSubjectType] = useState('role'); // 'role' | 'user'
    const [selectedRole, setSelectedRole] = useState('client');
    const [targetUserId, setTargetUserId] = useState('');
    const [permissionLevel, setPermissionLevel] = useState('view');
    const [watermarkRequired, setWatermarkRequired] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const fetchMatrix = useCallback(async () => {
        if (!currentCompanyId) return;

        setLoading(true);
        try {
            const res = await apiClient.get('/documents/permissions/matrix', {
                params: { company_id: currentCompanyId },
            });
            setMatrixData(res.data.data || {
                folder_permissions: [],
                document_permissions: [],
                available_roles: ['client', 'advisor'],
                available_levels: [],
            });
        } catch (err) {
            console.error('Failed to load VDR Permission Matrix', err);
            error(err.response?.data?.message || 'Nie udało się załadować konfiguracji uprawnień VDR.');
        } finally {
            setLoading(false);
        }
    }, [currentCompanyId, error]);

    useEffect(() => {
        if (isOpen && currentCompanyId) {
            fetchMatrix();
        }
    }, [isOpen, currentCompanyId, fetchMatrix]);

    // Set initial targetResourceId when options change
    useEffect(() => {
        if (grantType === 'folder' && folders.length > 0 && !targetResourceId) {
            setTargetResourceId(folders[0].id);
        } else if (grantType === 'document' && documents.length > 0 && !targetResourceId) {
            setTargetResourceId(documents[0].id);
        }
    }, [grantType, folders, documents, targetResourceId]);

    if (!isOpen) {
        return null;
    }

    const handleSavePermission = async (e) => {
        e.preventDefault();

        if (!targetResourceId) {
            error('Wybierz folder lub dokument.');
            return;
        }

        const subjectId = subjectType === 'role' ? selectedRole : targetUserId.trim();
        if (!subjectId) {
            error('Podaj identyfikator podmiotu (rolę lub ID użytkownika).');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                subject_type: subjectType,
                subject_id: subjectId,
                permission_level: permissionLevel,
                watermark_required: watermarkRequired,
                company_id: currentCompanyId,
            };

            const endpoint = grantType === 'folder'
                ? `/documents/permissions/folders/${targetResourceId}`
                : `/documents/permissions/documents/${targetResourceId}`;

            await apiClient.post(endpoint, payload);

            success(grantType === 'folder'
                ? 'Uprawnienie do folderu transakcyjnego zostało zaktualizowane.'
                : 'Bezpośrednie uprawnienie do dokumentu zostało zaktualizowane.'
            );

            fetchMatrix();
        } catch (err) {
            console.error('Failed to set permission', err);
            error(err.response?.data?.message || 'Błąd podczas zapisywania uprawnienia.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRevoke = async (type, id) => {
        if (!window.confirm(`Czy na pewno chcesz odwołać to uprawnienie VDR?`)) {
            return;
        }

        try {
            await apiClient.delete(`/documents/permissions/${type}/${id}`, {
                params: { company_id: currentCompanyId },
            });
            success('Uprawnienie zostało pomyślnie odwołane.');
            fetchMatrix();
        } catch (err) {
            console.error('Failed to revoke permission', err);
            error(err.response?.data?.message || 'Nie udało się odwołać uprawnienia.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-fade-in font-mono">
            <div className="bg-zinc-900 border border-zinc-750 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-xs">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-750 flex items-center justify-center text-purple-400 shrink-0">
                            <Shield className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-zinc-100 text-sm">
                                    Matryca Uprawnień VDR (Virtual Data Room)
                                </h3>
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-950 border border-purple-800 text-purple-300">
                                    GRANULAR RBAC
                                </span>
                            </div>
                            <p className="text-[10px] text-zinc-500 mt-0.5">
                                Konfiguracja uprawnień (brak, podgląd, pobieranie, zarządzanie) oraz wymogu znaku wodnego
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={RefreshCw}
                            loading={loading}
                            onClick={fetchMatrix}
                            title="Odśwież matrycę"
                        >
                            Odśwież
                        </Button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                            title="Zamknij"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center border-b border-zinc-800 bg-zinc-950/60 px-4 pt-2 shrink-0 gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('folders')}
                        className={`px-3 py-2 text-xs font-semibold rounded-t-md transition-colors border-t border-x ${
                            activeTab === 'folders'
                                ? 'bg-zinc-900 border-zinc-750 text-zinc-100'
                                : 'bg-transparent border-transparent text-zinc-400 hover:text-zinc-200'
                        }`}
                    >
                        📁 Foldery M&A ({matrixData.folder_permissions?.length || 0})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('documents')}
                        className={`px-3 py-2 text-xs font-semibold rounded-t-md transition-colors border-t border-x ${
                            activeTab === 'documents'
                                ? 'bg-zinc-900 border-zinc-750 text-zinc-100'
                                : 'bg-transparent border-transparent text-zinc-400 hover:text-zinc-200'
                        }`}
                    >
                        📄 Nadpisania Plików ({matrixData.document_permissions?.length || 0})
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Active Tab Table */}
                    {activeTab === 'folders' ? (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-[11px] text-zinc-400">
                                <span>Aktywne granty uprawnień dla folderów Dewey Decimal:</span>
                            </div>

                            {loading ? (
                                <div className="p-8 text-center text-zinc-500">
                                    Ładowanie uprawnień folderów...
                                </div>
                            ) : matrixData.folder_permissions?.length === 0 ? (
                                <div className="p-6 text-center text-zinc-500 bg-zinc-950 border border-zinc-850 rounded-lg">
                                    Brak zdefiniowanych uprawnień folderów. Obowiązują domyślne uprawnienia ról (Doradca: Pobieranie, Klient: Podgląd ze znakiem wodnym).
                                </div>
                            ) : (
                                <div className="border border-zinc-800 rounded-lg overflow-hidden">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-zinc-950 border-b border-zinc-800 text-[10px] text-zinc-400 uppercase">
                                                <th className="py-2 px-3 font-semibold">Folder M&A</th>
                                                <th className="py-2 px-3 font-semibold">Podmiot</th>
                                                <th className="py-2 px-3 font-semibold">Poziom</th>
                                                <th className="py-2 px-3 font-semibold">Znak Wodny</th>
                                                <th className="py-2 px-3 font-semibold text-right">Akcje</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-850">
                                            {matrixData.folder_permissions.map((grant) => (
                                                <tr key={grant.id} className="hover:bg-zinc-850/40">
                                                    <td className="py-2.5 px-3">
                                                        <span className="font-bold text-zinc-200">
                                                            {grant.folder_index_code} {grant.folder_name}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-zinc-300">
                                                        {grant.subject_label}
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        <VdrPermissionBadge level={grant.permission_level} />
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        <WatermarkBadge required={grant.watermark_required} size="xs" />
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRevoke('folder', grant.id)}
                                                            className="p-1 rounded text-rose-400 hover:bg-rose-950/60 transition-colors"
                                                            title="Odwołaj uprawnienie"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-[11px] text-zinc-400">
                                <span>Aktywne bezpośrednie nadpisania uprawnień dla pojedynczych plików:</span>
                            </div>

                            {loading ? (
                                <div className="p-8 text-center text-zinc-500">
                                    Ładowanie nadpisań dokumentów...
                                </div>
                            ) : matrixData.document_permissions?.length === 0 ? (
                                <div className="p-6 text-center text-zinc-500 bg-zinc-950 border border-zinc-850 rounded-lg">
                                    Brak bezpośrednich nadpisań plików. Dokumenty dziedziczą uprawnienia z folderu transakcyjnego lub roli.
                                </div>
                            ) : (
                                <div className="border border-zinc-800 rounded-lg overflow-hidden">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-zinc-950 border-b border-zinc-800 text-[10px] text-zinc-400 uppercase">
                                                <th className="py-2 px-3 font-semibold">Dokument</th>
                                                <th className="py-2 px-3 font-semibold">Podmiot</th>
                                                <th className="py-2 px-3 font-semibold">Poziom</th>
                                                <th className="py-2 px-3 font-semibold">Znak Wodny</th>
                                                <th className="py-2 px-3 font-semibold text-right">Akcje</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-850">
                                            {matrixData.document_permissions.map((grant) => (
                                                <tr key={grant.id} className="hover:bg-zinc-850/40">
                                                    <td className="py-2.5 px-3">
                                                        <span className="font-bold text-zinc-200">
                                                            {grant.document_title}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-zinc-300">
                                                        {grant.subject_label}
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        <VdrPermissionBadge level={grant.permission_level} />
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        <WatermarkBadge required={grant.watermark_required} size="xs" />
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRevoke('document', grant.id)}
                                                            className="p-1 rounded text-rose-400 hover:bg-rose-950/60 transition-colors"
                                                            title="Odwołaj nadpisanie"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Grant / Update Form */}
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Plus className="w-4 h-4 text-purple-400" />
                            <h4 className="font-bold text-zinc-200 text-xs uppercase">
                                Dodaj lub zaktualizuj uprawnienie w matrycy
                            </h4>
                        </div>

                        <form onSubmit={handleSavePermission} className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {/* Grant Type */}
                                <div>
                                    <label className="block text-[10px] text-zinc-400 mb-1">Typ zasobu</label>
                                    <select
                                        value={grantType}
                                        onChange={(e) => {
                                            setGrantType(e.target.value);
                                            setTargetResourceId('');
                                        }}
                                        className="w-full bg-zinc-900 border border-zinc-750 rounded p-1.5 text-zinc-200 text-xs focus:outline-none focus:border-purple-500"
                                    >
                                        <option value="folder">📁 Folder transakcyjny</option>
                                        <option value="document">📄 Pojedynczy dokument</option>
                                    </select>
                                </div>

                                {/* Resource Selector */}
                                <div className="sm:col-span-2">
                                    <label className="block text-[10px] text-zinc-400 mb-1">
                                        {grantType === 'folder' ? 'Wybierz folder' : 'Wybierz dokument'}
                                    </label>
                                    <select
                                        value={targetResourceId}
                                        onChange={(e) => setTargetResourceId(e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-750 rounded p-1.5 text-zinc-200 text-xs focus:outline-none focus:border-purple-500"
                                        required
                                    >
                                        <option value="">-- Wybierz zasób --</option>
                                        {grantType === 'folder'
                                            ? folders.map((f) => (
                                                <option key={f.id} value={f.id}>
                                                    {f.index_code} {f.name}
                                                </option>
                                            ))
                                            : documents.map((d) => (
                                                <option key={d.id} value={d.id}>
                                                    {d.title} ({d.original_name})
                                                </option>
                                            ))}
                                    </select>
                                </div>

                                {/* Subject Type */}
                                <div>
                                    <label className="block text-[10px] text-zinc-400 mb-1">Typ podmiotu</label>
                                    <select
                                        value={subjectType}
                                        onChange={(e) => setSubjectType(e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-750 rounded p-1.5 text-zinc-200 text-xs focus:outline-none focus:border-purple-500"
                                    >
                                        <option value="role">👥 Rola transakcyjna</option>
                                        <option value="user">👤 Konkretny użytkownik</option>
                                    </select>
                                </div>

                                {/* Subject Target */}
                                <div>
                                    <label className="block text-[10px] text-zinc-400 mb-1">
                                        {subjectType === 'role' ? 'Wybór roli' : 'Identyfikator użytkownika (UUID)'}
                                    </label>
                                    {subjectType === 'role' ? (
                                        <select
                                            value={selectedRole}
                                            onChange={(e) => setSelectedRole(e.target.value)}
                                            className="w-full bg-zinc-900 border border-zinc-750 rounded p-1.5 text-zinc-200 text-xs focus:outline-none focus:border-purple-500"
                                        >
                                            <option value="client">Klient / Kupujący (Client)</option>
                                            <option value="advisor">Doradca Transakcyjny (Advisor)</option>
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={targetUserId}
                                            onChange={(e) => setTargetUserId(e.target.value)}
                                            placeholder="np. aaaaaaaa-bbbb-cccc..."
                                            className="w-full bg-zinc-900 border border-zinc-750 rounded p-1.5 text-zinc-200 text-xs focus:outline-none focus:border-purple-500"
                                            required
                                        />
                                    )}
                                </div>

                                {/* Permission Level */}
                                <div>
                                    <label className="block text-[10px] text-zinc-400 mb-1">Poziom uprawnień</label>
                                    <select
                                        value={permissionLevel}
                                        onChange={(e) => setPermissionLevel(e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-750 rounded p-1.5 text-zinc-200 text-xs focus:outline-none focus:border-purple-500"
                                    >
                                        <option value="view">Tylko podgląd (View-Only)</option>
                                        <option value="download">Pobieranie (Download)</option>
                                        <option value="manage">Zarządzanie (Manage)</option>
                                        <option value="none">Brak dostępu (None / Block)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Watermark checkbox and Submit */}
                            <div className="flex items-center justify-between pt-2 border-t border-zinc-850">
                                <label className="flex items-center gap-2 cursor-pointer text-[11px] text-zinc-300">
                                    <input
                                        type="checkbox"
                                        checked={watermarkRequired}
                                        onChange={(e) => setWatermarkRequired(e.target.checked)}
                                        className="rounded bg-zinc-900 border-zinc-750 text-amber-500 focus:ring-0"
                                    />
                                    <span>Wymagaj dynamicznego znaku wodnego (stempel tożsamości, IP, czas)</span>
                                </label>

                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="sm"
                                    loading={submitting}
                                    icon={Check}
                                >
                                    Zapisz Uprawnienie
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-500 shrink-0">
                    <span>
                        Hierarchia: Użytkownik &gt; Rola &gt; Dokument &gt; Folder (Dziedziczenie) &gt; Domyślna rola
                    </span>
                    <Button variant="secondary" size="xs" onClick={onClose}>
                        Zamknij
                    </Button>
                </div>
            </div>
        </div>
    );
};
