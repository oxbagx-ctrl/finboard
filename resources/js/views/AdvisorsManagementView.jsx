import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { MetricCard } from '../components/ui/Card';
import { AdvisorAssignmentModal } from '../components/advisors/AdvisorAssignmentModal';
import {
    Users,
    Building2,
    Shield,
    ShieldAlert,
    ShieldCheck,
    Search,
    Filter,
    RefreshCw,
    UserCheck,
    UserX,
    Briefcase,
    Plus,
    CheckCircle2,
    XCircle,
    SlidersHorizontal,
    ChevronRight,
    Lock
} from 'lucide-react';

export const AdvisorsManagementView = () => {
    const { user: currentUser } = useAuth();
    const { success, error } = useNotification();

    const [activeTab, setActiveTab] = useState('advisors'); // 'advisors' | 'companies'
    const [advisors, setAdvisors] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [loadingAdvisors, setLoadingAdvisors] = useState(true);
    const [loadingCompanies, setLoadingCompanies] = useState(true);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    // Modals
    const [selectedAdvisorForAssignment, setSelectedAdvisorForAssignment] = useState(null);
    const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
    const [actionInProgressId, setActionInProgressId] = useState(null);

    const fetchAdvisors = useCallback(async () => {
        setLoadingAdvisors(true);
        try {
            const params = {};
            if (searchQuery.trim()) params.search = searchQuery.trim();
            if (roleFilter !== 'all') params.role = roleFilter;
            if (statusFilter !== 'all') params.is_active = statusFilter === 'active';

            const res = await apiClient.get('/admin/advisors', { params });
            setAdvisors(res.data.data || []);
        } catch (err) {
            error('Nie udało się pobrać listy doradców z serwera.');
        } finally {
            setLoadingAdvisors(false);
        }
    }, [searchQuery, roleFilter, statusFilter, error]);

    const fetchCompanies = useCallback(async () => {
        setLoadingCompanies(true);
        try {
            const res = await apiClient.get('/admin/companies');
            setCompanies(res.data.data || []);
        } catch (err) {
            error('Nie udało się pobrać listy spółek z serwera.');
        } finally {
            setLoadingCompanies(false);
        }
    }, [error]);

    useEffect(() => {
        fetchAdvisors();
    }, [fetchAdvisors]);

    useEffect(() => {
        fetchCompanies();
    }, [fetchCompanies]);

    const handleToggleStatus = async (advisor) => {
        if (advisor.id === currentUser?.id) {
            error('Nie można dezaktywować własnego konta administratora.');
            return;
        }

        setActionInProgressId(advisor.id);
        try {
            const res = await apiClient.patch(`/admin/advisors/${advisor.id}/toggle-status`);
            success(res.data.message || 'Status konta doradcy został pomyślnie zaktualizowany.');
            // Update in local state
            setAdvisors(prev => prev.map(a => a.id === advisor.id ? res.data.data : a));
        } catch (err) {
            const msg = err.response?.data?.message || 'Nie udało się zmienić statusu konta.';
            error(msg);
        } finally {
            setActionInProgressId(null);
        }
    };

    const handleOpenAssignmentModal = (advisor) => {
        setSelectedAdvisorForAssignment(advisor);
        setAssignmentModalOpen(true);
    };

    const handleAdvisorSaved = (updatedAdvisor) => {
        setAdvisors(prev => prev.map(a => a.id === updatedAdvisor.id ? updatedAdvisor : a));
        fetchCompanies(); // Refresh counts in companies matrix
    };

    // Derived statistics
    const stats = useMemo(() => {
        const totalAdvisors = advisors.length;
        const activeAdvisors = advisors.filter(a => a.is_active).length;
        const totalCompanies = companies.length;
        const totalAssignments = advisors.reduce((acc, a) => acc + (a.assigned_companies_count || 0), 0);
        const avgAssignments = totalAdvisors > 0 ? (totalAssignments / totalAdvisors).toFixed(1) : '0.0';

        return {
            totalAdvisors,
            activeAdvisors,
            totalCompanies,
            avgAssignments,
        };
    }, [advisors, companies]);

    return (
        <div className="space-y-4 font-mono">
            {/* Top Terminal Strip Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3.5">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-zinc-850 border border-zinc-750 flex items-center justify-center text-zinc-200">
                        <Shield className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-zinc-100 flex items-center gap-2">
                            <span>Zarządzanie Doradcami & Uprawnieniami Portfela</span>
                            <Badge variant="purple" size="sm">SUPER ADMIN ACCESS</Badge>
                            <span className="text-zinc-600 font-normal">|</span>
                            <span className="text-zinc-400 font-normal text-[11px]">MATRYCA TENANT</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                            Konfiguracja relacji doradca-spółka oraz kontrola dostępu do danych Due Diligence
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        icon={RefreshCw}
                        onClick={() => { fetchAdvisors(); fetchCompanies(); }}
                        disabled={loadingAdvisors || loadingCompanies}
                    >
                        Odśwież
                    </Button>
                </div>
            </div>

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard
                    title="Doradcy & Partnerzy"
                    value={stats.totalAdvisors}
                    icon={Users}
                    subtitle={`AKTYWNI W SYSTEMIE: ${stats.activeAdvisors}`}
                    isRatio={true}
                />
                <MetricCard
                    title="Spółki w Portfelu"
                    value={stats.totalCompanies}
                    icon={Building2}
                    subtitle="PODMIOTY GOSPODARCZE"
                    isRatio={true}
                />
                <MetricCard
                    title="Śr. Przypisań / Doradcę"
                    value={`${stats.avgAssignments}x`}
                    icon={Briefcase}
                    subtitle="POKRYCIE PORTFELA"
                    isRatio={true}
                />
                <MetricCard
                    title="Izolacja Danych"
                    value="STRICT"
                    icon={ShieldCheck}
                    subtitle="MULTI-TENANT RBAC"
                    isRatio={true}
                />
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
                <button
                    type="button"
                    onClick={() => setActiveTab('advisors')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                        activeTab === 'advisors'
                            ? 'bg-zinc-100 text-zinc-950 shadow-xs'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                    }`}
                >
                    <Users className="w-3.5 h-3.5" />
                    <span>Rejestr Doradców ({advisors.length})</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('companies')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                        activeTab === 'companies'
                            ? 'bg-zinc-100 text-zinc-950 shadow-xs'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                    }`}
                >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Matryca Spółek Portfelowych ({companies.length})</span>
                </button>
            </div>

            {/* Tab 1: Advisors List */}
            {activeTab === 'advisors' && (
                <div className="space-y-3">
                    {/* Filters Bar */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="relative flex-1 max-w-md">
                            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Szukaj po nazwisku lub adresie email..."
                                className="w-full bg-zinc-950 border border-zinc-750 rounded pl-9 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-zinc-500">ROLA:</span>
                                <select
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value)}
                                    className="bg-zinc-950 border border-zinc-750 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                                >
                                    <option value="all">Wszystkie</option>
                                    <option value="advisor">Doradca (Advisor)</option>
                                    <option value="super_admin">Super Admin</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-zinc-500">STATUS:</span>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="bg-zinc-950 border border-zinc-750 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                                >
                                    <option value="all">Wszystkie</option>
                                    <option value="active">Tylko aktywni</option>
                                    <option value="inactive">Tylko nieaktywni</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Advisors Table */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-zinc-950/80 border-b border-zinc-800 text-zinc-400 font-semibold uppercase text-[10px] tracking-wider">
                                        <th className="py-2.5 px-4">Doradca / Użytkownik</th>
                                        <th className="py-2.5 px-3">Rola</th>
                                        <th className="py-2.5 px-3">Status</th>
                                        <th className="py-2.5 px-4">Przypisane Spółki</th>
                                        <th className="py-2.5 px-3 text-right">Data Utworzenia</th>
                                        <th className="py-2.5 px-4 text-right">Operacje</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/80">
                                    {loadingAdvisors ? (
                                        <tr>
                                            <td colSpan={6} className="py-12 text-center text-zinc-500">
                                                Ładowanie listy doradców...
                                            </td>
                                        </tr>
                                    ) : advisors.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-12 text-center text-zinc-500">
                                                Brak doradców spełniających kryteria filtra.
                                            </td>
                                        </tr>
                                    ) : (
                                        advisors.map((adv) => {
                                            const isSelf = adv.id === currentUser?.id;
                                            const isPendingAction = actionInProgressId === adv.id;

                                            return (
                                                <tr key={adv.id} className="hover:bg-zinc-850/40 transition-colors">
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-7 h-7 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-zinc-300 text-xs shrink-0">
                                                                {adv.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="font-semibold text-zinc-100 flex items-center gap-1.5 truncate">
                                                                    <span className="truncate">{adv.name}</span>
                                                                    {isSelf && (
                                                                        <span className="text-[9px] px-1 py-0.2 rounded bg-purple-950 border border-purple-800 text-purple-300">
                                                                            TY
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-[10px] text-zinc-500 truncate">
                                                                    {adv.email}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="py-3 px-3">
                                                        <Badge
                                                            variant={adv.role === 'super_admin' ? 'purple' : 'brand'}
                                                            size="sm"
                                                        >
                                                            {adv.role === 'super_admin' ? 'SUPER ADMIN' : 'DORADCA M&A'}
                                                        </Badge>
                                                    </td>

                                                    <td className="py-3 px-3">
                                                        <Badge
                                                            variant={adv.is_active ? 'success' : 'danger'}
                                                            size="sm"
                                                        >
                                                            {adv.is_active ? 'AKTYWNY' : 'NIEAKTYWNY'}
                                                        </Badge>
                                                    </td>

                                                    <td className="py-3 px-4 max-w-xs">
                                                        {adv.role === 'super_admin' ? (
                                                            <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 italic">
                                                                <Lock className="w-3 h-3 text-purple-400 shrink-0" />
                                                                <span>Dostęp globalny (wszystkie spółki)</span>
                                                            </div>
                                                        ) : (adv.assigned_companies || []).length === 0 ? (
                                                            <span className="text-[11px] text-zinc-600 italic">
                                                                Brak przypisanych spółek
                                                            </span>
                                                        ) : (
                                                            <div className="flex flex-wrap gap-1">
                                                                {adv.assigned_companies.map((comp) => (
                                                                    <Badge
                                                                        key={comp.id}
                                                                        variant="default"
                                                                        size="sm"
                                                                        title={`${comp.name} (NIP: ${comp.tax_id || 'Brak'})`}
                                                                    >
                                                                        {comp.code}
                                                                    </Badge>
                                                                ))}
                                                                <span className="text-[10px] text-zinc-500 self-center ml-1">
                                                                    ({adv.assigned_companies.length})
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>

                                                    <td className="py-3 px-3 text-right text-[11px] text-zinc-500 tabular-nums">
                                                        {adv.created_at ? adv.created_at.substring(0, 10) : 'N/A'}
                                                    </td>

                                                    <td className="py-3 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <Button
                                                                variant="secondary"
                                                                size="sm"
                                                                icon={Building2}
                                                                onClick={() => handleOpenAssignmentModal(adv)}
                                                                title="Zarządzaj przypisanymi spółkami"
                                                            >
                                                                Spółki
                                                            </Button>

                                                            <Button
                                                                variant={adv.is_active ? 'outline' : 'success'}
                                                                size="sm"
                                                                icon={adv.is_active ? UserX : UserCheck}
                                                                onClick={() => handleToggleStatus(adv)}
                                                                disabled={isSelf || isPendingAction}
                                                                loading={isPendingAction}
                                                                title={isSelf ? 'Nie można dezaktywować własnego konta' : adv.is_active ? 'Dezaktywuj konto' : 'Aktywuj konto'}
                                                            >
                                                                {adv.is_active ? 'Dezaktywuj' : 'Aktywuj'}
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 2: Companies Portfolio Matrix */}
            {activeTab === 'companies' && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-sm">
                    <div className="p-3 bg-zinc-950/80 border-b border-zinc-800 flex items-center justify-between">
                        <div>
                            <h3 className="text-xs font-bold text-zinc-100 uppercase">
                                Matryca Pokrycia Spółek Przez Doradców
                            </h3>
                            <p className="text-[10px] text-zinc-500">
                                Zestawienie podmiotów portfelowych wraz z obsadą analityczną Deal Advisory
                            </p>
                        </div>
                        <Badge variant="default" size="sm">
                            PODMIOTÓW: {companies.length}
                        </Badge>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-zinc-950/60 border-b border-zinc-800 text-zinc-400 font-semibold uppercase text-[10px] tracking-wider">
                                    <th className="py-2.5 px-4">Kod</th>
                                    <th className="py-2.5 px-4">Nazwa Spółki</th>
                                    <th className="py-2.5 px-3">NIP</th>
                                    <th className="py-2.5 px-4">Przypisani Doradcy</th>
                                    <th className="py-2.5 px-3 text-center">Liczba Doradców</th>
                                    <th className="py-2.5 px-3 text-center">Liczba Klientów</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/80">
                                {loadingCompanies ? (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-zinc-500">
                                            Ładowanie matrycy spółek...
                                        </td>
                                    </tr>
                                ) : companies.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-zinc-500">
                                            Brak spółek w rejestrze.
                                        </td>
                                    </tr>
                                ) : (
                                    companies.map((comp) => (
                                        <tr key={comp.id} className="hover:bg-zinc-850/40 transition-colors">
                                            <td className="py-3 px-4">
                                                <Badge variant="default" size="md">
                                                    {comp.code}
                                                </Badge>
                                            </td>

                                            <td className="py-3 px-4">
                                                <div className="font-semibold text-zinc-100">
                                                    {comp.name}
                                                </div>
                                                <div className="text-[10px] text-zinc-500">
                                                    ID: {comp.id.substring(0, 8)}...
                                                </div>
                                            </td>

                                            <td className="py-3 px-3 text-zinc-400 tabular-nums">
                                                {comp.tax_id || 'Brak NIP'}
                                            </td>

                                            <td className="py-3 px-4">
                                                {(comp.assigned_advisors || []).length === 0 ? (
                                                    <span className="text-[11px] text-rose-400 italic flex items-center gap-1">
                                                        <ShieldAlert className="w-3 h-3" />
                                                        Brak dedykowanego doradcy
                                                    </span>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1">
                                                        {comp.assigned_advisors.map((adv) => (
                                                            <Badge
                                                                key={adv.id}
                                                                variant={adv.is_active ? 'brand' : 'danger'}
                                                                size="sm"
                                                                title={adv.email}
                                                            >
                                                                {adv.name}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>

                                            <td className="py-3 px-3 text-center tabular-nums">
                                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                                    comp.assigned_advisors_count > 0
                                                        ? 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                                                        : 'bg-rose-950/60 text-rose-400 border border-rose-800'
                                                }`}>
                                                    {comp.assigned_advisors_count}
                                                </span>
                                            </td>

                                            <td className="py-3 px-3 text-center tabular-nums">
                                                <span className="px-2 py-0.5 rounded text-[11px] bg-zinc-800 text-zinc-300 border border-zinc-700">
                                                    {comp.clients_count}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal: Advisor Company Assignments */}
            <AdvisorAssignmentModal
                isOpen={assignmentModalOpen}
                onClose={() => setAssignmentModalOpen(false)}
                advisor={selectedAdvisorForAssignment}
                onSaved={handleAdvisorSaved}
            />
        </div>
    );
};
