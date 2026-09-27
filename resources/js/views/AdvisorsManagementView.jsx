import React, { useState, useEffect, useMemo, useCallback } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { MetricCard } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Tooltip, InfoTooltip } from '../components/ui/Tooltip';
import { AdvisorAssignmentModal } from '../components/advisors/AdvisorAssignmentModal';
import { InviteUserModal } from '../components/advisors/InviteUserModal';
import { CreateCompanyModal } from '../components/advisors/CreateCompanyModal';
import { SmtpStatusWidget } from '../components/advisors/SmtpStatusWidget';
import { TestMailModal } from '../components/advisors/TestMailModal';
import {
    Shield,
    Users,
    Building2,
    Mail,
    UserPlus,
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle,
    RotateCw,
    Search,
    Filter,
    ShieldAlert,
    ExternalLink,
    Lock,
    UserCheck,
    UserX,
    Copy,
    Check,
    X,
    Server,
    HelpCircle
} from 'lucide-react';

export const AdvisorsManagementView = () => {
    const { user: currentUser, isSuperAdmin, isAdvisor, refreshUser } = useAuth();
    const { success, error } = useNotification();

    // Tabs: 'advisors' | 'companies' | 'invitations' | 'mail'
    const [activeTab, setActiveTab] = useState('advisors');

    // Data states
    const [advisors, setAdvisors] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [loadingAdvisors, setLoadingAdvisors] = useState(false);
    const [loadingCompanies, setLoadingCompanies] = useState(false);
    const [loadingInvitations, setLoadingInvitations] = useState(false);

    // Filters for Advisors
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    // Filters for Invitations
    const [invitationSearch, setInvitationSearch] = useState('');
    const [invitationStatusFilter, setInvitationStatusFilter] = useState('all');

    // Modal states
    const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
    const [selectedAdvisorForAssignment, setSelectedAdvisorForAssignment] = useState(null);
    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    const [createCompanyModalOpen, setCreateCompanyModalOpen] = useState(false);
    const [testMailModalOpen, setTestMailModalOpen] = useState(false);
    const [activationModalInvitation, setActivationModalInvitation] = useState(null);
    const [modalCopied, setModalCopied] = useState(false);

    // Action tracking
    const [actionInProgressId, setActionInProgressId] = useState(null);
    const [copiedId, setCopiedId] = useState(null);

    // Fetch Advisors
    const fetchAdvisors = useCallback(async () => {
        setLoadingAdvisors(true);
        try {
            const params = {};
            if (roleFilter !== 'all') params.role = roleFilter;
            if (statusFilter !== 'all') params.status = statusFilter;
            if (searchQuery.trim()) params.search = searchQuery.trim();

            const res = await apiClient.get('/admin/advisors', { params });
            setAdvisors(res.data.data || []);
        } catch (err) {
            error('Nie udało się pobrać listy doradców.');
        } finally {
            setLoadingAdvisors(false);
        }
    }, [roleFilter, statusFilter, searchQuery, error]);

    // Fetch Companies
    const fetchCompanies = useCallback(async () => {
        setLoadingCompanies(true);
        try {
            const res = await apiClient.get('/admin/companies');
            setCompanies(res.data.data || []);
        } catch (err) {
            error('Nie udało się pobrać listy spółek.');
        } finally {
            setLoadingCompanies(false);
        }
    }, [error]);

    // Fetch Invitations
    const fetchInvitations = useCallback(async () => {
        setLoadingInvitations(true);
        try {
            const params = {};
            if (invitationStatusFilter !== 'all') params.status = invitationStatusFilter;
            if (invitationSearch.trim()) params.search = invitationSearch.trim();

            const res = await apiClient.get('/invitations', { params });
            setInvitations(res.data.data || []);
        } catch (err) {
            error('Nie udało się pobrać rejestru zaproszeń.');
        } finally {
            setLoadingInvitations(false);
        }
    }, [invitationStatusFilter, invitationSearch, error]);

    // Initial load
    useEffect(() => {
        if (!isAdvisor) {
            fetchAdvisors();
            fetchCompanies();
        }
        fetchInvitations();
    }, [fetchAdvisors, fetchCompanies, fetchInvitations, isAdvisor]);

    // Refresh all
    const handleRefreshAll = () => {
        if (!isAdvisor) {
            fetchAdvisors();
            fetchCompanies();
        }
        fetchInvitations();
    };

    // Toggle Advisor Active Status
    const handleToggleStatus = async (adv) => {
        if (adv.id === currentUser?.id) {
            error('Nie możesz dezaktywować własnego konta.');
            return;
        }

        setActionInProgressId(adv.id);
        try {
            const res = await apiClient.patch(`/admin/advisors/${adv.id}/toggle-status`);
            success(res.data.message || 'Status konta doradcy został zaktualizowany.');
            setAdvisors(prev =>
                prev.map(a => (a.id === adv.id ? { ...a, is_active: !a.is_active } : a))
            );
        } catch (err) {
            const msg = err.response?.data?.message || 'Nie udało się zmienić statusu konta.';
            error(msg);
        } finally {
            setActionInProgressId(null);
        }
    };

    // Open Assignment Modal
    const handleOpenAssignmentModal = (adv) => {
        setSelectedAdvisorForAssignment(adv);
        setAssignmentModalOpen(true);
    };

    // Callback when assignments are saved
    const handleAdvisorSaved = (updatedAdv) => {
        setAdvisors(prev =>
            prev.map(a => (a.id === updatedAdv.id ? { ...a, ...updatedAdv } : a))
        );
        fetchCompanies();
    };

    // Resend Invitation
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

    // Revoke Invitation
    const handleRevokeInvitation = async (inv) => {
        if (!window.confirm(`Czy na pewno chcesz unieważnić zaproszenie dla ${inv.email}?`)) {
            return;
        }

        setActionInProgressId(inv.id);
        try {
            const res = await apiClient.delete(`/invitations/${inv.id}`);
            success(res.data.message || 'Zaproszenie zostało unieważnione.');
            fetchInvitations();
        } catch (err) {
            const msg = err.response?.data?.message || 'Nie udało się anulować zaproszenia.';
            error(msg);
        } finally {
            setActionInProgressId(null);
        }
    };

    // Copy Activation URL to clipboard
    const handleCopyActivationUrl = (inv) => {
        if (!inv.activation_url) return;
        navigator.clipboard.writeText(inv.activation_url).then(() => {
            setCopiedId(inv.id);
            success('Link aktywacyjny został skopiowany do schowka.');
            setTimeout(() => setCopiedId(null), 3000);
        }).catch(() => {
            error('Nie udało się skopiować linku do schowka.');
        });
    };

    // Copy from modal
    const handleCopyModalUrl = (url) => {
        if (!url) return;
        navigator.clipboard.writeText(url).then(() => {
            setModalCopied(true);
            success('Link aktywacyjny skopiowany do schowka.');
            setTimeout(() => setModalCopied(false), 3000);
        }).catch(() => {
            error('Nie udało się skopiować linku do schowka.');
        });
    };

    // Filtered Advisors in memory (if search without trigger)
    const filteredAdvisors = useMemo(() => {
        return advisors.filter(a => {
            const matchesSearch = !searchQuery ||
                a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                a.email.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesRole = roleFilter === 'all' || a.role === roleFilter;
            const matchesStatus = statusFilter === 'all' ||
                (statusFilter === 'active' && a.is_active) ||
                (statusFilter === 'inactive' && !a.is_active);

            return matchesSearch && matchesRole && matchesStatus;
        });
    }, [advisors, searchQuery, roleFilter, statusFilter]);

    // KPI Metrics calculation
    const totalAdvisors = advisors.length;
    const activeAdvisors = advisors.filter(a => a.is_active).length;
    const totalCompanies = companies.length;
    const pendingInvitations = invitations.filter(i => i.status === 'pending').length;
    const acceptedInvitations = invitations.filter(i => i.status === 'accepted').length;

    // Current user role display
    const currentUserRole = isSuperAdmin ? 'Super Admin' : isAdvisor ? 'Doradca M&A' : 'Admin';

    // Status Badge helper
    const getStatusBadge = (status) => {
        switch (status) {
            case 'pending':
                return (
                    <Tooltip content="Zaproszenie aktywne, oczekuje na rejestrację przez użytkownika (ważne 48h)">
                        <span>
                            <Badge variant="warning" size="sm">OCZEKUJE</Badge>
                        </span>
                    </Tooltip>
                );
            case 'accepted':
                return (
                    <Tooltip content="Zaproszenie zrealizowane – konto użytkownika zostało utworzone i aktywowane">
                        <span>
                            <Badge variant="success" size="sm">ZAAKCEPTOWANE</Badge>
                        </span>
                    </Tooltip>
                );
            case 'expired':
                return (
                    <Tooltip content="Token aktywacyjny wygasł (minęło 48h). Wymagane ponowne przesłanie zaproszenia.">
                        <span>
                            <Badge variant="danger" size="sm">WYGASŁO</Badge>
                        </span>
                    </Tooltip>
                );
            case 'revoked':
                return (
                    <Tooltip content="Zaproszenie zostało unieważnione przez administratora przed jego wykorzystaniem">
                        <span>
                            <Badge variant="default" size="sm">ANULOWANE</Badge>
                        </span>
                    </Tooltip>
                );
            default:
                return (
                    <Tooltip content={`Status zaproszenia: ${status}`}>
                        <span>
                            <Badge variant="default" size="sm">{status.toUpperCase()}</Badge>
                        </span>
                    </Tooltip>
                );
        }
    };

    return (
        <div className="space-y-6 font-mono text-zinc-300">
            {/* Terminal Strip Header */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3">
                    <Tooltip content="Zarządzanie uprawnieniami wielonajemczymi i doradcami portfela FinBoard">
                        <div
                            tabIndex={0}
                            role="img"
                            aria-label="Doradcy i przypisania portfelowe"
                            className="w-8 h-8 rounded bg-zinc-850 border border-zinc-750 flex items-center justify-center text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                        >
                            <Shield className="w-4 h-4 text-brand" />
                        </div>
                    </Tooltip>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-sm font-bold uppercase tracking-wider text-zinc-100">
                                Zarządzanie Doradcami & Uprawnieniami Portfela
                            </h1>
                            <InfoTooltip
                                content="Moduł zarządzania strukturą Deal Advisory w modelu Multi-Tenant RBAC. Umożliwia przypisywanie doradców M&A do wyznaczonych spółek portfelowych, monitorowanie obsady analitycznej, zapraszanie użytkowników z zachowaniem zasady Zero-Trust oraz diagnostykę węzła pocztowego SMTP."
                                ariaLabel="Więcej informacji o zarządzaniu doradcami i przypisaniach wielonajemczych"
                                size="xs"
                            />
                            <Tooltip content={`Rola systemowa bieżącego operatora: ${currentUserRole.toUpperCase()}`}>
                                <span>
                                    <Badge variant={isSuperAdmin ? 'purple' : isAdvisor ? 'brand' : 'default'} size="sm">
                                        {currentUserRole.toUpperCase()}
                                    </Badge>
                                </span>
                            </Tooltip>
                            <Tooltip content="Ścisła izolacja podmiotów i uprawnień zgodnie z architekturą Multi-Tenant RBAC">
                                <span>
                                    <Badge variant="outline" size="sm">
                                        MULTI-TENANT RBAC
                                    </Badge>
                                </span>
                            </Tooltip>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                            DEAL ADVISORY • PORTFOLIO ACCESS CONTROL • ZERO-TRUST INVITATIONS
                        </p>
                    </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                    {!isAdvisor && (
                        <Tooltip content="Diagnostyka połączenia i testowy email SMTP">
                            <span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    icon={Server}
                                    onClick={() => setTestMailModalOpen(true)}
                                    title="Diagnostyka połączenia i testowy email SMTP"
                                >
                                    Testuj SMTP
                                </Button>
                            </span>
                        </Tooltip>
                    )}

                    {!isAdvisor && (
                        <Tooltip content="Zarejestruj nowy podmiot gospodarczy w portfelu Deal Advisory">
                            <span>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    icon={Building2}
                                    onClick={() => setCreateCompanyModalOpen(true)}
                                >
                                    Dodaj Spółkę
                                </Button>
                            </span>
                        </Tooltip>
                    )}

                    <Tooltip content="Wygeneruj zaproszenie i wyślij bezpieczny jednorazowy link aktywacyjny">
                        <span>
                            <Button
                                variant="primary"
                                size="sm"
                                icon={UserPlus}
                                onClick={() => setInviteModalOpen(true)}
                            >
                                Zaproś Użytkownika
                            </Button>
                        </span>
                    </Tooltip>

                    <Tooltip content="Pobierz aktualne dane doradców, spółek portfelowych oraz zaproszeń">
                        <span>
                            <Button
                                variant="ghost"
                                size="sm"
                                icon={RotateCw}
                                onClick={handleRefreshAll}
                                disabled={loadingAdvisors || loadingCompanies || loadingInvitations}
                                loading={loadingAdvisors || loadingCompanies || loadingInvitations}
                            >
                                Odśwież
                            </Button>
                        </span>
                    </Tooltip>
                </div>
            </div>

            {/* KPI Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {!isAdvisor ? (
                    <>
                        <MetricCard
                            title="Doradcy & Partnerzy"
                            value={totalAdvisors}
                            icon={Users}
                            subtitle={`Aktywni: ${activeAdvisors} / ${totalAdvisors}`}
                            tooltipContent="Łączna liczba doradców M&A oraz super-administratorów w zespole Deal Advisory."
                        />
                        <MetricCard
                            title="Spółki w Portfelu"
                            value={totalCompanies}
                            icon={Building2}
                            subtitle="Podmioty z przypisanym doradcą"
                            tooltipContent="Liczba zarejestrowanych podmiotów gospodarczych podlegających nadzorowi analitycznemu."
                        />
                    </>
                ) : (
                    <>
                        <MetricCard
                            title="Twoja Rola"
                            value="DORADCA"
                            icon={Shield}
                            subtitle="Przypisane spółki Deal Advisory"
                            tooltipContent="Uprawnienia bieżącego konta: doradca M&A posiada dostęp wyłącznie do przypisanych podmiotów."
                        />
                        <MetricCard
                            title="Izolacja Najemcy"
                            value="AKTYWNA"
                            icon={Lock}
                            subtitle="Dostęp ograniczony do portfela"
                            tooltipContent="Mechanizm separacji danych na poziomie bazy danych gwarantujący brak wycieku informacji pomiędzy spółkami."
                        />
                    </>
                )}
                <MetricCard
                    title="Oczekujące Zaproszenia"
                    value={pendingInvitations}
                    icon={Mail}
                    subtitle="Tokeny ważne przez 48h"
                    tooltipContent="Liczba aktywnych, niewykorzystanych tokenów zaproszeń oczekujących na rejestrację przez użytkownika."
                />
                <MetricCard
                    title="Aktywowane Konta"
                    value={acceptedInvitations}
                    icon={CheckCircle2}
                    subtitle="Zrealizowane procedury onboardingowe"
                    tooltipContent="Liczba użytkowników, którzy pomyślnie zrealizowali procedurę aktywacji konta w systemie."
                />
            </div>

            {/* Tab Switcher */}
            <div className="flex border-b border-zinc-800 gap-1 overflow-x-auto text-xs">
                {!isAdvisor && (
                    <Tooltip content="Wykaz doradców M&A i administratorów wraz z przypisanymi spółkami">
                        <button
                            onClick={() => setActiveTab('advisors')}
                            aria-label="Rejestr Doradców"
                            className={`pb-2.5 px-3 flex items-center gap-2 border-b-2 font-semibold transition-colors cursor-pointer ${
                                activeTab === 'advisors'
                                    ? 'border-brand text-zinc-100'
                                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            <Users className="w-3.5 h-3.5" />
                            <span>Rejestr Doradców</span>
                            <Badge variant="default" size="sm">{advisors.length}</Badge>
                        </button>
                    </Tooltip>
                )}

                {!isAdvisor && (
                    <Tooltip content="Matryca obsady analitycznej i pokrycia spółek przez doradców">
                        <button
                            onClick={() => setActiveTab('companies')}
                            aria-label="Matryca Spółek Portfelowych"
                            className={`pb-2.5 px-3 flex items-center gap-2 border-b-2 font-semibold transition-colors cursor-pointer ${
                                activeTab === 'companies'
                                    ? 'border-brand text-zinc-100'
                                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            <Building2 className="w-3.5 h-3.5" />
                            <span>Matryca Spółek Portfelowych</span>
                            <Badge variant="default" size="sm">{companies.length}</Badge>
                        </button>
                    </Tooltip>
                )}

                <Tooltip content="Rejestr jednorazowych tokenów aktywacyjnych i statusów zaproszeń">
                    <button
                        onClick={() => setActiveTab('invitations')}
                        aria-label="Wysłane Zaproszenia"
                        className={`pb-2.5 px-3 flex items-center gap-2 border-b-2 font-semibold transition-colors cursor-pointer ${
                            activeTab === 'invitations'
                                ? 'border-brand text-zinc-100'
                                : 'border-transparent text-zinc-400 hover:text-zinc-200'
                        }`}
                    >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Wysłane Zaproszenia</span>
                        {pendingInvitations > 0 && (
                            <Badge variant="warning" size="sm">{pendingInvitations}</Badge>
                        )}
                    </button>
                </Tooltip>

                {!isAdvisor && (
                    <Tooltip content="Status węzła pocztowego SMTP, testy gniazda TCP i handshake TLS">
                        <button
                            onClick={() => setActiveTab('mail')}
                            aria-label="Diagnostyka SMTP"
                            className={`pb-2.5 px-3 flex items-center gap-2 border-b-2 font-semibold transition-colors cursor-pointer ${
                                activeTab === 'mail'
                                    ? 'border-brand text-zinc-100'
                                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            <Server className="w-3.5 h-3.5" />
                            <span>Diagnostyka SMTP</span>
                        </button>
                    </Tooltip>
                )}
            </div>

            {/* Tab 1: Advisors Directory */}
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
                                placeholder="Szukaj po nazwisku lub emailu..."
                                className="w-full bg-zinc-950 border border-zinc-750 rounded pl-9 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                            />
                        </div>

                        <div className="flex items-center gap-3 flex-wrap text-xs">
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] text-zinc-500">ROLA:</span>
                                <Tooltip content="Filtruj doradców według roli systemowej w modelu RBAC">
                                    <select
                                        value={roleFilter}
                                        onChange={(e) => setRoleFilter(e.target.value)}
                                        aria-label="Filtruj według roli doradcy"
                                        className="bg-zinc-950 border border-zinc-750 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                                    >
                                        <option value="all">Wszystkie role</option>
                                        <option value="advisor">Doradca M&A</option>
                                        <option value="super_admin">Super Admin</option>
                                    </select>
                                </Tooltip>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-[11px] text-zinc-500">STATUS:</span>
                                <Tooltip content="Filtruj doradców według statusu aktywności konta">
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        aria-label="Filtruj według statusu konta"
                                        className="bg-zinc-950 border border-zinc-750 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                                    >
                                        <option value="all">Wszystkie statusy</option>
                                        <option value="active">Aktywni</option>
                                        <option value="inactive">Nieaktywni</option>
                                    </select>
                                </Tooltip>
                            </div>
                        </div>
                    </div>

                    {/* Advisors Table */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-zinc-950/80 border-b border-zinc-800 text-zinc-400 font-semibold uppercase text-[10px] tracking-wider">
                                        <th className="py-2.5 px-4">
                                            <Tooltip content="Imię, nazwisko oraz adres e-mail doradcy lub administratora">
                                                <span tabIndex={0} className="cursor-help">Doradca / Użytkownik</span>
                                            </Tooltip>
                                        </th>
                                        <th className="py-2.5 px-3">
                                            <Tooltip content="Rola systemowa w modelu Multi-Tenant RBAC (Super Admin, Doradca M&A)">
                                                <span tabIndex={0} className="cursor-help">Rola</span>
                                            </Tooltip>
                                        </th>
                                        <th className="py-2.5 px-3">
                                            <Tooltip content="Status aktywności konta decydujący o możliwości logowania do systemu">
                                                <span tabIndex={0} className="cursor-help">Status</span>
                                            </Tooltip>
                                        </th>
                                        <th className="py-2.5 px-4">
                                            <Tooltip content="Spółki portfelowe, do których doradca posiada uprawnienia analityczne">
                                                <span tabIndex={0} className="cursor-help">Przypisane Spółki</span>
                                            </Tooltip>
                                        </th>
                                        <th className="py-2.5 px-3 text-right">
                                            <Tooltip content="Data rejestracji konta użytkownika w bazie FinBoard">
                                                <span tabIndex={0} className="cursor-help">Data Utworzenia</span>
                                            </Tooltip>
                                        </th>
                                        <th className="py-2.5 px-4 text-right">
                                            <Tooltip content="Dostępne operacje administracyjne: przypisanie spółek oraz blokowanie dostępu">
                                                <span tabIndex={0} className="cursor-help">Operacje</span>
                                            </Tooltip>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/80">
                                    {loadingAdvisors ? (
                                        <tr>
                                            <td colSpan={6} className="py-12 text-center text-zinc-500">
                                                Ładowanie listy doradców...
                                            </td>
                                        </tr>
                                    ) : filteredAdvisors.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-12 text-center text-zinc-500">
                                                Brak doradców spełniających wybrane kryteria filtrowania.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredAdvisors.map((adv) => {
                                            const isSelf = adv.id === currentUser?.id;
                                            const isPendingAction = actionInProgressId === adv.id;

                                            return (
                                                <tr key={adv.id} className="hover:bg-zinc-850/40 transition-colors">
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-3">
                                                            <Tooltip content={`Profil: ${adv.name}`}>
                                                                <div
                                                                    tabIndex={0}
                                                                    role="img"
                                                                    aria-label={`Inicjały: ${adv.name}`}
                                                                    className="w-7 h-7 rounded bg-zinc-850 border border-zinc-700 flex items-center justify-center font-bold text-zinc-200 text-xs shrink-0 cursor-default focus:outline-none focus:ring-1 focus:ring-zinc-400"
                                                                >
                                                                    {adv.name.substring(0, 2).toUpperCase()}
                                                                </div>
                                                            </Tooltip>
                                                            <div className="min-w-0">
                                                                <div className="font-semibold text-zinc-100 flex items-center gap-1.5 truncate">
                                                                    <span className="truncate">{adv.name}</span>
                                                                    {isSelf && (
                                                                        <Tooltip content="Bieżący zalogowany administrator">
                                                                            <span>
                                                                                <Badge variant="brand" size="sm">TY</Badge>
                                                                            </span>
                                                                        </Tooltip>
                                                                    )}
                                                                </div>
                                                                <div className="text-[10px] text-zinc-500 truncate font-mono">
                                                                    {adv.email}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="py-3 px-3">
                                                        <Tooltip content={adv.role === 'super_admin' ? 'Super Administrator: globalny dostęp do wszystkich spółek' : 'Doradca M&A: dostęp ograniczony do przypisanych podmiotów'}>
                                                            <span>
                                                                <Badge
                                                                    variant={adv.role === 'super_admin' ? 'purple' : 'brand'}
                                                                    size="sm"
                                                                >
                                                                    {adv.role === 'super_admin' ? 'SUPER ADMIN' : 'DORADCA M&A'}
                                                                </Badge>
                                                            </span>
                                                        </Tooltip>
                                                    </td>

                                                    <td className="py-3 px-3">
                                                        <Tooltip content={adv.is_active ? 'Konto aktywne – doradca może logować się do platformy' : 'Konto zablokowane – brak uprawnień do logowania'}>
                                                            <span>
                                                                <Badge
                                                                    variant={adv.is_active ? 'success' : 'danger'}
                                                                    size="sm"
                                                                >
                                                                    {adv.is_active ? 'AKTYWNY' : 'NIEAKTYWNY'}
                                                                </Badge>
                                                            </span>
                                                        </Tooltip>
                                                    </td>

                                                    <td className="py-3 px-4">
                                                        {adv.role === 'super_admin' ? (
                                                            <Tooltip content="Super Administrator posiada automatyczny dostęp do wszystkich podmiotów portfela">
                                                                <span tabIndex={0} className="text-zinc-500 text-[11px] italic flex items-center gap-1 cursor-help">
                                                                    <Lock className="w-3 h-3 text-zinc-500" />
                                                                    Globalny dostęp (Wszystkie spółki)
                                                                </span>
                                                            </Tooltip>
                                                        ) : (adv.assigned_companies || []).length === 0 ? (
                                                            <Tooltip content="Brak przypisanych spółek. Doradca nie ma wglądu w dane analityczne żadnego podmiotu.">
                                                                <span tabIndex={0} className="text-amber-400 text-[11px] italic flex items-center gap-1 cursor-help">
                                                                    <AlertCircle className="w-3 h-3" />
                                                                    Brak przypisanych spółek
                                                                </span>
                                                            </Tooltip>
                                                        ) : (
                                                            <div className="flex flex-wrap gap-1">
                                                                {(adv.assigned_companies || []).map((comp) => (
                                                                    <Tooltip
                                                                        key={comp.id}
                                                                        content={`${comp.name} (NIP: ${comp.tax_id || 'Brak'})`}
                                                                    >
                                                                        <span>
                                                                            <Badge
                                                                                variant="default"
                                                                                size="sm"
                                                                                title={`${comp.name} (NIP: ${comp.tax_id || 'Brak'})`}
                                                                            >
                                                                                {comp.code}
                                                                            </Badge>
                                                                        </span>
                                                                    </Tooltip>
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
                                                            <Tooltip content="Zarządzaj przypisanymi spółkami portfelowymi">
                                                                <span>
                                                                    <Button
                                                                        variant="secondary"
                                                                        size="sm"
                                                                        icon={Building2}
                                                                        onClick={() => handleOpenAssignmentModal(adv)}
                                                                        title="Zarządzaj przypisanymi spółkami"
                                                                    >
                                                                        Spółki
                                                                    </Button>
                                                                </span>
                                                            </Tooltip>

                                                            <Tooltip content={isSelf ? 'Nie można dezaktywować własnego konta' : adv.is_active ? 'Dezaktywuj konto' : 'Aktywuj konto'}>
                                                                <span>
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
                                                                </span>
                                                            </Tooltip>
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
                            <div className="flex items-center gap-2">
                                <h3 className="text-xs font-bold text-zinc-100 uppercase">
                                    Matryca Pokrycia Spółek Przez Doradców
                                </h3>
                                <InfoTooltip
                                    content="Zestawienie podmiotów portfelowych wraz z obsadą analityczną Deal Advisory. Umożliwia weryfikację, czy każda spółka ma przypisanego dedykowanego doradcę."
                                    ariaLabel="Informacje o matrycy pokrycia spółek"
                                    size="xs"
                                />
                            </div>
                            <p className="text-[10px] text-zinc-500">
                                Zestawienie podmiotów portfelowych wraz z obsadą analityczną Deal Advisory
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Tooltip content="Łączna liczba zarejestrowanych spółek w systemie">
                                <span>
                                    <Badge variant="default" size="sm">
                                        PODMIOTÓW: {companies.length}
                                    </Badge>
                                </span>
                            </Tooltip>
                            <Tooltip content="Zarejestruj nową spółkę portfelową w architekturze Multi-Tenant">
                                <span>
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        icon={Building2}
                                        onClick={() => setCreateCompanyModalOpen(true)}
                                    >
                                        Dodaj Spółkę
                                    </Button>
                                </span>
                            </Tooltip>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-zinc-950/60 border-b border-zinc-800 text-zinc-400 font-semibold uppercase text-[10px] tracking-wider">
                                    <th className="py-2.5 px-4">
                                        <Tooltip content="Unikalny kod / ticker spółki używany w identyfikacji podmiotu">
                                            <span tabIndex={0} className="cursor-help">Kod</span>
                                        </Tooltip>
                                    </th>
                                    <th className="py-2.5 px-4">
                                        <Tooltip content="Oficjalna nazwa prawna podmiotu portfelowego">
                                            <span tabIndex={0} className="cursor-help">Nazwa Spółki</span>
                                        </Tooltip>
                                    </th>
                                    <th className="py-2.5 px-3">
                                        <Tooltip content="Numer Identyfikacji Podatkowej (NIP / Tax ID)">
                                            <span tabIndex={0} className="cursor-help">NIP</span>
                                        </Tooltip>
                                    </th>
                                    <th className="py-2.5 px-4">
                                        <Tooltip content="Zespół doradców transakcyjnych dedykowanych do tej spółki">
                                            <span tabIndex={0} className="cursor-help">Przypisani Doradcy</span>
                                        </Tooltip>
                                    </th>
                                    <th className="py-2.5 px-3 text-center">
                                        <Tooltip content="Łączna liczba aktywnych doradców z uprawnieniami do spółki">
                                            <span tabIndex={0} className="cursor-help">Liczba Doradców</span>
                                        </Tooltip>
                                    </th>
                                    <th className="py-2.5 px-3 text-center">
                                        <Tooltip content="Liczba użytkowników klienta (CFO/Zarząd) przypisanych do spółki">
                                            <span tabIndex={0} className="cursor-help">Liczba Klientów</span>
                                        </Tooltip>
                                    </th>
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
                                                <Tooltip content={`Kod identyfikacyjny: ${comp.code}`}>
                                                    <span>
                                                        <Badge variant="default" size="md">
                                                            {comp.code}
                                                        </Badge>
                                                    </span>
                                                </Tooltip>
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
                                                    <Tooltip content="Spółka wymaga wyznaczenia doradcy M&A. Obecnie dostęp posiadają wyłącznie Super Administratorzy.">
                                                        <span tabIndex={0} className="text-[11px] text-rose-400 italic flex items-center gap-1 cursor-help">
                                                            <ShieldAlert className="w-3 h-3" />
                                                            Brak dedykowanego doradcy
                                                        </span>
                                                    </Tooltip>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1">
                                                        {comp.assigned_advisors.map((adv) => (
                                                            <Tooltip
                                                                key={adv.id}
                                                                content={`Doradca: ${adv.name} (${adv.email})`}
                                                            >
                                                                <span>
                                                                    <Badge
                                                                        variant={adv.is_active ? 'brand' : 'danger'}
                                                                        size="sm"
                                                                        title={adv.email}
                                                                    >
                                                                        {adv.name}
                                                                    </Badge>
                                                                </span>
                                                            </Tooltip>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>

                                            <td className="py-3 px-3 text-center tabular-nums">
                                                <Tooltip content={comp.assigned_advisors_count > 0 ? `Liczba doradców: ${comp.assigned_advisors_count}` : 'Brak przypisanych doradców (wymaga obsady)'}>
                                                    <span tabIndex={0} className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-help ${
                                                        comp.assigned_advisors_count > 0
                                                            ? 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                                                            : 'bg-rose-950/60 text-rose-400 border border-rose-800'
                                                    }`}>
                                                        {comp.assigned_advisors_count}
                                                    </span>
                                                </Tooltip>
                                            </td>

                                            <td className="py-3 px-3 text-center tabular-nums">
                                                <Tooltip content={`Liczba użytkowników po stronie klienta: ${comp.clients_count}`}>
                                                    <span tabIndex={0} className="px-2 py-0.5 rounded text-[11px] bg-zinc-800 text-zinc-300 border border-zinc-700 cursor-help">
                                                        {comp.clients_count}
                                                    </span>
                                                </Tooltip>
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
                            <Tooltip content="Filtruj zaproszenia według ich aktualnego stanu w cyklu życia konta">
                                <select
                                    value={invitationStatusFilter}
                                    onChange={(e) => setInvitationStatusFilter(e.target.value)}
                                    aria-label="Filtruj zaproszenia według statusu"
                                    className="bg-zinc-950 border border-zinc-750 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                                >
                                    <option value="all">Wszystkie statusy</option>
                                    <option value="pending">Oczekujące (Pending)</option>
                                    <option value="accepted">Zaakceptowane (Accepted)</option>
                                    <option value="expired">Wygasłe (Expired)</option>
                                    <option value="revoked">Anulowane (Revoked)</option>
                                </select>
                            </Tooltip>
                        </div>
                    </div>

                    {/* Invitations Table */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-zinc-950/80 border-b border-zinc-800 text-zinc-400 font-semibold uppercase text-[10px] tracking-wider">
                                        <th className="py-2.5 px-4">
                                            <Tooltip content="Adres pocztowy, na który wysłano jednorazowy token aktywacyjny">
                                                <span tabIndex={0} className="cursor-help">Adres E-mail Odbiorcy</span>
                                            </Tooltip>
                                        </th>
                                        <th className="py-2.5 px-3">
                                            <Tooltip content="Docelowa rola systemowa w modelu Multi-Tenant RBAC">
                                                <span tabIndex={0} className="cursor-help">Rola</span>
                                            </Tooltip>
                                        </th>
                                        <th className="py-2.5 px-4">
                                            <Tooltip content="Spółka klienta lub zestaw spółek przypisanych do doradcy">
                                                <span tabIndex={0} className="cursor-help">Spółka / Przypisania</span>
                                            </Tooltip>
                                        </th>
                                        <th className="py-2.5 px-3">
                                            <Tooltip content="Stan zaproszenia w cyklu życia konta">
                                                <span tabIndex={0} className="cursor-help">Status</span>
                                            </Tooltip>
                                        </th>
                                        <th className="py-2.5 px-3">
                                            <Tooltip content="Sygnatura czasowa wygaśnięcia jednorazowego tokenu">
                                                <span tabIndex={0} className="cursor-help">Wygasa</span>
                                            </Tooltip>
                                        </th>
                                        <th className="py-2.5 px-3">
                                            <Tooltip content="Operator inicjujący procedurę zaproszenia">
                                                <span tabIndex={0} className="cursor-help">Zapraszający</span>
                                            </Tooltip>
                                        </th>
                                        <th className="py-2.5 px-4 text-right">
                                            <Tooltip content="Akcje na zaproszeniu: ponowna wysyłka, kopiowanie linku, unieważnienie">
                                                <span tabIndex={0} className="cursor-help">Operacje</span>
                                            </Tooltip>
                                        </th>
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
                                                        <Tooltip content={inv.role === 'super_admin' ? 'Super Administrator: globalny dostęp do platformy' : inv.role === 'advisor' ? 'Doradca Deal Advisory: dostęp do przypisanych spółek' : 'Klient: dostęp wyłączny do pojedynczej spółki'}>
                                                            <span>
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
                                                            </span>
                                                        </Tooltip>
                                                    </td>

                                                    <td className="py-3 px-4">
                                                        {inv.role === 'client' && inv.company ? (
                                                            <Tooltip content={`Przypisana spółka: ${inv.company.name} (${inv.company.code})`}>
                                                                <div className="flex items-center gap-1.5 cursor-help" tabIndex={0}>
                                                                    <Badge variant="default" size="sm">{inv.company.code}</Badge>
                                                                    <span className="text-zinc-300 truncate max-w-[160px]">{inv.company.name}</span>
                                                                </div>
                                                            </Tooltip>
                                                        ) : inv.role === 'advisor' ? (
                                                            <Tooltip content={inv.assigned_companies_count > 0 ? `Liczba spółek w początkowym przypisaniu: ${inv.assigned_companies_count}` : 'Brak przypisanych spółek na etapie zaproszenia'}>
                                                                <span tabIndex={0} className="text-zinc-400 text-[11px] cursor-help">
                                                                    {inv.assigned_companies_count > 0
                                                                        ? `Przypisano do ${inv.assigned_companies_count} spółek`
                                                                        : 'Bez początkowych spółek'}
                                                                </span>
                                                            </Tooltip>
                                                        ) : (
                                                            <Tooltip content="Super Administrator posiada automatyczny dostęp do wszystkich podmiotów">
                                                                <span tabIndex={0} className="text-zinc-500 text-[11px] italic cursor-help">Dostęp globalny</span>
                                                            </Tooltip>
                                                        )}
                                                    </td>

                                                    <td className="py-3 px-3">
                                                        {getStatusBadge(inv.status)}
                                                    </td>

                                                    <td className="py-3 px-3 text-[11px] text-zinc-400 tabular-nums">
                                                        {inv.expires_at ? (
                                                            <Tooltip content={`Wygasa: ${inv.expires_at.replace('T', ' ')}`}>
                                                                <div tabIndex={0} className="flex items-center gap-1 cursor-help">
                                                                    <Clock className="w-3 h-3 text-zinc-500" />
                                                                    <span>{inv.expires_at.replace('T', ' ').substring(0, 16)}</span>
                                                                </div>
                                                            </Tooltip>
                                                        ) : (
                                                            <Tooltip content="Token bezterminowy">
                                                                <span tabIndex={0} className="cursor-help">Brak limitu</span>
                                                            </Tooltip>
                                                        )}
                                                    </td>

                                                    <td className="py-3 px-3 text-[11px] text-zinc-400">
                                                        <Tooltip content={`Zaproszenie zainicjowane przez: ${inv.inviter?.name || 'Administrator'} (${inv.inviter?.email || 'N/A'})`}>
                                                            <span tabIndex={0} className="cursor-help truncate block max-w-[120px]">
                                                                {inv.inviter?.name || 'Administrator'}
                                                            </span>
                                                        </Tooltip>
                                                    </td>

                                                    <td className="py-3 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            {isPending && (
                                                                <Tooltip content="Kopiuj bezpieczny link aktywacyjny do schowka">
                                                                    <span>
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
                                                                    </span>
                                                                </Tooltip>
                                                            )}
                                                            {(isPending || isExpired) && (
                                                                <Tooltip content="Wyślij ponownie z nowym 48h tokenem">
                                                                    <span>
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
                                                                    </span>
                                                                </Tooltip>
                                                            )}
                                                            {isPending && (
                                                                <Tooltip content="Unieważnij to zaproszenie">
                                                                    <span>
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
                                                                    </span>
                                                                </Tooltip>
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
                            <Tooltip content="Zamknij (Esc)">
                                <button
                                    type="button"
                                    onClick={() => setActivationModalInvitation(null)}
                                    aria-label="Odrzuć"
                                    className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </Tooltip>
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
                                    <Tooltip content="Kopiuj link aktywacyjny do schowka">
                                        <span>
                                            <Button
                                                variant={modalCopied ? 'outline' : 'primary'}
                                                size="sm"
                                                icon={modalCopied ? Check : Copy}
                                                onClick={() => handleCopyModalUrl(activationModalInvitation.activation_url)}
                                                className={modalCopied ? 'text-emerald-400 border-emerald-500/50 bg-emerald-950/20' : ''}
                                            >
                                                {modalCopied ? 'Skopiowano' : 'Kopiuj'}
                                            </Button>
                                        </span>
                                    </Tooltip>
                                </div>
                            </div>

                            <div className="flex justify-end pt-2">
                                <Tooltip content="Zamknij okno potwierdzenia">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setActivationModalInvitation(null)}
                                    >
                                        Zamknij
                                    </Button>
                                </Tooltip>
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
