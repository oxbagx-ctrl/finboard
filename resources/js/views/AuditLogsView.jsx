import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import { Tooltip, InfoTooltip } from '../components/ui/Tooltip';
import {
    ShieldCheck,
    DownloadCloud,
    UploadCloud,
    Archive,
    RotateCcw,
    RefreshCw,
    Search,
    User,
    Globe,
    Clock,
    FileText,
    ChevronLeft,
    ChevronRight,
    Filter,
    X,
    Lock,
    Activity,
    Database,
    DollarSign,
    Layers,
    Eye,
    Trash2
} from 'lucide-react';
import { formatDateTime } from '../utils/formatters';
import { FinancialAuditDetailModal } from '../components/audit/FinancialAuditDetailModal';
import {
    AuditActionBadge,
    getAuditBadgeColorClass as getFinanceActionBadgeClass,
} from '../components/audit/AuditActionBadge';

const VDR_ACTION_FILTERS = [
    { id: '', label: 'Wszystkie Zdarzenia' },
    { id: 'download', label: 'Pobrania' },
    { id: 'upload', label: 'Wgrania (Upload)' },
    { id: 'update', label: 'Modyfikacje' },
    { id: 'destroy', label: 'Usunięcia' },
    { id: 'archive', label: 'Archiwizacje' },
    { id: 'unarchive', label: 'Przywrócenia' },
];

const VDR_FILTER_TOOLTIPS = {
    '': 'Wyświetl wszystkie zdarzenia audytowe dokumentów VDR',
    'download': 'Filtruj zdarzenia pobrania poufnych plików ze znakiem wodnym',
    'upload': 'Filtruj zdarzenia wgrania i deponowania nowych plików do VDR',
    'update': 'Filtruj zdarzenia modyfikacji metadanych lub nazwy dokumentów',
    'destroy': 'Filtruj zdarzenia usunięcia dokumentów z repozytorium transakcyjnego',
    'archive': 'Filtruj zdarzenia przeniesienia dokumentów do archiwum',
    'unarchive': 'Filtruj zdarzenia przywrócenia dokumentów z archiwum do repozytorium',
};

const FINANCE_ACTION_PILLS = [
    {
        id: '',
        label: 'Wszystkie',
        testId: 'action-pill-all',
        color: 'zinc',
        getCount: (stats) => stats?.total_events ?? 0,
    },
    {
        id: 'RECORD_DELETED,RECORDS_BATCH_DELETED',
        label: 'Usunięcia',
        testId: 'action-pill-deletions',
        color: 'rose',
        getCount: (stats) =>
            (stats?.by_action?.RECORD_DELETED?.count || 0) +
            (stats?.by_action?.RECORDS_BATCH_DELETED?.count || 0),
    },
    {
        id: 'RECORD_UPDATED',
        label: 'Modyfikacje',
        testId: 'action-pill-updates',
        color: 'blue',
        getCount: (stats) => stats?.by_action?.RECORD_UPDATED?.count || 0,
    },
    {
        id: 'RECORD_CREATED',
        label: 'Tworzenie',
        testId: 'action-pill-creates',
        color: 'emerald',
        getCount: (stats) => stats?.by_action?.RECORD_CREATED?.count || 0,
    },
    {
        id: 'CSV_IMPORT_PROCESSED,CSV_IMPORT_FAILED',
        label: 'Importy CSV',
        testId: 'action-pill-imports',
        color: 'cyan',
        getCount: (stats) =>
            (stats?.by_action?.CSV_IMPORT_PROCESSED?.count || 0) +
            (stats?.by_action?.CSV_IMPORT_FAILED?.count || 0),
    },
    {
        id: 'BENCHMARK_CONFIGURED,BENCHMARK_RESET',
        label: 'Cele benchmarkowe',
        testId: 'action-pill-benchmarks',
        color: 'indigo',
        getCount: (stats) =>
            (stats?.by_action?.BENCHMARK_CONFIGURED?.count || 0) +
            (stats?.by_action?.BENCHMARK_RESET?.count || 0),
    },
];

const FINANCE_PILL_TOOLTIPS = {
    '': 'Wyświetl wszystkie zarejestrowane zdarzenia bez filtrowania akcji',
    'RECORD_DELETED,RECORDS_BATCH_DELETED': 'Filtruj operacje niszczące: usunięcia pojedyncze i masowe transakcji',
    'RECORD_UPDATED': 'Filtruj operacje modyfikacji i aktualizacji istniejących rekordów finansowych',
    'RECORD_CREATED': 'Filtruj operacje tworzenia nowych rekordów finansowych w księdze głównej',
    'CSV_IMPORT_PROCESSED,CSV_IMPORT_FAILED': 'Filtruj zadania asynchronicznego importu wyciągów i zbiorów CSV',
    'BENCHMARK_CONFIGURED,BENCHMARK_RESET': 'Filtruj operacje konfiguracji i resetu progów benchmarkowych M&A',
};

const getPillClasses = (pill, isActive) => {
    if (!isActive) {
        return 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 border border-zinc-800';
    }
    switch (pill.color) {
        case 'rose':
            return 'bg-rose-950/80 border-rose-600 text-rose-200 shadow-sm';
        case 'blue':
            return 'bg-blue-950/80 border-blue-600 text-blue-200 shadow-sm';
        case 'emerald':
            return 'bg-emerald-950/80 border-emerald-600 text-emerald-200 shadow-sm';
        case 'cyan':
            return 'bg-cyan-950/80 border-cyan-600 text-cyan-200 shadow-sm';
        case 'indigo':
            return 'bg-indigo-950/80 border-indigo-600 text-indigo-200 shadow-sm';
        default:
            return 'bg-zinc-100 text-zinc-900 border-zinc-100 shadow-sm';
    }
};

const getPillCountBadgeClasses = (pill, isActive) => {
    if (!isActive) {
        return 'bg-zinc-850 text-zinc-400 border border-zinc-750';
    }
    switch (pill.color) {
        case 'rose':
            return 'bg-rose-900/60 text-rose-200 border border-rose-700/60';
        case 'blue':
            return 'bg-blue-900/60 text-blue-200 border border-blue-700/60';
        case 'emerald':
            return 'bg-emerald-900/60 text-emerald-200 border border-emerald-700/60';
        case 'cyan':
            return 'bg-cyan-900/60 text-cyan-200 border border-cyan-700/60';
        case 'indigo':
            return 'bg-indigo-900/60 text-indigo-200 border border-indigo-700/60';
        default:
            return 'bg-zinc-300 text-zinc-900';
    }
};

export const AuditLogsView = () => {
    const { activeCompany } = useAuth();
    const { error } = useNotification();

    // Active tab: 'finance' (default) | 'vdr'
    const [activeTab, setActiveTab] = useState('finance');

    // VDR audit logs state
    const [vdrLogs, setVdrLogs] = useState([]);
    const [vdrLoading, setVdrLoading] = useState(false);
    const [vdrSelectedAction, setVdrSelectedAction] = useState('');
    const [vdrSearchInput, setVdrSearchInput] = useState('');
    const [vdrSearchQuery, setVdrSearchQuery] = useState('');
    const [vdrPagination, setVdrPagination] = useState({
        currentPage: 1,
        lastPage: 1,
        total: 0,
        perPage: 25,
    });

    // Finance audit logs state
    const [financeLogs, setFinanceLogs] = useState([]);
    const [financeLoading, setFinanceLoading] = useState(true);
    const [financeStats, setFinanceStats] = useState(null);
    const [financeActionFilter, setFinanceActionFilter] = useState('');
    const [financeSearchInput, setFinanceSearchInput] = useState('');
    const [financeSearchQuery, setFinanceSearchQuery] = useState('');
    const [financePagination, setFinancePagination] = useState({
        currentPage: 1,
        lastPage: 1,
        total: 0,
        perPage: 25,
    });

    // Modal state
    const [selectedDetailLog, setSelectedDetailLog] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    // Fetch VDR logs with server-side action and search filtering
    const fetchVdrLogs = useCallback(
        async (page = 1) => {
            if (!activeCompany?.id) {
                setVdrLogs([]);
                setVdrPagination({ currentPage: 1, lastPage: 1, total: 0, perPage: 25 });
                setVdrLoading(false);
                return;
            }
            setVdrLoading(true);
            try {
                const params = {
                    page,
                    per_page: 25,
                    company_id: activeCompany.id,
                };

                if (vdrSelectedAction) {
                    params.action = vdrSelectedAction;
                }

                if (vdrSearchQuery.trim()) {
                    params.search = vdrSearchQuery.trim();
                }

                const res = await apiClient.get('/documents/audit-logs', { params });
                setVdrLogs(res.data.data || []);
                if (res.data.meta) {
                    setVdrPagination({
                        currentPage: res.data.meta.current_page,
                        lastPage: res.data.meta.last_page,
                        total: res.data.meta.total,
                        perPage: res.data.meta.per_page,
                    });
                }
            } catch (err) {
                console.error('Failed to load company VDR audit logs', err);
                error('Nie udało się pobrać księgi audytowej dokumentów.');
            } finally {
                setVdrLoading(false);
            }
        },
        [vdrSelectedAction, vdrSearchQuery, activeCompany?.id, error]
    );

    // Fetch Finance stats
    const fetchFinanceStats = useCallback(async () => {
        if (!activeCompany?.id) {
            setFinanceStats(null);
            return;
        }
        try {
            const params = { company_id: activeCompany.id };
            const res = await apiClient.get('/finance/audit-logs/stats', { params });
            if (res.data?.data) {
                setFinanceStats(res.data.data);
            }
        } catch (err) {
            console.error('Failed to load financial audit stats', err);
        }
    }, [activeCompany?.id]);

    // Fetch Finance logs
    const fetchFinanceLogs = useCallback(
        async (page = 1) => {
            if (!activeCompany?.id) {
                setFinanceLogs([]);
                setFinancePagination({ currentPage: 1, lastPage: 1, total: 0, perPage: 25 });
                setFinanceLoading(false);
                return;
            }
            setFinanceLoading(true);
            try {
                const params = {
                    page,
                    per_page: 25,
                    company_id: activeCompany.id,
                };
                if (financeActionFilter) {
                    params.action = financeActionFilter;
                }
                if (financeSearchQuery.trim()) {
                    params.search = financeSearchQuery.trim();
                }

                const res = await apiClient.get('/finance/audit-logs', { params });
                setFinanceLogs(res.data.data || []);
                if (res.data.meta) {
                    setFinancePagination({
                        currentPage: res.data.meta.current_page,
                        lastPage: res.data.meta.last_page,
                        total: res.data.meta.total,
                        perPage: res.data.meta.per_page,
                    });
                }
            } catch (err) {
                console.error('Failed to load financial audit logs', err);
                error('Nie udało się pobrać księgi audytowej transakcji finansowych.');
            } finally {
                setFinanceLoading(false);
            }
        },
        [financeActionFilter, financeSearchQuery, activeCompany?.id, error]
    );

    // Tenant context switch: reset transient filters, search and modal when company changes
    useEffect(() => {
        setSelectedDetailLog(null);
        setIsDetailModalOpen(false);
        setFinanceSearchInput('');
        setFinanceSearchQuery('');
        setFinanceActionFilter('');
        setVdrSearchInput('');
        setVdrSearchQuery('');
        setVdrSelectedAction('');
    }, [activeCompany?.id]);

    // Initial load and company change sync
    useEffect(() => {
        if (activeCompany?.id) {
            if (activeTab === 'finance') {
                fetchFinanceLogs(1);
                fetchFinanceStats();
            } else {
                fetchVdrLogs(1);
            }
        } else {
            setFinanceLogs([]);
            setFinanceStats(null);
            setVdrLogs([]);
            setFinanceLoading(false);
            setVdrLoading(false);
        }
    }, [activeTab, fetchFinanceLogs, fetchFinanceStats, fetchVdrLogs, activeCompany?.id]);

    // Listen to global company change event
    useEffect(() => {
        const handleCompanyChanged = (e) => {
            setSelectedDetailLog(null);
            setIsDetailModalOpen(false);
            setFinanceSearchInput('');
            setFinanceSearchQuery('');
            setFinanceActionFilter('');
            setVdrSearchInput('');
            setVdrSearchQuery('');
            setVdrSelectedAction('');

            const targetId = e?.detail?.id || activeCompany?.id;
            if (targetId) {
                if (activeTab === 'finance') {
                    fetchFinanceLogs(1);
                    fetchFinanceStats();
                } else {
                    fetchVdrLogs(1);
                }
            } else {
                setFinanceLogs([]);
                setFinanceStats(null);
                setVdrLogs([]);
                setFinanceLoading(false);
                setVdrLoading(false);
            }
        };
        window.addEventListener('finboard:company-changed', handleCompanyChanged);
        return () => {
            window.removeEventListener('finboard:company-changed', handleCompanyChanged);
        };
    }, [activeTab, fetchFinanceLogs, fetchFinanceStats, fetchVdrLogs, activeCompany?.id]);

    // Debounce search query input (300ms) for Finance
    useEffect(() => {
        const timer = setTimeout(() => {
            setFinanceSearchQuery(financeSearchInput);
        }, 300);
        return () => clearTimeout(timer);
    }, [financeSearchInput]);

    // Debounce search query input (300ms) for VDR
    useEffect(() => {
        const timer = setTimeout(() => {
            setVdrSearchQuery(vdrSearchInput);
        }, 300);
        return () => clearTimeout(timer);
    }, [vdrSearchInput]);

    const handleClearFinanceSearch = () => {
        setFinanceSearchInput('');
        setFinanceSearchQuery('');
    };

    const handleSelectVdrAction = (actionId) => {
        setVdrSelectedAction(actionId);
        setVdrPagination((prev) => ({ ...prev, currentPage: 1 }));
    };

    const handleClearVdrSearch = () => {
        setVdrSearchInput('');
        setVdrSearchQuery('');
    };

    const handleOpenDetailModal = (log) => {
        setSelectedDetailLog(log);
        setIsDetailModalOpen(true);
    };

    const handleCloseDetailModal = () => {
        setSelectedDetailLog(null);
        setIsDetailModalOpen(false);
    };

    const getVdrActionBadge = (action) => (
        <AuditActionBadge action={action} testId={`vdr-audit-badge-${action}`} />
    );

    const vdrDownloadEventsCount = vdrLogs.filter((l) => l.action === 'download').length;
    const vdrUploadEventsCount = vdrLogs.filter((l) => l.action === 'upload').length;

    const handleSelectFinanceAction = (actionId) => {
        setFinanceActionFilter(actionId);
        setFinancePagination((prev) => ({ ...prev, currentPage: 1 }));
    };

    // Financial audit stats derived counts
    const singleDeletionsCount = financeStats?.by_action?.RECORD_DELETED?.count || 0;
    const batchDeletionsCount = financeStats?.by_action?.RECORDS_BATCH_DELETED?.count || 0;
    const totalDeletionsCount = singleDeletionsCount + batchDeletionsCount;

    const updatesCount = financeStats?.by_action?.RECORD_UPDATED?.count || 0;
    const importsCount =
        (financeStats?.by_action?.CSV_IMPORT_PROCESSED?.count || 0) +
        (financeStats?.by_action?.CSV_IMPORT_FAILED?.count || 0);
    const updatesAndImportsCount = updatesCount + importsCount;

    return (
        <div className="space-y-4 font-mono">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <Tooltip content="Niezmienny kryptograficzny rejestr zdarzeń nadzorczych i ścieżki audytowej (WORM / SOX / RODO)">
                        <div
                            className="w-10 h-10 rounded bg-zinc-950 border border-zinc-750 flex items-center justify-center text-zinc-200 shrink-0 cursor-help"
                            role="img"
                            aria-label="Rejestr nadzoru i ścieżka audytowa"
                            tabIndex={0}
                        >
                            <ShieldCheck className="w-5 h-5 text-emerald-400" />
                        </div>
                    </Tooltip>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-sm font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-2">
                                <span>Dziennik Nadzoru & Ścieżka Audytowa (Audit Trail)</span>
                                <InfoTooltip
                                    size="xs"
                                    ariaLabel="Więcej informacji o rejestrze nadzoru i ścieżce audytowej"
                                    content="Niezmienna ścieżka audytowa (Audit Trail) rejestrująca każdą operację finansową, modyfikację rekordów, importy CSV, zmiany celów benchmarkowych oraz dostęp do repozytorium VDR. Zapewnia pełną rozliczalność i zgodność z wymogami SOX, RODO oraz standardami Due Diligence M&A."
                                />
                            </h1>
                            <Tooltip content={`Aktywny podmiot portfelowy: ${activeCompany?.name || 'Brak'} (ID: ${activeCompany?.id || '—'})`}>
                                <span
                                    className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-zinc-950 border border-zinc-750 text-zinc-400 cursor-help"
                                    data-testid="audit-active-company-badge"
                                    tabIndex={0}
                                >
                                    {activeCompany?.name || 'Brak wybranej spółki'}
                                </span>
                            </Tooltip>
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-0.5">
                            {activeTab === 'finance'
                                ? 'Niezmienny rejestr transakcji finansowych, celów benchmarkowych oraz importów CSV.'
                                : 'Niezmienny rejestr dostępu, pobrań i operacji zarządczych w Pokoju Danych (VDR).'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Tooltip content="Odśwież zdarzenia audytowe i statystyki podmiotu">
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={RefreshCw}
                            disabled={!activeCompany?.id || (activeTab === 'finance' ? financeLoading : vdrLoading)}
                            loading={activeTab === 'finance' ? financeLoading : vdrLoading}
                            aria-label="Odśwież zdarzenia audytowe"
                            onClick={() => {
                                if (!activeCompany?.id) return;
                                if (activeTab === 'finance') {
                                    fetchFinanceLogs(financePagination.currentPage);
                                    fetchFinanceStats();
                                } else {
                                    fetchVdrLogs(vdrPagination.currentPage);
                                }
                            }}
                        >
                            Odśwież
                        </Button>
                    </Tooltip>
                </div>
            </div>

            {/* If no company selected, show informative tenant warning banner */}
            {!activeCompany?.id && (
                <div
                    className="bg-amber-950/30 border border-amber-800/60 rounded-lg p-4 text-xs font-mono text-amber-200 flex items-center justify-between gap-3 shadow-md"
                    data-testid="audit-no-company-state"
                >
                    <div className="flex items-center gap-2.5">
                        <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
                        <div>
                            <div className="font-bold">Brak wybranego podmiotu (spółki portfelowej)</div>
                            <div className="text-[11px] text-amber-300/70">
                                Wybierz spółkę z menu wyboru kontekstu w nawigacji, aby załadować dedykowaną księgę audytową i rejestr zdarzeń nadzorczych.
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Terminal-Styled Tab Switcher */}
            <div className="flex border-b border-zinc-800 bg-zinc-900/60 rounded-t-lg px-2 pt-2 gap-1 overflow-x-auto text-xs">
                <Tooltip content="Ścieżka audytowa operacji finansowych: tworzenie, modyfikacje, usunięcia rekordów, importy CSV i cele benchmarkowe">
                    <button
                        type="button"
                        data-testid="audit-tab-finance"
                        aria-label="Audyt Transakcji Finansowych"
                        onClick={() => setActiveTab('finance')}
                        className={`px-4 py-2 border-b-2 font-semibold transition-colors whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                            activeTab === 'finance'
                                ? 'border-emerald-400 text-zinc-100 bg-zinc-850/50'
                                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
                        }`}
                    >
                        <Activity className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Audyt Transakcji Finansowych</span>
                        {financeStats?.total_events !== undefined && (
                            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-800 text-zinc-300 font-mono">
                                {financeStats.total_events}
                            </span>
                        )}
                    </button>
                </Tooltip>
                <Tooltip content="Ścieżka audytowa repozytorium VDR: historia pobrań, uploadu i modyfikacji dokumentów transakcyjnych">
                    <button
                        type="button"
                        data-testid="audit-tab-vdr"
                        aria-label="Audyt Dokumentów VDR"
                        onClick={() => setActiveTab('vdr')}
                        className={`px-4 py-2 border-b-2 font-semibold transition-colors whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                            activeTab === 'vdr'
                                ? 'border-emerald-400 text-zinc-100 bg-zinc-850/50'
                                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
                        }`}
                    >
                        <FileText className="w-3.5 h-3.5 text-blue-400" />
                        <span>Audyt Dokumentów VDR</span>
                        {vdrPagination?.total !== undefined && (
                            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-800 text-zinc-300 font-mono">
                                {vdrPagination.total}
                            </span>
                        )}
                    </button>
                </Tooltip>
            </div>

            {/* TAB CONTENT: Finance Audit */}
            {activeTab === 'finance' && (
                <div className="space-y-4" data-testid="finance-audit-container">
                    {/* Quick Stats: KPI Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        {/* Total Events */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3" data-testid="audit-stat-total">
                            <div className="text-[10px] uppercase text-zinc-500 font-semibold flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Łącznie Zdarzeń</span>
                                    <InfoTooltip
                                        size="xs"
                                        ariaLabel="Więcej informacji o łącznej liczbie zdarzeń"
                                        content="Agregat wszystkich zdarzeń audytowych zapisanych w księdze głównej w relacji do wybranej spółki portfelowej."
                                    />
                                </span>
                                <Tooltip content="Rejestr zdarzeń w czasie rzeczywistym powiązany z silnikiem CQRS/DDD">
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 font-bold cursor-help" tabIndex={0}>
                                        LIVE
                                    </span>
                                </Tooltip>
                            </div>
                            <Tooltip content="Całkowita liczba zarejestrowanych operacji w księdze audytowej">
                                <div className="text-xl font-bold text-zinc-100 mt-1.5 tabular-nums cursor-help" tabIndex={0}>
                                    {financeStats?.total_events ?? 0}
                                </div>
                            </Tooltip>
                            <div className="text-[10px] text-zinc-500 mt-0.5">
                                Rejestr operacji w księdze głównej
                            </div>
                        </div>

                        {/* Deletions */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3" data-testid="audit-stat-deletions">
                            <div className="text-[10px] uppercase text-zinc-500 font-semibold flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                    <span>Usunięcia Transakcji</span>
                                    <InfoTooltip
                                        size="xs"
                                        ariaLabel="Więcej informacji o usunięciach transakcji"
                                        content="Krytyczne zdarzenia niszczące (RECORD_DELETED oraz RECORDS_BATCH_DELETED) wymagające szczególnego nadzoru audytorskiego."
                                    />
                                </span>
                                {batchDeletionsCount > 0 && (
                                    <Tooltip content="Wykryto operacje masowego usuwania wielu rekordów w jednej transakcji">
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-800/80 text-rose-300 font-bold cursor-help" tabIndex={0}>
                                            {batchDeletionsCount} MASOWE
                                        </span>
                                    </Tooltip>
                                )}
                            </div>
                            <Tooltip content={`Łącznie ${totalDeletionsCount} usunięć (${singleDeletionsCount} pojedynczych, ${batchDeletionsCount} masowych)`}>
                                <div className="text-xl font-bold text-rose-400 mt-1.5 tabular-nums cursor-help" tabIndex={0}>
                                    {totalDeletionsCount}
                                </div>
                            </Tooltip>
                            <div className="text-[10px] text-zinc-500 mt-0.5">
                                {singleDeletionsCount} pojedynczych | {batchDeletionsCount} masowych
                            </div>
                        </div>

                        {/* Updates & Imports */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3" data-testid="audit-stat-updates-imports">
                            <div className="text-[10px] uppercase text-zinc-500 font-semibold flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                                    <span>Modyfikacje & Importy</span>
                                    <InfoTooltip
                                        size="xs"
                                        ariaLabel="Więcej informacji o modyfikacjach i importach"
                                        content="Agregat zdarzeń aktualizacji danych finansowych oraz procesów masowego zasilania księgi z plików CSV."
                                    />
                                </span>
                                <Tooltip content="Łączna liczba operacji edycyjnych i importowych">
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-950/60 border border-blue-800/80 text-blue-300 font-bold cursor-help" tabIndex={0}>
                                        ZAPISY
                                    </span>
                                </Tooltip>
                            </div>
                            <Tooltip content={`Łącznie ${updatesAndImportsCount} operacji (${updatesCount} edycji, ${importsCount} importów CSV)`}>
                                <div className="text-xl font-bold text-blue-400 mt-1.5 tabular-nums cursor-help" tabIndex={0}>
                                    {updatesAndImportsCount}
                                </div>
                            </Tooltip>
                            <div className="text-[10px] text-zinc-500 mt-0.5">
                                {updatesCount} edycji | {importsCount} importów CSV
                            </div>
                        </div>

                        {/* Last Event */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3" data-testid="audit-stat-last-event">
                            <div className="text-[10px] uppercase text-zinc-500 font-semibold flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Ostatnie Zdarzenie (CET)</span>
                                    <InfoTooltip
                                        size="xs"
                                        ariaLabel="Więcej informacji o sygnaturze czasowej"
                                        content="Precyzyjny timestamp ostatniej zarejestrowanej operacji w systemie, zsynchronizowany z czasem serwera (CET)."
                                    />
                                </span>
                                <Tooltip content="Automatyczna synchronizacja ze strumieniem zdarzeń bazy danych">
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-750 text-zinc-300 font-mono cursor-help" tabIndex={0}>
                                        REAL-TIME
                                    </span>
                                </Tooltip>
                            </div>
                            <Tooltip content={financeStats?.last_event_at ? `Data ostatniego wpisu: ${formatDateTime(financeStats.last_event_at)} (CET)` : 'Brak zarejestrowanych zdarzeń'}>
                                <div className="text-xs font-bold text-zinc-200 mt-2 truncate tabular-nums cursor-help" tabIndex={0}>
                                    {financeStats?.last_event_at ? formatDateTime(financeStats.last_event_at) : 'Brak zdarzeń'}
                                </div>
                            </Tooltip>
                            <div className="text-[10px] text-zinc-500 mt-0.5">
                                Precyzyjna sygnatura czasowa
                            </div>
                        </div>
                    </div>

                    {/* Financial Action Filter Pills & Search Bar */}
                    <div
                        className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3"
                        data-testid="finance-filters-bar"
                    >
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 text-xs shrink-0">
                            {FINANCE_ACTION_PILLS.map((pill) => {
                                const isActive = financeActionFilter === pill.id;
                                const count = pill.getCount(financeStats);
                                return (
                                    <Tooltip
                                        key={pill.id}
                                        content={FINANCE_PILL_TOOLTIPS[pill.id] || `Filtruj zdarzenia: ${pill.label}`}
                                    >
                                        <button
                                            type="button"
                                            data-testid={pill.testId}
                                            aria-label={`Filtruj zdarzenia: ${pill.label}`}
                                            onClick={() => handleSelectFinanceAction(pill.id)}
                                            className={`px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer border ${getPillClasses(
                                                pill,
                                                isActive
                                            )}`}
                                        >
                                            <span>{pill.label}</span>
                                            <span
                                                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono tabular-nums ${getPillCountBadgeClasses(
                                                    pill,
                                                    isActive
                                                )}`}
                                            >
                                                {count}
                                            </span>
                                        </button>
                                    </Tooltip>
                                );
                            })}
                        </div>

                        {/* Search Query Input with Debounce */}
                        <div className="relative flex-1 max-w-md">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input
                                type="text"
                                data-testid="finance-search-input"
                                value={financeSearchInput}
                                onChange={(e) => setFinanceSearchInput(e.target.value)}
                                placeholder="Szukaj w opisie, encji, IP, użytkowniku..."
                                className="w-full bg-zinc-950 border border-zinc-800 rounded pl-8 pr-8 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                            />
                            {financeSearchInput && (
                                <Tooltip content="Wyczyść frazę wyszukiwania">
                                    <button
                                        type="button"
                                        data-testid="finance-search-clear"
                                        aria-label="Wyczyść wyszukiwanie"
                                        onClick={handleClearFinanceSearch}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                                        title="Wyczyść wyszukiwanie"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </Tooltip>
                            )}
                        </div>
                    </div>

                    {/* Financial Audit Table */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-xl font-mono text-xs">
                        {financeLoading ? (
                            <div className="p-12 text-center text-zinc-500" data-testid="finance-audit-loading">
                                <RefreshCw className="w-6 h-6 border-2 border-zinc-600 border-t-emerald-400 rounded-full animate-spin mx-auto mb-2" />
                                Pobieranie rejestru transakcji finansowych...
                            </div>
                        ) : financeLogs.length === 0 ? (
                            <div className="p-12 text-center text-zinc-500" data-testid="finance-audit-empty">
                                <ShieldCheck className="w-10 h-10 mx-auto text-zinc-600 mb-2 opacity-80" />
                                <div className="text-zinc-300 font-bold">
                                    {financeSearchQuery || financeActionFilter
                                        ? 'Brak zdarzeń audytowych pasujących do wybranych filtrów'
                                        : 'Brak zdarzeń audytowych w wybranym podmiocie'}
                                </div>
                                <div className="text-[10px] text-zinc-500 mt-1">
                                    {financeSearchQuery || financeActionFilter ? (
                                        <div className="flex items-center justify-center gap-2 mt-2">
                                            <span>Kryteria wyszukiwania nie zwróciły żadnych wyników.</span>
                                            <button
                                                type="button"
                                                data-testid="finance-clear-filters-btn"
                                                onClick={() => {
                                                    handleClearFinanceSearch();
                                                    setFinanceActionFilter('');
                                                }}
                                                className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-emerald-400 font-semibold cursor-pointer border border-zinc-700"
                                            >
                                                Wyczyść filtry
                                            </button>
                                        </div>
                                    ) : (
                                        'Wszystkie operacje finansowe, modyfikacje i importy pojawią się w tym rejestrze w czasie rzeczywistym.'
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse" data-testid="finance-audit-table">
                                    <thead>
                                        <tr className="bg-zinc-950 border-b border-zinc-800 text-[10px] text-zinc-400 uppercase tracking-wider">
                                            <th className="py-2.5 px-4 font-semibold w-44">
                                                <Tooltip content="Dokładny czas rejestracji zdarzenia w strefie CET (Central European Time)">
                                                    <span className="cursor-help" tabIndex={0}>Sygnatura Czasowa (CET)</span>
                                                </Tooltip>
                                            </th>
                                            <th className="py-2.5 px-3 font-semibold w-36">
                                                <Tooltip content="Typ operacji biznesowej zarejestrowanej w silniku audytowym">
                                                    <span className="cursor-help" tabIndex={0}>Zdarzenie / Akcja</span>
                                                </Tooltip>
                                            </th>
                                            <th className="py-2.5 px-4 font-semibold">
                                                <Tooltip content="Szczegółowy opis biznesowy operacji oraz identyfikator zmodyfikowanej encji">
                                                    <span className="cursor-help" tabIndex={0}>Opis & Zasób</span>
                                                </Tooltip>
                                            </th>
                                            <th className="py-2.5 px-3 font-semibold w-56">
                                                <Tooltip content="Tożsamość użytkownika, rola systemowa oraz adres e-mail operatora">
                                                    <span className="cursor-help" tabIndex={0}>Operator</span>
                                                </Tooltip>
                                            </th>
                                            <th className="py-2.5 px-3 font-semibold w-36">
                                                <Tooltip content="Adres IP klienta, z którego wysłano żądanie HTTP">
                                                    <span className="cursor-help" tabIndex={0}>Adres IP</span>
                                                </Tooltip>
                                            </th>
                                            <th className="py-2.5 px-4 font-semibold w-28 text-right">
                                                <Tooltip content="Dostępne operacje inspekcyjne dla pojedynczego wpisu audytowego">
                                                    <span className="cursor-help" tabIndex={0}>Akcje</span>
                                                </Tooltip>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-855">
                                        {financeLogs.map((log) => (
                                            <tr
                                                key={log.id}
                                                className="hover:bg-zinc-850/60 transition-colors cursor-pointer group"
                                                onClick={() => handleOpenDetailModal(log)}
                                                data-testid={`finance-audit-row-${log.id}`}
                                            >
                                                {/* Timestamp */}
                                                <td className="py-2.5 px-4 whitespace-nowrap text-zinc-300 tabular-nums">
                                                    <Tooltip content={`Sygnatura czasowa CET: ${formatDateTime(log.created_at)}`}>
                                                        <div className="flex items-center gap-1.5 cursor-help" tabIndex={0}>
                                                            <Clock className="w-3 h-3 text-zinc-500 shrink-0" />
                                                            <span>{formatDateTime(log.created_at)}</span>
                                                        </div>
                                                    </Tooltip>
                                                </td>

                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                    <Tooltip content={`Akcja: ${log.action_label || log.action}`}>
                                                        <AuditActionBadge
                                                            action={log.action}
                                                            label={log.action_label}
                                                            color={log.action_color}
                                                            category={log.action_category}
                                                            testId={`finance-audit-badge-${log.id}`}
                                                        />
                                                    </Tooltip>
                                                </td>

                                                {/* Description & Entity */}
                                                <td className="py-2.5 px-4">
                                                    <Tooltip content={log.description || 'Brak opisu operacji'}>
                                                        <div className="font-medium text-zinc-200 truncate max-w-md cursor-help" title={log.description} tabIndex={0}>
                                                            {log.description || 'Brak opisu operacji'}
                                                        </div>
                                                    </Tooltip>
                                                    <div className="text-[10px] text-zinc-500 flex items-center gap-2 mt-0.5">
                                                        <span>
                                                            Encja: <strong className="text-zinc-400 font-mono">{log.entity_type || 'N/A'}</strong>
                                                        </span>
                                                        {log.entity_id && (
                                                            <span>
                                                                ID: <strong className="text-zinc-400 font-mono">#{log.entity_id}</strong>
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Operator */}
                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                    <div className="font-semibold text-zinc-200 flex items-center gap-1">
                                                        <User className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                                        <Tooltip content={`Operator: ${log.user?.name || 'Automat / System'}`}>
                                                            <span className="truncate max-w-[130px] cursor-help" tabIndex={0}>
                                                                {log.user?.name || 'Automat / System'}
                                                            </span>
                                                        </Tooltip>
                                                        <Tooltip content={`Rola systemowa: ${log.user?.role || 'SYSTEM'}`}>
                                                            <span className="text-[10px] text-zinc-500 font-normal cursor-help" tabIndex={0}>
                                                                [{log.user?.role || 'SYSTEM'}]
                                                            </span>
                                                        </Tooltip>
                                                    </div>
                                                    <div className="text-[10px] text-zinc-500 truncate max-w-[160px]">
                                                        {log.user?.email || '—'}
                                                    </div>
                                                </td>

                                                {/* IP Address */}
                                                <td className="py-2.5 px-3 whitespace-nowrap text-zinc-400">
                                                    <Tooltip content={`Adres IP klienta: ${log.ip_address || '—'}`}>
                                                        <div className="flex items-center gap-1.5 cursor-help" tabIndex={0}>
                                                            <Globe className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                                            <span className="font-mono text-[11px]">{log.ip_address || '—'}</span>
                                                        </div>
                                                    </Tooltip>
                                                </td>

                                                {/* Actions */}
                                                <td className="py-2.5 px-4 text-right whitespace-nowrap">
                                                    <Tooltip content="Podgląd szczegółów i snapshotów JSON">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOpenDetailModal(log);
                                                            }}
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium transition-colors cursor-pointer"
                                                            data-testid={`audit-row-inspect-${log.id}`}
                                                            title="Podgląd szczegółów i snapshotów JSON"
                                                            aria-label="Podgląd szczegółów i snapshotów JSON"
                                                        >
                                                            <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                                            <span>Szczegóły</span>
                                                        </button>
                                                    </Tooltip>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Financial Pagination Controls */}
                    {financePagination.total > 0 && (
                        <div
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-xs text-zinc-400"
                            data-testid="finance-pagination"
                        >
                            <div>
                                Wpisy audytowe: <strong className="text-zinc-200 tabular-nums">{financeLogs.length}</strong> z <strong className="text-zinc-200 tabular-nums">{financePagination.total}</strong>
                            </div>
                            <div className="flex items-center gap-2">
                                <Tooltip content="Przejdź do poprzedniej strony wyników audytu finansowego">
                                    <span>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            icon={ChevronLeft}
                                            disabled={financePagination.currentPage <= 1 || financeLoading}
                                            onClick={() => fetchFinanceLogs(financePagination.currentPage - 1)}
                                            data-testid="finance-prev-page"
                                            aria-label="Poprzednia strona"
                                        >
                                            Poprzednia
                                        </Button>
                                    </span>
                                </Tooltip>
                                <span className="px-2 text-zinc-300 tabular-nums" data-testid="finance-page-info">
                                    Strona {financePagination.currentPage} z {financePagination.lastPage}
                                </span>
                                <Tooltip content="Przejdź do następnej strony wyników audytu finansowego">
                                    <span>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            icon={ChevronRight}
                                            disabled={financePagination.currentPage >= financePagination.lastPage || financeLoading}
                                            onClick={() => fetchFinanceLogs(financePagination.currentPage + 1)}
                                            data-testid="finance-next-page"
                                            aria-label="Następna strona"
                                        >
                                            Następna
                                        </Button>
                                    </span>
                                </Tooltip>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB CONTENT: VDR Audit */}
            {activeTab === 'vdr' && (
                <div className="space-y-4" data-testid="vdr-audit-container">
                    {/* Quick stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs">
                            <div className="text-[10px] uppercase text-zinc-500 font-semibold flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <Clock className="w-3 h-3 text-zinc-400" />
                                    <span>Rejestr Zdarzeń VDR</span>
                                    <InfoTooltip
                                        size="xs"
                                        ariaLabel="Więcej informacji o rejestrze VDR"
                                        content="Zgodny z wymogami SOX oraz RODO dziennik dostępu i operacji na poufnych dokumentach transakcyjnych M&A."
                                    />
                                </span>
                            </div>
                            <Tooltip content="Całkowita liczba operacji audytowych zarejestrowanych w Virtual Data Room">
                                <div className="text-lg font-bold text-zinc-100 mt-1 tabular-nums cursor-help" tabIndex={0}>
                                    {vdrPagination.total}
                                </div>
                            </Tooltip>
                            <div className="text-[10px] text-zinc-500 mt-0.5">
                                Status księgi: <span className="text-emerald-400 font-bold">Zgodny z SOX / RODO</span>
                            </div>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs">
                            <div className="text-[10px] uppercase text-zinc-500 font-semibold flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <DownloadCloud className="w-3 h-3 text-blue-400" />
                                    <span>Pobrania Plików</span>
                                    <InfoTooltip
                                        size="xs"
                                        ariaLabel="Więcej informacji o pobraniach VDR"
                                        content="Ścisła rejestracja każdego pobrania pliku z automatycznym znakowaniem dynamicznym znakiem wodnym (user stamp, IP, data)."
                                    />
                                </span>
                            </div>
                            <Tooltip content="Liczba zdarzeń pobrań dokumentów z repozytorium na bieżącej liście">
                                <div className="text-lg font-bold text-zinc-100 mt-1 tabular-nums cursor-help" tabIndex={0}>
                                    {vdrDownloadEventsCount}
                                </div>
                            </Tooltip>
                            <div className="text-[10px] text-zinc-500 mt-0.5">
                                Ścisła rejestracja tożsamości pobierającego
                            </div>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs">
                            <div className="text-[10px] uppercase text-zinc-500 font-semibold flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <UploadCloud className="w-3 h-3 text-emerald-400" />
                                    <span>Zdeponowane Dokumenty</span>
                                    <InfoTooltip
                                        size="xs"
                                        ariaLabel="Więcej informacji o uploadzie VDR"
                                        content="Każdy zdeponowany dokument transakcyjny jest opatrzony sumą kontrolną SHA-256 oraz wpisem w niemodyfikowalnym rejestrze."
                                    />
                                </span>
                            </div>
                            <Tooltip content="Liczba zdarzeń wgrania nowych dokumentów transakcyjnych na bieżącej liście">
                                <div className="text-lg font-bold text-zinc-100 mt-1 tabular-nums cursor-help" tabIndex={0}>
                                    {vdrUploadEventsCount}
                                </div>
                            </Tooltip>
                            <div className="text-[10px] text-zinc-500 mt-0.5">
                                Podpis kryptograficzny SHA-256
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-3" data-testid="vdr-filters-bar">
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                            {VDR_ACTION_FILTERS.map((filter) => (
                                <Tooltip
                                    key={filter.id}
                                    content={VDR_FILTER_TOOLTIPS[filter.id] || `Filtruj zdarzenia VDR: ${filter.label}`}
                                >
                                    <button
                                        type="button"
                                        data-testid={`vdr-action-filter-${filter.id || 'all'}`}
                                        aria-label={`Filtruj zdarzenia VDR: ${filter.label}`}
                                        onClick={() => handleSelectVdrAction(filter.id)}
                                        className={`px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                                            vdrSelectedAction === filter.id
                                                ? 'bg-zinc-100 text-zinc-900 shadow-sm'
                                                : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800'
                                        }`}
                                    >
                                        {filter.label}
                                    </button>
                                </Tooltip>
                            ))}
                        </div>

                        <div className="relative flex-1 max-w-md">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input
                                type="text"
                                data-testid="vdr-search-input"
                                value={vdrSearchInput}
                                onChange={(e) => setVdrSearchInput(e.target.value)}
                                placeholder="Szukaj po dokumencie, użytkowniku lub IP..."
                                className="w-full bg-zinc-950 border border-zinc-800 rounded pl-8 pr-8 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                            />
                            {vdrSearchInput && (
                                <Tooltip content="Wyczyść kryteria wyszukiwania VDR">
                                    <button
                                        type="button"
                                        data-testid="vdr-search-clear"
                                        aria-label="Wyczyść wyszukiwanie VDR"
                                        onClick={handleClearVdrSearch}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </Tooltip>
                            )}
                        </div>
                    </div>

                    {/* Audit Table */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-xl font-mono text-xs">
                        {vdrLoading ? (
                            <div className="p-12 text-center text-zinc-500">
                                <RefreshCw className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-200 rounded-full animate-spin mx-auto mb-2" />
                                Pobieranie rejestru operacji audytowych VDR...
                            </div>
                        ) : vdrLogs.length === 0 ? (
                            <div className="p-12 text-center text-zinc-500" data-testid="vdr-audit-empty">
                                <ShieldCheck className="w-10 h-10 mx-auto text-zinc-600 mb-2 opacity-80" />
                                <div className="text-zinc-300 font-bold">
                                    {vdrSearchInput || vdrSelectedAction
                                        ? 'Brak zdarzeń audytowych VDR pasujących do wybranych filtrów'
                                        : 'Brak zdarzeń audytowych VDR'}
                                </div>
                                <div className="text-[10px] text-zinc-500 mt-1">
                                    {vdrSearchInput || vdrSelectedAction ? (
                                        <div className="flex items-center justify-center gap-2 mt-2">
                                            <span>Kryteria wyszukiwania nie zwróciły żadnych operacji VDR.</span>
                                            <button
                                                type="button"
                                                data-testid="vdr-clear-filters-btn"
                                                onClick={() => {
                                                    setVdrSearchInput('');
                                                    setVdrSearchQuery('');
                                                    setVdrSelectedAction('');
                                                }}
                                                className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-emerald-400 font-semibold cursor-pointer border border-zinc-700"
                                            >
                                                Wyczyść filtry
                                            </button>
                                        </div>
                                    ) : (
                                        'Operacje uploadu i pobrań dokumentów pojawią się w tym rejestrze automatycznie.'
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-zinc-950 border-b border-zinc-800 text-[10px] text-zinc-400 uppercase tracking-wider">
                                            <th className="py-2.5 px-4 font-semibold w-44">
                                                <Tooltip content="Data i czas wykonania operacji na dokumentach transakcyjnych (CET)">
                                                    <span className="cursor-help" tabIndex={0}>Sygnatura Czasowa</span>
                                                </Tooltip>
                                            </th>
                                            <th className="py-2.5 px-3 font-semibold w-28">
                                                <Tooltip content="Rodzaj operacji w repozytorium VDR (upload, download, modyfikacja, usunięcie, archiwizacja)">
                                                    <span className="cursor-help" tabIndex={0}>Operacja</span>
                                                </Tooltip>
                                            </th>
                                            <th className="py-2.5 px-4 font-semibold">
                                                <Tooltip content="Nazwa pliku transakcyjnego oraz identyfikator dokumentu">
                                                    <span className="cursor-help" tabIndex={0}>Dokument VDR</span>
                                                </Tooltip>
                                            </th>
                                            <th className="py-2.5 px-3 font-semibold w-56">
                                                <Tooltip content="Tożsamość, rola i adres e-mail operatora wykonującego akcję w VDR">
                                                    <span className="cursor-help" tabIndex={0}>Tożsamość Operatora</span>
                                                </Tooltip>
                                            </th>
                                            <th className="py-2.5 px-3 font-semibold w-36">
                                                <Tooltip content="Adres IP stacji roboczej klienta">
                                                    <span className="cursor-help" tabIndex={0}>Adres IP</span>
                                                </Tooltip>
                                            </th>
                                            <th className="py-2.5 px-4 font-semibold w-48 text-right">
                                                <Tooltip content="Unikalny identyfikator UUID wpisu audytowego">
                                                    <span className="cursor-help" tabIndex={0}>Identyfikator</span>
                                                </Tooltip>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-850">
                                        {vdrLogs.map((log) => (
                                            <tr key={log.id} className="hover:bg-zinc-850/40 transition-colors">
                                                {/* Timestamp */}
                                                <td className="py-2.5 px-4 whitespace-nowrap text-zinc-300 tabular-nums">
                                                    <Tooltip content={`Sygnatura czasowa VDR (CET): ${formatDateTime(log.created_at)}`}>
                                                        <div className="flex items-center gap-1.5 cursor-help" tabIndex={0}>
                                                            <Clock className="w-3 h-3 text-zinc-500 shrink-0" />
                                                            <span>{formatDateTime(log.created_at)}</span>
                                                        </div>
                                                    </Tooltip>
                                                </td>

                                                {/* Action */}
                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                    <Tooltip content={`Akcja VDR: ${log.action}`}>
                                                        {getVdrActionBadge(log.action)}
                                                    </Tooltip>
                                                </td>

                                                {/* Document */}
                                                <td className="py-2.5 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                                        <Tooltip content={log.document_title || 'Dokument usunięty'}>
                                                            <span className="font-bold text-zinc-200 truncate cursor-help" title={log.document_title} tabIndex={0}>
                                                                {log.document_title || 'Dokument usunięty'}
                                                            </span>
                                                        </Tooltip>
                                                    </div>
                                                    <div className="text-[10px] text-zinc-500 truncate">
                                                        ID: {log.document_id}
                                                    </div>
                                                </td>

                                                {/* User */}
                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                    <div className="font-semibold text-zinc-200 flex items-center gap-1">
                                                        <User className="w-3.5 h-3.5 text-zinc-500" />
                                                        <Tooltip content={`Operator VDR: ${log.user?.name || 'Użytkownik'}`}>
                                                            <span className="cursor-help" tabIndex={0}>{log.user?.name || 'Użytkownik'}</span>
                                                        </Tooltip>
                                                        <Tooltip content={`Rola w projekcie M&A: ${log.user?.role || 'N/A'}`}>
                                                            <span className="text-[10px] text-zinc-500 font-normal cursor-help" tabIndex={0}>
                                                                [{log.user?.role || 'N/A'}]
                                                            </span>
                                                        </Tooltip>
                                                    </div>
                                                    <div className="text-[10px] text-zinc-500">
                                                        {log.user?.email || 'brak e-mail'}
                                                    </div>
                                                </td>

                                                {/* IP */}
                                                <td className="py-2.5 px-3 whitespace-nowrap text-zinc-400">
                                                    <Tooltip content={`Adres IP terminala: ${log.ip_address || '127.0.0.1'}`}>
                                                        <div className="flex items-center gap-1.5 cursor-help" tabIndex={0}>
                                                            <Globe className="w-3.5 h-3.5 text-zinc-500" />
                                                            <span>{log.ip_address || '127.0.0.1'}</span>
                                                        </div>
                                                    </Tooltip>
                                                </td>

                                                {/* Log ID */}
                                                <td className="py-2.5 px-4 text-right text-zinc-500 text-[10px] truncate max-w-[120px]">
                                                    <Tooltip content={`Identyfikator audytowy UUID: ${log.id}`}>
                                                        <span className="cursor-help" title={log.id} tabIndex={0}>
                                                            {log.id.substring(0, 8)}...
                                                        </span>
                                                    </Tooltip>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Pagination Controls */}
                    {vdrPagination.total > 0 && (
                        <div
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-xs text-zinc-400"
                            data-testid="vdr-pagination"
                        >
                            <div>
                                Wpisy audytowe: <strong className="text-zinc-200">{vdrLogs.length}</strong> z <strong className="text-zinc-200">{vdrPagination.total}</strong>
                            </div>
                            <div className="flex items-center gap-2">
                                <Tooltip content="Przejdź do poprzedniej strony wyników audytu VDR">
                                    <span>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            icon={ChevronLeft}
                                            data-testid="vdr-prev-page"
                                            aria-label="Poprzednia strona VDR"
                                            disabled={vdrPagination.currentPage <= 1 || vdrLoading}
                                            onClick={() => fetchVdrLogs(vdrPagination.currentPage - 1)}
                                        >
                                            Poprzednia
                                        </Button>
                                    </span>
                                </Tooltip>
                                <span className="px-2 text-zinc-300 tabular-nums" data-testid="vdr-page-info">
                                    Strona {vdrPagination.currentPage} z {vdrPagination.lastPage}
                                </span>
                                <Tooltip content="Przejdź do następnej strony wyników audytu VDR">
                                    <span>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            icon={ChevronRight}
                                            data-testid="vdr-next-page"
                                            aria-label="Następna strona VDR"
                                            disabled={vdrPagination.currentPage >= vdrPagination.lastPage || vdrLoading}
                                            onClick={() => fetchVdrLogs(vdrPagination.currentPage + 1)}
                                        >
                                            Następna
                                        </Button>
                                    </span>
                                </Tooltip>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Financial Audit Detail Modal */}
            <FinancialAuditDetailModal
                isOpen={isDetailModalOpen}
                onClose={handleCloseDetailModal}
                log={selectedDetailLog}
            />
        </div>
    );
};
