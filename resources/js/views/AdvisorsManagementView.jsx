import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { MetricCard } from '../components/ui/Card';
import { AdvisorAssignmentModal } from '../components/advisors/AdvisorAssignmentModal';
import { InviteUserModal } from '../components/advisors/InviteUserModal';
import { CreateCompanyModal } from '../components/advisors/CreateCompanyModal';
import { SmtpStatusWidget } from '../components/advisors/SmtpStatusWidget';
import { TestMailModal } from '../components/advisors/TestMailModal';
import {
    Users,
    Building2,
    Shield,
    ShieldAlert,
    ShieldCheck,
    Search,
    RefreshCw,
    UserCheck,
    UserX,
    Briefcase,
    UserPlus,
    Clock,
    RotateCw,
    XCircle,
    Mail,
    Lock,
    Send,
    Copy,
    Check,
    CheckCircle2,
    X,
    Server
} from 'lucide-react';

export const AdvisorsManagementView = () => {
    const { user: currentUser, isSuperAdmin, isAdvisor, refreshUser } = useAuth();
    const { success, error } = useNotification();

    // Default tab: Advisors see invitations by default, Admins see advisors list
    const [activeTab, setActiveTab] = useState(isAdvisor ? 'invitations' : 'advisors'); // 'advisors' | 'companies' | 'invitations'
    const [advisors, setAdvisors] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [invitations, setInvitations] = useState([]);

    const [loadingAdvisors, setLoadingAdvisors] = useState(true);
    const [loadingCompanies, setLoadingCompanies] = useState(true);
    const [loadingInvitations, setLoadingInvitations] = useState(false);

    // Filters for Advisors
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    // Filters for Invitations
    const [invitationSearch, setInvitationSearch] = useState('');
    const [invitationStatusFilter, setInvitationStatusFilter] = useState('all');

    // Modals
    const [selectedAdvisorForAssignment, setSelectedAdvisorForAssignment] = useState(null);
    const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    const [createCompanyModalOpen, setCreateCompanyModalOpen] = useState(false);
    const [actionInProgressId, setActionInProgressId] = useState(null);
    const [copiedId, setCopiedId] = useState(null);
    const [activationModalInvitation, setActivationModalInvitation] = useState(null);
    const [modalCopied, setModalCopied] = useState(false);
    const [testMailModalOpen, setTestMailModalOpen] = useState(false);

    const fetchAdvisors = useCallback(async () => {
        if (isAdvisor) return; // Advisors do not list other advisors
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
    }, [searchQuery, roleFilter, statusFilter, isAdvisor, error]);

    const fetchCompanies = useCallback(async () => {
        setLoadingCompanies(true);
        try {
            const res = await apiClient.get('/admin/companies');
            setCompanies(res.data.data || []);
        } catch (err) {
            // If advisor doesn't have permission to global admin/companies, ignore or set empty
        } finally {
            setLoadingCompanies(false);
        }
    }, []);

    const fetchInvitations = useCallback(async () => {
        setLoadingInvitations(true);
        try {
            const params = {};
            if (invitationSearch.trim()) params.search = invitationSearch.trim();
            if (invitationStatusFilter !== 'all') params.status = invitationStatusFilter;

            const res = await apiClient.get('/invitations', { params });
            setInvitations(res.data.data || []);
        } catch (err) {
            error('Nie udało się pobrać rejestru zaproszeń.');
        } finally {
            setLoadingInvitations(false);
        }
    }, [invitationSearch, invitationStatusFilter, error]);

    useEffect(() => {
        if (!isAdvisor) {
            fetchAdvisors();
        }
    }, [fetchAdvisors, isAdvisor]);

    useEffect(() => {
        if (!isAdvisor) {
            fetchCompanies();
        }
    }, [fetchCompanies, isAdvisor]);

    useEffect(() => {
        fetchInvitations();
    }, [fetchInvitations]);

    const handleToggleStatus = async (advisor) => {
        if (advisor.id === currentUser?.id) {
            error('Nie można dezaktywować własnego konta administratora.');
            return;
        }

        setActionInProgressId(advisor.id);
        try {
            const res = await apiClient.patch(`/admin/advisors/${advisor.id}/toggle-status`);
            success(res.data.message || 'Status konta doradcy został pomyślnie zaktualizowany.');
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
        fetchCompanies();
    };

    const handleResendInvitation = async (inv) => {
        setActionInProgressId(inv.id);
        try {
            const res = await apiClient.post(`/invitations/${inv.id}/resend`);
            success(res.data.message || 'Nowe zaproszenie zostało pomyślnie wysłane.');
            fetchInvitations();
        } catch (err) {
            const msg = err.response?.data?.message || 'Nie udało się ponownie wysłać zaproszenia.';
            error(msg);
        } finally {
            setActionInProgressId(null);
        }
    };

    const handleRevokeInvitation = async (inv) => {
        setActionInProgressId(inv.id);
        try {
            const res = await apiClient.delete(`/invitations/${inv.id}`);
            success(res.data.message || 'Zaproszenie zostało pomyślnie anulowane.');
            fetchInvitations();
        } catch (err) {
            const msg = err.response?.data?.message || 'Nie udało się unieważnić zaproszenia.';
            error(msg);
        } finally {
            setActionInProgressId(null);
        }
    };

    const copyTextToClipboard = async (text) => {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const successful = document.execCommand('copy');
            textArea.remove();
            return successful;
        } catch (e) {
            return false;
        }
    };

    const handleCopyActivationUrl = async (inv) => {
        const url = inv.activation_url || `${window.location.origin}/register?invitation_token=${inv.token}`;
        try {
            const ok = await copyTextToClipboard(url);
            if (ok) {
                setCopiedId(inv.id);
                success(`Link aktywacyjny dla ${inv.email} został skopiowany do schowka.`);
                setTimeout(() => {
                    setCopiedId(prev => (prev === inv.id ? null : prev));
                }, 3000);
            } else {
                error('Nie udało się skopiować linku do schowka.');
            }
        } catch (err) {
            error('Błąd podczas kopiowania linku aktywacyjnego.');
        }
    };

    const handleCopyModalUrl = async (url) => {
        try {
            const ok = await copyTextToClipboard(url);
            if (ok) {
                setModalCopied(true);
                success('Link aktywacyjny został pomyślnie skopiowany do schowka.');
                setTimeout(() => setModalCopied(false), 3000);
            } else {
                error('Nie udało się skopiować linku do schowka.');
            }
        } catch (err) {
            error('Błąd podczas kopiowania linku aktywacyjnego.');
        }
    };

    // Derived statistics
    const stats = useMemo(() => {
        const totalAdvisors = advisors.length;
        const activeAdvisors = advisors.filter(a => a.is_active).length;
        const totalCompanies = companies.length;
        const pendingInvitations = invitations.filter(i => i.status === 'pending').length;
        const acceptedInvitations = invitations.filter(i => i.status === 'accepted').length;

        return {
            totalAdvisors,
            activeAdvisors,
            totalCompanies,
            pendingInvitations,
            acceptedInvitations,
        };
    }, [advisors, companies, invitations]);

    const getStatusBadge = (status) => {
        switch (status) {
            case 'pending':
                return <Badge variant="warning" size="sm">OCZEKUJE</Badge>;
            case 'accepted':
                return <Badge variant="success" size="sm">ZAAKCEPTOWANE</Badge>;
            case 'revoked':
                return <Badge variant="danger" size="sm">ANULOWANE</Badge>;
            case 'expired':
                return <Badge variant="default" size="sm">WYGASŁE</Badge>;
            default:
                return <Badge variant="default" size="sm">{status.toUpperCase()}</Badge>;
        }
    };

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
                            <span>
                                {isAdvisor
                                    ? 'Panel Zarządzania Zaproszeniami i Zespołem Klienta'
                                    : 'Zarządzanie Doradcami & Uprawnieniami Portfela'}
                            </span>
                            <Badge variant={isSuperAdmin ? 'purple' : 'brand'} size="sm">
                                {isSuperAdmin ? 'SUPER ADMIN' : isAdvisor ? 'DORADCA M&A' : 'ADMIN'}
                            </Badge>
                            <span className="text-zinc-600 font-normal">|</span>
                            <span className="text-zinc-400 font-normal text-[11px]">MULTI-TENANT RBAC</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                            Rejestracja użytkowników przez bezpieczne tokeny oraz konfiguracja relacji doradca-spółka
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {!isAdvisor && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                icon={Send}
                                onClick={() => setTestMailModalOpen(true)}
                                title="Diagnostyka połączenia i testowy email SMTP"
                            >
                                Testuj SMTP
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                icon={Building2}
                                onClick={() => setCreateCompanyModalOpen(true)}
                            >
                                Dodaj Spółkę
                            </Button>
                        </>
                    )}
                    <Button
                        variant="primary"
                        size="sm"
                        icon={UserPlus}
                        onClick={() => setInviteModalOpen(true)}
                    >
                        Zaproś Użytkownika
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        icon={RefreshCw}
                        onClick={() => {
                            if (!isAdvisor) {
                                fetchAdvisors();
                                fetchCompanies();
                            }
                            fetchInvitations();
                        }}
                        disabled={loadingAdvisors || loadingCompanies || loadingInvitations}
                    >
                        Odśwież
                    </Button>
                </div>
            </div>

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {!isAdvisor ? (
                    <>
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
                    </>
                ) : (
                    <>
                        <MetricCard
                            title="Twoja Rola"
                            value="DORADCA"
                            icon={Briefcase}
                            subtitle="DEAL ADVISORY"
                            isRatio={true}
                        />
                        <MetricCard
                            title="Izolacja Najemcy"
                            value="STRICT"
                            icon={ShieldCheck}
                            subtitle="DOSTĘP DO PRZYPISANYCH"
                            isRatio={true}
                        />
                    </>
                )}
                <MetricCard
                    title="Oczekujące Zaproszenia"
                    value={stats.pendingInvitations}
                    icon={Mail}
                    subtitle="WYGASAJĄ PO 48 GODZINACH"
                    isRatio={true}
                />
                <MetricCard
                    title="Aktywowane Konta"
                    value={stats.acceptedInvitations}
                    icon={UserCheck}
                    subtitle="ZAPROSZENIA ZAAKCEPTOWANE"
                    isRatio={true}
                />
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
                {!isAdvisor && (
                    <>
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
                    </>
                )}
                <button
                    type="button"
                    onClick={() => setActiveTab('invitations')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                        activeTab === 'invitations'
                            ? 'bg-zinc-100 text-zinc-950 shadow-xs'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                    }`}
                >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Wysłane Zaproszenia ({invitations.length})</span>
                </button>
                {!isAdvisor && (
                    <button
                        type="button"
                        onClick={() => setActiveTab('mail')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                            activeTab === 'mail'
                                ? 'bg-zinc-100 text-zinc-950 shadow-xs'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                        }`}
                    >
                        <Server className="w-3.5 h-3.5" />
                        <span>Diagnostyka SMTP</span>
                    </button>
                )}
            </div>

            {/* Tab 1: Advisors List */}
            {activeTab === 'advisors' && !isAdvisor && (
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
                                                            <div className="w-7 h-7 rounded bg-zinc-850 border border-zinc-750 flex items-center justify-center font-bold text-zinc-300 text-xs shrink-0">
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
            {activeTab === 'companies' && !isAdvisor && (
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
                        <div className="flex items-center gap-2">
                            <Badge variant="default" size="sm">
                                PODMIOTÓW: {companies.length}
                            </Badge>
                            <Button
                                variant="primary"
                                size="sm"
                                icon={Building2}
                                onClick={() => setCreateCompanyModalOpen(true)}
                            >
                                Dodaj Spółkę
                            </Button>
                        </div>
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

            {/* Tab 3: Invitations Register */}
            {activeTab === 'invitations' && (
                <div className="space-y-3">
                    {!isAdvisor && (
                        <SmtpStatusWidget
                            compact={true}
                            onOpenTestModal={() => setTestMailModalOpen(true)}
                        />
                    )}

                    {/* Filters Bar */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="relative flex-1 max-w-md">
                            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={invitationSearch}
                                onChange={(e) => setInvitationSearch(e.target.value)}
                                placeholder="Szukaj zaproszenia po adresie email..."
                                className="w-full bg-zinc-950 border border-zinc-750 rounded pl-9 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                            />
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                            <span className="text-[11px] text-zinc-500">STATUS:</span>
                            <select
                                value={invitationStatusFilter}
                                onChange={(e) => setInvitationStatusFilter(e.target.value)}
                                className="bg-zinc-950 border border-zinc-750 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                            >
                                <option value="all">Wszystkie statusy</option>
                                <option value="pending">Oczekujące (Pending)</option>
                                <option value="accepted">Zaakceptowane (Accepted)</option>
                                <option value="expired">Wygasłe (Expired)</option>
                                <option value="revoked">Anulowane (Revoked)</option>
                            </select>
                        </div>
                    </div>

                    {/* Invitations Table */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-zinc-950/80 border-b border-zinc-800 text-zinc-400 font-semibold uppercase text-[10px] tracking-wider">
                                        <th className="py-2.5 px-4">Adres E-mail Odbiorcy</th>
                                        <th className="py-2.5 px-3">Rola</th>
                                        <th className="py-2.5 px-4">Spółka / Przypisania</th>
                                        <th className="py-2.5 px-3">Status</th>
                                        <th className="py-2.5 px-3">Wygasa</th>
                                        <th className="py-2.5 px-3">Zapraszający</th>
                                        <th className="py-2.5 px-4 text-right">Operacje</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/80">
                                    {loadingInvitations ? (
                                        <tr>
                                            <td colSpan={7} className="py-12 text-center text-zinc-500">
                                                Ładowanie rejestru zaproszeń...
                                            </td>
                                        </tr>
                                    ) : invitations.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-12 text-center text-zinc-500">
                                                Brak zaproszeń spełniających wybrane kryteria.
                                            </td>
                                        </tr>
                                    ) : (
                                        invitations.map((inv) => {
                                            const isPending = inv.status === 'pending';
                                            const isExpired = inv.status === 'expired';
                                            const isActionRunning = actionInProgressId === inv.id;

                                            return (
                                                <tr key={inv.id} className="hover:bg-zinc-850/40 transition-colors">
                                                    <td className="py-3 px-4">
                                                        <div className="font-semibold text-zinc-100 flex items-center gap-2">
                                                            <Mail className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                                            <span>{inv.email}</span>
                                                        </div>
                                                        <div className="text-[10px] text-zinc-500 mt-0.5">
                                                            Utworzono: {inv.created_at ? inv.created_at.substring(0, 10) : 'N/A'}
                                                        </div>
                                                    </td>

                                                    <td className="py-3 px-3">
                                                        <Badge
                                                            variant={
                                                                inv.role === 'super_admin'
                                                                    ? 'purple'
                                                                    : inv.role === 'advisor'
                                                                    ? 'brand'
                                                                    : 'default'
                                                            }
                                                            size="sm"
                                                        >
                                                            {inv.role === 'super_admin' ? 'SUPER ADMIN' : inv.role === 'advisor' ? 'DORADCA' : 'KLIENT'}
                                                        </Badge>
                                                    </td>

                                                    <td className="py-3 px-4">
                                                        {inv.role === 'client' && inv.company ? (
                                                            <div className="flex items-center gap-1.5">
                                                                <Badge variant="default" size="sm">{inv.company.code}</Badge>
                                                                <span className="text-zinc-300 truncate max-w-[160px]">{inv.company.name}</span>
                                                            </div>
                                                        ) : inv.role === 'advisor' ? (
                                                            <span className="text-zinc-400 text-[11px]">
                                                                {inv.assigned_companies_count > 0
                                                                    ? `Przypisano do ${inv.assigned_companies_count} spółek`
                                                                    : 'Bez początkowych spółek'}
                                                            </span>
                                                        ) : (
                                                            <span className="text-zinc-500 text-[11px] italic">Dostęp globalny</span>
                                                        )}
                                                    </td>

                                                    <td className="py-3 px-3">
                                                        {getStatusBadge(inv.status)}
                                                    </td>

                                                    <td className="py-3 px-3 text-[11px] text-zinc-400 tabular-nums">
                                                        {inv.expires_at ? (
                                                            <div className="flex items-center gap-1">
                                                                <Clock className="w-3 h-3 text-zinc-500" />
                                                                <span>{inv.expires_at.replace('T', ' ').substring(0, 16)}</span>
                                                            </div>
                                                        ) : 'Brak limitu'}
                                                    </td>

                                                    <td className="py-3 px-3 text-[11px] text-zinc-400">
                                                        {inv.inviter?.name || 'Administrator'}
                                                    </td>

                                                    <td className="py-3 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            {isPending && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    icon={copiedId === inv.id ? Check : Copy}
                                                                    onClick={() => handleCopyActivationUrl(inv)}
                                                                    className={copiedId === inv.id ? 'text-emerald-400 border-emerald-500/50 bg-emerald-950/20' : ''}
                                                                    title="Kopiuj bezpieczny link aktywacyjny do schowka"
                                                                >
                                                                    {copiedId === inv.id ? 'Skopiowano' : 'Kopiuj link'}
                                                                </Button>
                                                            )}
                                                            {(isPending || isExpired) && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    icon={RotateCw}
                                                                    onClick={() => handleResendInvitation(inv)}
                                                                    disabled={isActionRunning}
                                                                    loading={isActionRunning}
                                                                    title="Wyślij ponownie z nowym 48h tokenem"
                                                                >
                                                                    Wyślij ponownie
                                                                </Button>
                                                            )}
                                                            {isPending && (
                                                                <Button
                                                                    variant="danger"
                                                                    size="sm"
                                                                    icon={XCircle}
                                                                    onClick={() => handleRevokeInvitation(inv)}
                                                                    disabled={isActionRunning}
                                                                    title="Unieważnij to zaproszenie"
                                                                >
                                                                    Anuluj
                                                                </Button>
                                                            )}
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

            {/* Tab 4: SMTP Mail Diagnostics */}
            {activeTab === 'mail' && !isAdvisor && (
                <div className="space-y-4">
                    <SmtpStatusWidget
                        onOpenTestModal={() => setTestMailModalOpen(true)}
                    />
                </div>
            )}

            {/* Modal: Advisor Company Assignments */}
            <AdvisorAssignmentModal
                isOpen={assignmentModalOpen}
                onClose={() => setAssignmentModalOpen(false)}
                advisor={selectedAdvisorForAssignment}
                companies={companies}
                onSaved={handleAdvisorSaved}
            />

            {/* Modal: Invite User */}
            <InviteUserModal
                isOpen={inviteModalOpen}
                onClose={() => setInviteModalOpen(false)}
                companies={companies}
                onSuccess={(newInv) => {
                    fetchInvitations();
                    if (!isAdvisor) {
                        fetchAdvisors();
                    }
                    if (newInv?.activation_url) {
                        setActivationModalInvitation(newInv);
                        setModalCopied(false);
                    }
                }}
            />

            {/* Modal: Activation Link Confirmation */}
            {activationModalInvitation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-xs font-mono">
                    <div className="bg-zinc-900 border border-zinc-750 rounded-lg shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col">
                        <div className="px-5 py-3.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded bg-emerald-950/60 border border-emerald-700/60 flex items-center justify-center text-emerald-400">
                                    <CheckCircle2 className="w-4 h-4" />
                                </div>
                                <div>
                                    <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-100">
                                        Zaproszenie Utworzone
                                    </h2>
                                    <p className="text-[10px] text-zinc-500 mt-0.5">
                                        BEZPOŚREDNI LINK AKTYWACYJNY DLA UŻYTKOWNIKA
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setActivationModalInvitation(null)}
                                className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="p-3 rounded bg-emerald-950/30 border border-emerald-800/60 flex items-start gap-2.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                <div className="text-[11px] text-zinc-300 leading-relaxed">
                                    Zaproszenie dla <span className="font-semibold text-emerald-300">{activationModalInvitation.email}</span> zostało wygenerowane. Jeśli serwer pocztowy napotka problem z dostarczeniem, możesz ręcznie przekazać poniższy unikalny link (ważny 48h).
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                                    Link Rejestracyjny i Aktywacyjny
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        readOnly
                                        value={activationModalInvitation.activation_url}
                                        className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-750 rounded text-zinc-200 font-mono select-all focus:outline-none focus:border-brand"
                                    />
                                    <Button
                                        variant={modalCopied ? 'outline' : 'primary'}
                                        size="sm"
                                        icon={modalCopied ? Check : Copy}
                                        onClick={() => handleCopyModalUrl(activationModalInvitation.activation_url)}
                                        className={modalCopied ? 'text-emerald-400 border-emerald-500/50 bg-emerald-950/20' : ''}
                                    >
                                        {modalCopied ? 'Skopiowano' : 'Kopiuj'}
                                    </Button>
                                </div>
                            </div>

                            <div className="flex justify-end pt-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setActivationModalInvitation(null)}
                                >
                                    Zamknij
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Create Company */}
            <CreateCompanyModal
                isOpen={createCompanyModalOpen}
                onClose={() => setCreateCompanyModalOpen(false)}
                onSuccess={(newCompany) => {
                    if (newCompany) {
                        setCompanies(prev => {
                            if (prev.some(c => c.id === newCompany.id)) return prev;
                            return [newCompany, ...prev];
                        });
                    }
                    fetchCompanies();
                    if (!isAdvisor) {
                        fetchAdvisors();
                    }
                    if (refreshUser) {
                        refreshUser();
                    }
                }}
            />

            {/* Modal: Test Mail SMTP */}
            <TestMailModal
                isOpen={testMailModalOpen}
                onClose={() => setTestMailModalOpen(false)}
            />
        </div>
    );
};
