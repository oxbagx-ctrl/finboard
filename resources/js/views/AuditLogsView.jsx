import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
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

const VDR_ACTION_FILTERS = [
    { id: '', label: 'Wszystkie Zdarzenia' },
    { id: 'download', label: 'Pobrania' },
    { id: 'upload', label: 'Wgrania (Upload)' },
    { id: 'archive', label: 'Archiwizacje' },
    { id: 'unarchive', label: 'Przywrócenia' },
];

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

const getFinanceActionBadgeClass = (color) => {
    switch (color) {
        case 'emerald':
            return 'bg-emerald-950/70 border-emerald-800 text-emerald-300';
        case 'blue':
            return 'bg-blue-950/70 border-blue-800 text-blue-300';
        case 'rose':
        case 'red':
            return 'bg-rose-950/70 border-rose-800 text-rose-300';
        case 'amber':
            return 'bg-amber-950/70 border-amber-800 text-amber-300';
        case 'indigo':
            return 'bg-indigo-950/70 border-indigo-800 text-indigo-300';
        case 'cyan':
            return 'bg-cyan-950/70 border-cyan-800 text-cyan-300';
        case 'violet':
            return 'bg-violet-950/70 border-violet-800 text-violet-300';
        default:
            return 'bg-zinc-800/80 border-zinc-700 text-zinc-300';
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

    // Fetch VDR logs
    const fetchVdrLogs = useCallback(
        async (page = 1) => {
            setVdrLoading(true);
            try {
                const params = {
                    page,
                    per_page: 25,
                };
                if (activeCompany?.id) {
                    params.company_id = activeCompany.id;
                }

                const res = await apiClient.get('/documents/audit-logs', { params });
                let records = res.data.data || [];

                if (vdrSelectedAction) {
                    records = records.filter((l) => l.action === vdrSelectedAction);
                }

                if (vdrSearchQuery.trim()) {
                    const q = vdrSearchQuery.toLowerCase();
                    records = records.filter(
                        (l) =>
                            l.document_title?.toLowerCase().includes(q) ||
                            l.user?.name?.toLowerCase().includes(q) ||
                            l.user?.email?.toLowerCase().includes(q) ||
                            l.ip_address?.includes(q)
                    );
                }

                setVdrLogs(records);
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
        try {
            const params = {};
            if (activeCompany?.id) {
                params.company_id = activeCompany.id;
            }
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
            setFinanceLoading(true);
            try {
                const params = {
                    page,
                    per_page: 25,
                };
                if (activeCompany?.id) {
                    params.company_id = activeCompany.id;
                }
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

    // Initial load and company change sync
    useEffect(() => {
        if (activeTab === 'finance') {
            fetchFinanceLogs(1);
            fetchFinanceStats();
        } else {
            fetchVdrLogs(1);
        }
    }, [activeTab, fetchFinanceLogs, fetchFinanceStats, fetchVdrLogs, activeCompany?.id]);

    // Listen to global company change event
    useEffect(() => {
        const handleCompanyChanged = () => {
            if (activeTab === 'finance') {
                fetchFinanceLogs(1);
                fetchFinanceStats();
            } else {
                fetchVdrLogs(1);
            }
        };
        window.addEventListener('finboard:company-changed', handleCompanyChanged);
        return () => {
            window.removeEventListener('finboard:company-changed', handleCompanyChanged);
        };
    }, [activeTab, fetchFinanceLogs, fetchFinanceStats, fetchVdrLogs]);

    // Debounce search query input (300ms)
    useEffect(() => {
        const timer = setTimeout(() => {
            setFinanceSearchQuery(financeSearchInput);
        }, 300);
        return () => clearTimeout(timer);
    }, [financeSearchInput]);

    const handleClearFinanceSearch = () => {
        setFinanceSearchInput('');
        setFinanceSearchQuery('');
    };

    const handleOpenDetailModal = (log) => {
        setSelectedDetailLog(log);
        setIsDetailModalOpen(true);
    };

    const handleCloseDetailModal = () => {
        setSelectedDetailLog(null);
        setIsDetailModalOpen(false);
    };

    const getVdrActionBadge = (action) => {
        switch (action) {
            case 'upload':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950/60 border border-emerald-800 text-emerald-300">
                        <UploadCloud className="w-3 h-3" />
                        Upload
                    </span>
                );
            case 'download':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-950/60 border border-blue-800 text-blue-300">
                        <DownloadCloud className="w-3 h-3" />
                        Pobranie
                    </span>
                );
            case 'archive':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-950/60 border border-amber-800 text-amber-300">
                        <Archive className="w-3 h-3" />
                        Archiwizacja
                    </span>
                );
            case 'unarchive':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-800 border border-zinc-700 text-zinc-200">
                        <RotateCcw className="w-3 h-3" />
                        Przywrócenie
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-850 border border-zinc-750 text-zinc-300">
                        {action}
                    </span>
                );
        }
    };

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
                    <div className="w-10 h-10 rounded bg-zinc-950 border border-zinc-750 flex items-center justify-center text-zinc-200 shrink-0">
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-sm font-bold uppercase tracking-wider text-zinc-100">
                                Dziennik Nadzoru & Ścieżka Audytowa (Audit Trail)
                            </h1>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-zinc-950 border border-zinc-750 text-zinc-400">
                                {activeCompany?.name || 'Spółka'}
                            </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-0.5">
                            {activeTab === 'finance'
                                ? 'Niezmienny rejestr transakcji finansowych, celów benchmarkowych oraz importów CSV.'
                                : 'Niezmienny rejestr dostępu, pobrań i operacji zarządczych w Pokoju Danych (VDR).'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={RefreshCw}
                        loading={activeTab === 'finance' ? financeLoading : vdrLoading}
                        onClick={() => {
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
                </div>
            </div>

            {/* Terminal-Styled Tab Switcher */}
            <div className="flex border-b border-zinc-800 bg-zinc-900/60 rounded-t-lg px-2 pt-2 gap-1 overflow-x-auto text-xs">
                <button
                    type="button"
                    data-testid="audit-tab-finance"
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
                <button
                    type="button"
                    data-testid="audit-tab-vdr"
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
                                    Łącznie Zdarzeń
                                </span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 font-bold">
                                    LIVE
                                </span>
                            </div>
                            <div className="text-xl font-bold text-zinc-100 mt-1.5 tabular-nums">
                                {financeStats?.total_events ?? 0}
                            </div>
                            <div className="text-[10px] text-zinc-500 mt-0.5">
                                Rejestr operacji w księdze głównej
                            </div>
                        </div>

                        {/* Deletions */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3" data-testid="audit-stat-deletions">
                            <div className="text-[10px] uppercase text-zinc-500 font-semibold flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                    Usunięcia Transakcji
                                </span>
                                {batchDeletionsCount > 0 && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-800/80 text-rose-300 font-bold">
                                        {batchDeletionsCount} MASOWE
                                    </span>
                                )}
                            </div>
                            <div className="text-xl font-bold text-rose-400 mt-1.5 tabular-nums">
                                {totalDeletionsCount}
                            </div>
                            <div className="text-[10px] text-zinc-500 mt-0.5">
                                {singleDeletionsCount} pojedynczych | {batchDeletionsCount} masowych
                            </div>
                        </div>

                        {/* Updates & Imports */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3" data-testid="audit-stat-updates-imports">
                            <div className="text-[10px] uppercase text-zinc-500 font-semibold flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                                    Modyfikacje & Importy
                                </span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-950/60 border border-blue-800/80 text-blue-300 font-bold">
                                    ZAPISY
                                </span>
                            </div>
                            <div className="text-xl font-bold text-blue-400 mt-1.5 tabular-nums">
                                {updatesAndImportsCount}
                            </div>
                            <div className="text-[10px] text-zinc-500 mt-0.5">
                                {updatesCount} edycji | {importsCount} importów CSV
                            </div>
                        </div>

                        {/* Last Event */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3" data-testid="audit-stat-last-event">
                            <div className="text-[10px] uppercase text-zinc-500 font-semibold flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                                    Ostatnie Zdarzenie (CET)
                                </span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-750 text-zinc-300 font-mono">
                                    REAL-TIME
                                </span>
                            </div>
                            <div className="text-xs font-bold text-zinc-200 mt-2 truncate tabular-nums">
                                {financeStats?.last_event_at ? formatDateTime(financeStats.last_event_at) : 'Brak zdarzeń'}
                            </div>
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
                                    <button
                                        key={pill.id}
                                        type="button"
                                        data-testid={pill.testId}
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
                                <button
                                    type="button"
                                    data-testid="finance-search-clear"
                                    onClick={handleClearFinanceSearch}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                                    title="Wyczyść wyszukiwanie"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
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
                                <div className="text-zinc-300 font-bold">Brak zdarzeń audytowych w wybranym zakresie</div>
                                <div className="text-[10px] text-zinc-500 mt-1">
                                    Wszystkie operacje finansowe, modyfikacje i importy pojawią się w tym rejestrze w czasie rzeczywistym.
                                </div>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse" data-testid="finance-audit-table">
                                    <thead>
                                        <tr className="bg-zinc-950 border-b border-zinc-800 text-[10px] text-zinc-400 uppercase tracking-wider">
                                            <th className="py-2.5 px-4 font-semibold w-44">Sygnatura Czasowa (CET)</th>
                                            <th className="py-2.5 px-3 font-semibold w-36">Zdarzenie / Akcja</th>
                                            <th className="py-2.5 px-4 font-semibold">Opis & Zasób</th>
                                            <th className="py-2.5 px-3 font-semibold w-56">Operator</th>
                                            <th className="py-2.5 px-3 font-semibold w-36">Adres IP</th>
                                            <th className="py-2.5 px-4 font-semibold w-28 text-right">Akcje</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-850">
                                        {financeLogs.map((log) => (
                                            <tr
                                                key={log.id}
                                                className="hover:bg-zinc-850/40 transition-colors"
                                                data-testid={`finance-audit-row-${log.id}`}
                                            >
                                                {/* Timestamp */}
                                                <td className="py-2.5 px-4 whitespace-nowrap text-zinc-300 tabular-nums">
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock className="w-3 h-3 text-zinc-500 shrink-0" />
                                                        <span>{formatDateTime(log.created_at)}</span>
                                                    </div>
                                                </td>

                                                {/* Action Badge */}
                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                    <span
                                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getFinanceActionBadgeClass(
                                                            log.action_color
                                                        )}`}
                                                    >
                                                        {log.action_label || log.action}
                                                    </span>
                                                </td>

                                                {/* Description & Entity */}
                                                <td className="py-2.5 px-4">
                                                    <div className="font-medium text-zinc-200 truncate max-w-md" title={log.description}>
                                                        {log.description || 'Brak opisu operacji'}
                                                    </div>
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
                                                        <span className="truncate max-w-[130px]">{log.user?.name || 'Automat / System'}</span>
                                                        <span className="text-[10px] text-zinc-500 font-normal">
                                                            [{log.user?.role || 'SYSTEM'}]
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] text-zinc-500 truncate max-w-[160px]">
                                                        {log.user?.email || '—'}
                                                    </div>
                                                </td>

                                                {/* IP Address */}
                                                <td className="py-2.5 px-3 whitespace-nowrap text-zinc-400">
                                                    <div className="flex items-center gap-1.5">
                                                        <Globe className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                                        <span className="font-mono text-[11px]">{log.ip_address || '—'}</span>
                                                    </div>
                                                </td>

                                                {/* Actions */}
                                                <td className="py-2.5 px-4 text-right whitespace-nowrap">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenDetailModal(log)}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium transition-colors cursor-pointer"
                                                        data-testid={`audit-row-inspect-${log.id}`}
                                                        title="Podgląd szczegółów i snapshotów JSON"
                                                    >
                                                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                                        <span>Szczegóły</span>
                                                    </button>
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
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    icon={ChevronLeft}
                                    disabled={financePagination.currentPage <= 1 || financeLoading}
                                    onClick={() => fetchFinanceLogs(financePagination.currentPage - 1)}
                                    data-testid="finance-prev-page"
                                >
                                    Poprzednia
                                </Button>
                                <span className="px-2 text-zinc-300 tabular-nums" data-testid="finance-page-info">
                                    Strona {financePagination.currentPage} z {financePagination.lastPage}
                                </span>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    icon={ChevronRight}
                                    disabled={financePagination.currentPage >= financePagination.lastPage || financeLoading}
                                    onClick={() => fetchFinanceLogs(financePagination.currentPage + 1)}
                                    data-testid="finance-next-page"
                                >
                                    Następna
                                </Button>
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
                            <div className="text-[10px] uppercase text-zinc-500 font-semibold flex items-center gap-1.5">
                                <Clock className="w-3 h-3 text-zinc-400" />
                                Rejestr Zdarzeń VDR
                            </div>
                            <div className="text-lg font-bold text-zinc-100 mt-1 tabular-nums">
                                {vdrPagination.total}
                            </div>
                            <div className="text-[10px] text-zinc-500 mt-0.5">
                                Status księgi: <span className="text-emerald-400 font-bold">Zgodny z SOX / RODO</span>
                            </div>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs">
                            <div className="text-[10px] uppercase text-zinc-500 font-semibold flex items-center gap-1.5">
                                <DownloadCloud className="w-3 h-3 text-blue-400" />
                                Pobrania Plików
                            </div>
                            <div className="text-lg font-bold text-zinc-100 mt-1 tabular-nums">
                                {vdrDownloadEventsCount}
                            </div>
                            <div className="text-[10px] text-zinc-500 mt-0.5">
                                Ścisła rejestracja tożsamości pobierającego
                            </div>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs">
                            <div className="text-[10px] uppercase text-zinc-500 font-semibold flex items-center gap-1.5">
                                <UploadCloud className="w-3 h-3 text-emerald-400" />
                                Zdeponowane Dokumenty
                            </div>
                            <div className="text-lg font-bold text-zinc-100 mt-1 tabular-nums">
                                {vdrUploadEventsCount}
                            </div>
                            <div className="text-[10px] text-zinc-500 mt-0.5">
                                Podpis kryptograficzny SHA-256
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-3">
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                            {VDR_ACTION_FILTERS.map((filter) => (
                                <button
                                    key={filter.id}
                                    type="button"
                                    onClick={() => setVdrSelectedAction(filter.id)}
                                    className={`px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                                        vdrSelectedAction === filter.id
                                            ? 'bg-zinc-100 text-zinc-900 shadow-sm'
                                            : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800'
                                    }`}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>

                        <div className="relative flex-1 max-w-md">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input
                                type="text"
                                value={vdrSearchQuery}
                                onChange={(e) => setVdrSearchQuery(e.target.value)}
                                placeholder="Szukaj po dokumencie, użytkowniku lub IP..."
                                className="w-full bg-zinc-950 border border-zinc-800 rounded pl-8 pr-8 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                            />
                            {vdrSearchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setVdrSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
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
                            <div className="p-12 text-center text-zinc-500">
                                <ShieldCheck className="w-10 h-10 mx-auto text-zinc-600 mb-2 opacity-80" />
                                <div className="text-zinc-300 font-bold">Brak zdarzeń audytowych VDR</div>
                                <div className="text-[10px] text-zinc-500 mt-1">
                                    Operacje uploadu i pobrań dokumentów pojawią się w tym rejestrze automatycznie.
                                </div>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-zinc-950 border-b border-zinc-800 text-[10px] text-zinc-400 uppercase tracking-wider">
                                            <th className="py-2.5 px-4 font-semibold w-44">Sygnatura Czasowa</th>
                                            <th className="py-2.5 px-3 font-semibold w-28">Operacja</th>
                                            <th className="py-2.5 px-4 font-semibold">Dokument VDR</th>
                                            <th className="py-2.5 px-3 font-semibold w-56">Tożsamość Operatora</th>
                                            <th className="py-2.5 px-3 font-semibold w-36">Adres IP</th>
                                            <th className="py-2.5 px-4 font-semibold w-48 text-right">Identyfikator</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-850">
                                        {vdrLogs.map((log) => (
                                            <tr key={log.id} className="hover:bg-zinc-850/40 transition-colors">
                                                {/* Timestamp */}
                                                <td className="py-2.5 px-4 whitespace-nowrap text-zinc-300 tabular-nums">
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock className="w-3 h-3 text-zinc-500 shrink-0" />
                                                        <span>{formatDateTime(log.created_at)}</span>
                                                    </div>
                                                </td>

                                                {/* Action */}
                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                    {getVdrActionBadge(log.action)}
                                                </td>

                                                {/* Document */}
                                                <td className="py-2.5 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                                        <span className="font-bold text-zinc-200 truncate" title={log.document_title}>
                                                            {log.document_title || 'Dokument usunięty'}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] text-zinc-500 truncate">
                                                        ID: {log.document_id}
                                                    </div>
                                                </td>

                                                {/* User */}
                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                    <div className="font-semibold text-zinc-200 flex items-center gap-1">
                                                        <User className="w-3.5 h-3.5 text-zinc-500" />
                                                        {log.user?.name || 'Użytkownik'}
                                                        <span className="text-[10px] text-zinc-500 font-normal">
                                                            [{log.user?.role || 'N/A'}]
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] text-zinc-500">
                                                        {log.user?.email || 'brak e-mail'}
                                                    </div>
                                                </td>

                                                {/* IP */}
                                                <td className="py-2.5 px-3 whitespace-nowrap text-zinc-400">
                                                    <div className="flex items-center gap-1.5">
                                                        <Globe className="w-3.5 h-3.5 text-zinc-500" />
                                                        <span>{log.ip_address || '127.0.0.1'}</span>
                                                    </div>
                                                </td>

                                                {/* Log ID */}
                                                <td className="py-2.5 px-4 text-right text-zinc-500 text-[10px] truncate max-w-[120px]" title={log.id}>
                                                    {log.id.substring(0, 8)}...
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
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-xs text-zinc-400">
                            <div>
                                Wpisy audytowe: <strong className="text-zinc-200">{vdrLogs.length}</strong> z <strong className="text-zinc-200">{vdrPagination.total}</strong>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    icon={ChevronLeft}
                                    disabled={vdrPagination.currentPage <= 1 || vdrLoading}
                                    onClick={() => fetchVdrLogs(vdrPagination.currentPage - 1)}
                                >
                                    Poprzednia
                                </Button>
                                <span className="px-2 text-zinc-300 tabular-nums">
                                    Strona {vdrPagination.currentPage} z {vdrPagination.lastPage}
                                </span>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    icon={ChevronRight}
                                    disabled={vdrPagination.currentPage >= vdrPagination.lastPage || vdrLoading}
                                    onClick={() => fetchVdrLogs(vdrPagination.currentPage + 1)}
                                >
                                    Następna
                                </Button>
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
