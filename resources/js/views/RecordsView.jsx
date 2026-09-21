import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useDeal } from '../context/DealContext';
import { useNotification } from '../context/NotificationContext';
import { FinancialRecordModal } from '../components/finance/FinancialRecordModal';
import { DeleteRecordConfirmationModal } from '../components/finance/DeleteRecordConfirmationModal';
import { BatchActionBar } from '../components/finance/BatchActionBar';
import { BatchDeleteConfirmationModal } from '../components/finance/BatchDeleteConfirmationModal';
import { FinancialValue } from '../components/ui/FinancialValue';

import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import {
    TableProperties,
    Plus,
    Search,
    Filter,
    RotateCcw,
    Download,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Edit2,
    Trash2,
    Building2,
    ArrowDownRight,
    ArrowUpRight,
    FileSpreadsheet,
    DollarSign,
    CheckCircle2
} from 'lucide-react';
import { formatCurrency, formatFinancialDate } from '../utils/formatters';

export const RecordsView = () => {
    const { activeCompany } = useAuth();
    const { currency, convertAmount, dateRange } = useDeal();
    const { error, success } = useNotification();

    // Data states
    const [records, setRecords] = useState([]);
    const [categories, setCategories] = useState([]);
    const [meta, setMeta] = useState({
        current_page: 1,
        last_page: 1,
        per_page: 25,
        total: 0,
        from: 0,
        to: 0,
    });
    const [loading, setLoading] = useState(true);

    // Filter states
    const [search, setSearch] = useState('');
    const [selectedType, setSelectedType] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [startDate, setStartDate] = useState(dateRange.startDate || '');
    const [endDate, setEndDate] = useState(dateRange.endDate || '');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(25);

    // Modal states
    const [recordModalOpen, setRecordModalOpen] = useState(false);
    const [recordToEdit, setRecordToEdit] = useState(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState(null);

    // Selection state for batch operations (accumulated across pages)
    const [selectedMap, setSelectedMap] = useState({});

    const selectedRecordIds = useMemo(() => Object.keys(selectedMap), [selectedMap]);
    const selectedSet = useMemo(() => new Set(selectedRecordIds), [selectedRecordIds]);

    const currentPageIds = useMemo(() => records.map((r) => r.id), [records]);

    const allSelected = useMemo(
        () => currentPageIds.length > 0 && currentPageIds.every((id) => selectedSet.has(id)),
        [currentPageIds, selectedSet]
    );

    const someSelected = useMemo(
        () => currentPageIds.some((id) => selectedSet.has(id)) && !allSelected,
        [currentPageIds, selectedSet, allSelected]
    );

    const handleToggleSelectRow = useCallback((recordOrId) => {
        setSelectedMap((prev) => {
            const next = { ...prev };
            const id = typeof recordOrId === 'object' && recordOrId !== null ? recordOrId.id : recordOrId;
            if (next[id]) {
                delete next[id];
            } else {
                const rec = typeof recordOrId === 'object' && recordOrId !== null
                    ? recordOrId
                    : records.find((r) => r.id === id) || { id, amount: 0 };
                next[id] = rec;
            }
            return next;
        });
    }, [records]);

    const handleToggleSelectAll = useCallback(() => {
        if (allSelected) {
            setSelectedMap((prev) => {
                const next = { ...prev };
                currentPageIds.forEach((id) => delete next[id]);
                return next;
            });
        } else {
            setSelectedMap((prev) => {
                const next = { ...prev };
                records.forEach((r) => {
                    next[r.id] = r;
                });
                return next;
            });
        }
    }, [allSelected, currentPageIds, records]);

    const [batchDeleteModalOpen, setBatchDeleteModalOpen] = useState(false);
    const [batchDeleting, setBatchDeleting] = useState(false);

    // Dynamic metrics calculation for currently selected records (persisted across pages)
    const selectedMetrics = useMemo(() => {
        let total = 0;
        let income = 0;
        let expense = 0;

        Object.values(selectedMap).forEach((r) => {
            const amt = Number(r.amount || 0);
            total += amt;
            const type = (r.record_type || '').toLowerCase();
            const isRev = type === 'revenue' || type === 'income';
            const isExp = type === 'expense';
            if (isRev) income += amt;
            if (isExp) expense += amt;
        });

        return {
            count: selectedRecordIds.length,
            total: convertAmount(total),
            income: convertAmount(income),
            expense: convertAmount(expense),
        };
    }, [selectedMap, selectedRecordIds.length, convertAmount]);



    // Fetch Categories
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await apiClient.get('/finance/categories');
                setCategories(res.data.data || []);
            } catch (e) {
                console.error('Failed to load categories', e);
            }
        };
        fetchCategories();
    }, []);

    // Sync dates from DealContext if user hasn't typed custom dates
    useEffect(() => {
        if (dateRange.startDate && dateRange.endDate) {
            setStartDate(dateRange.startDate);
            setEndDate(dateRange.endDate);
            setPage(1);
        }
    }, [dateRange.startDate, dateRange.endDate]);

    // Fetch Records
    const fetchRecords = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                page,
                per_page: perPage,
            };
            if (search) params.search = search;
            if (selectedType) params.record_type = selectedType;
            if (selectedCategory) params.category_id = selectedCategory;
            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;

            const res = await apiClient.get('/finance/records', { params });
            setRecords(res.data.data || []);
            if (res.data.meta) {
                setMeta({
                    current_page: res.data.meta.current_page,
                    last_page: res.data.meta.last_page,
                    per_page: res.data.meta.per_page,
                    total: res.data.meta.total,
                    from: res.data.meta.from || 0,
                    to: res.data.meta.to || 0,
                });
            }
        } catch (err) {
            error('Nie udało się pobrać listy transakcji.');
        } finally {
            setLoading(false);
        }
    }, [page, perPage, search, selectedType, selectedCategory, startDate, endDate, activeCompany?.id]);

    useEffect(() => {
        fetchRecords();

        const handleCompanyChange = () => {
            setPage(1);
            setSelectedMap({});
            fetchRecords();
        };
        window.addEventListener('finboard:company-changed', handleCompanyChange);
        return () => window.removeEventListener('finboard:company-changed', handleCompanyChange);
    }, [fetchRecords]);

    // Tenant context switch: clear selections when active company changes
    useEffect(() => {
        setSelectedMap({});
    }, [activeCompany?.id]);

    // Filter switch: clear selections when user alters search, category, type, or date criteria
    useEffect(() => {
        setSelectedMap({});
    }, [search, selectedType, selectedCategory, startDate, endDate, perPage]);

    // Handle batch deletion of selected records
    const handleBatchDelete = async () => {
        if (selectedRecordIds.length === 0) return;

        const idsToDelete = [...selectedRecordIds];

        if (idsToDelete.length > 500) {
            error('Maksymalna wielkość paczki do usunięcia wynosi 500 rekordów.');
            return;
        }

        setBatchDeleting(true);

        try {
            const res = await apiClient.delete('/finance/records/batch', {
                data: { record_ids: idsToDelete },
            });

            // Optimistic UI update: remove deleted records from current table view
            setRecords((prev) => prev.filter((r) => !idsToDelete.includes(r.id)));
            setSelectedMap({});
            setBatchDeleteModalOpen(false);

            const deletedCount = res.data?.count ?? idsToDelete.length;
            success(res.data?.message || `Pomyślnie usunięto ${deletedCount} operacji finansowych.`);

            window.dispatchEvent(new CustomEvent('finboard:records-updated'));

            await fetchRecords();
        } catch (err) {
            const errMsg = err.response?.data?.message || 'Nie udało się usunąć zaznaczonych rekordów.';
            error(errMsg);
        } finally {
            setBatchDeleting(false);
        }
    };

    // Summary calculations for current page / batch
    const summary = useMemo(() => {
        let income = 0;
        let expense = 0;
        records.forEach((r) => {
            const amt = Number(r.amount || 0);
            const type = (r.record_type || '').toLowerCase();
            const isRev = type === 'revenue' || type === 'income';
            const isExp = type === 'expense';
            if (isRev) income += amt;
            if (isExp) expense += amt;
        });
        return {
            income: convertAmount(income),
            expense: convertAmount(expense),
            balance: convertAmount(income - expense),
        };
    }, [records, convertAmount]);

    const handleResetFilters = () => {
        setSearch('');
        setSelectedType('');
        setSelectedCategory('');
        setStartDate('');
        setEndDate('');
        setPage(1);
        setSelectedMap({});
    };

    const handleOpenCreate = () => {
        setRecordToEdit(null);
        setRecordModalOpen(true);
    };

    const handleOpenEdit = (record) => {
        setRecordToEdit(record);
        setRecordModalOpen(true);
    };

    const handleOpenDelete = (record) => {
        setRecordToDelete(record);
        setDeleteModalOpen(true);
    };

    const handleExportCSV = () => {
        if (!records.length) {
            error('Brak danych do eksportu.');
            return;
        }

        const headers = ['ID', 'Data', 'Kategoria', 'Typ', 'Kwota', 'Waluta', 'Opis', 'Zrodlo'];
        const csvRows = [headers.join(',')];

        records.forEach((r) => {
            const row = [
                `"${r.id}"`,
                `"${r.record_date}"`,
                `"${r.category?.name || r.category_id}"`,
                `"${r.record_type}"`,
                r.amount,
                `"${r.currency}"`,
                `"${(r.description || '').replace(/"/g, '""')}"`,
                `"${r.source || 'manual'}"`,
            ];
            csvRows.push(row.join(','));
        });

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `ksiega_glowna_${activeCompany?.code || 'FINBOARD'}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        success('Pobrano zestawienie operacji w formacie CSV.');
    };

    const getTypeBadge = (type) => {
        const normalized = (type || '').toLowerCase();
        switch (normalized) {
            case 'revenue':
            case 'income':
                return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 border border-emerald-800 text-emerald-400">PRZYCHÓD</span>;
            case 'expense':
                return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-950 border border-rose-800 text-rose-400">KOSZT OPEX</span>;
            case 'asset':
                return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-950 border border-sky-800 text-sky-400">AKTYWA</span>;
            case 'liability':
                return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 border border-amber-800 text-amber-400">PASYWA</span>;
            default:
                return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-300">{type}</span>;
        }
    };

    return (
        <div className="space-y-4 font-mono">
            {/* Top Ribbon */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-zinc-850 border border-zinc-750 flex items-center justify-center text-zinc-300">
                        <TableProperties className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-zinc-100 flex items-center gap-2">
                            <span>Księga Operacji Finansowych (General Ledger)</span>
                            <Badge variant="default" size="sm">{activeCompany?.code || 'PODMIOT'}</Badge>
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                            Podmiot: {activeCompany?.name} | Rejestr transakcji memoriałowych
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={Download}
                        onClick={handleExportCSV}
                        title="Eksportuj bieżący widok do CSV"
                    >
                        Eksportuj CSV
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        icon={Plus}
                        onClick={handleOpenCreate}
                    >
                        Nowy Zapis Księgowy
                    </Button>
                </div>
            </div>

            {/* Quick Metrics Bar for View */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800" data-testid="summary-card-total">
                    <div className="text-[10px] text-zinc-500 uppercase">Łącznie Pozycji</div>
                    <div className="text-sm font-bold text-zinc-100 tabular-nums mt-0.5" data-testid="summary-total-value">
                        {meta.total} <span className="text-[10px] text-zinc-500 font-normal">wpisów</span>
                    </div>
                </div>

                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800" data-testid="summary-card-income">
                    <div className="text-[10px] text-zinc-500 uppercase flex items-center gap-1">
                        <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                        Przychody (Strona)
                    </div>
                    <div className="text-sm font-bold text-emerald-400 tabular-nums mt-0.5" data-testid="summary-income-value">
                        {formatCurrency(summary.income, currency)}
                    </div>
                </div>

                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800" data-testid="summary-card-expense">
                    <div className="text-[10px] text-zinc-500 uppercase flex items-center gap-1">
                        <ArrowDownRight className="w-3 h-3 text-rose-400" />
                        Koszty OPEX (Strona)
                    </div>
                    <div className="text-sm font-bold text-rose-400 tabular-nums mt-0.5" data-testid="summary-expense-value">
                        {formatCurrency(summary.expense, currency)}
                    </div>
                </div>

                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800" data-testid="summary-card-balance">
                    <div className="text-[10px] text-zinc-500 uppercase flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-zinc-400" />
                        Saldo Operacji (Netto)
                    </div>
                    <div className={`text-sm font-bold tabular-nums mt-0.5 ${summary.balance >= 0 ? 'text-zinc-100' : 'text-rose-400'}`} data-testid="summary-balance-value">
                        {formatCurrency(summary.balance, currency)}
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                    {/* Search query */}
                    <div className="relative lg:col-span-2">
                        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                            placeholder="Szukaj po opisie, kontrahencie, fakturze..."
                            className="w-full bg-zinc-950 border border-zinc-750 rounded pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                        />
                    </div>

                    {/* Record type filter */}
                    <div>
                        <select
                            value={selectedType}
                            onChange={(e) => {
                                setSelectedType(e.target.value);
                                setPage(1);
                            }}
                            className="w-full bg-zinc-950 border border-zinc-750 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                        >
                            <option value="">Wszystkie typy</option>
                            <option value="revenue">Przychody (REVENUE)</option>
                            <option value="expense">Koszty (EXPENSE)</option>
                            <option value="asset">Aktywa (ASSET)</option>
                            <option value="liability">Pasywa (LIABILITY)</option>
                        </select>
                    </div>

                    {/* Category filter */}
                    <div>
                        <select
                            value={selectedCategory}
                            onChange={(e) => {
                                setSelectedCategory(e.target.value);
                                setPage(1);
                            }}
                            className="w-full bg-zinc-950 border border-zinc-750 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono truncate"
                        >
                            <option value="">Wszystkie kategorie</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                    [{c.code}] {c.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Reset button */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={RotateCcw}
                            onClick={handleResetFilters}
                            className="w-full text-xs"
                        >
                            Reset Filtrów
                        </Button>
                    </div>
                </div>

                {/* Date range sub-filter */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-850 text-[11px] text-zinc-400">
                    <span className="flex items-center gap-1 text-zinc-500">
                        <Calendar className="w-3 h-3" />
                        ZAKRES DAT:
                    </span>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                            setStartDate(e.target.value);
                            setPage(1);
                        }}
                        className="bg-zinc-950 border border-zinc-800 rounded px-2 py-0.5 text-xs text-zinc-200 focus:outline-none"
                    />
                    <span>do</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                            setEndDate(e.target.value);
                            setPage(1);
                        }}
                        className="bg-zinc-950 border border-zinc-800 rounded px-2 py-0.5 text-xs text-zinc-200 focus:outline-none"
                    />
                </div>
            </div>

            {/* Financial Ledger Table */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse font-mono text-xs">
                        <thead>
                            <tr className="bg-zinc-950 border-b border-zinc-800 text-[10px] text-zinc-400 uppercase tracking-wider">
                                <th className="py-2.5 px-3 w-10 text-center">
                                    <input
                                        type="checkbox"
                                        ref={(el) => {
                                            if (el) el.indeterminate = someSelected;
                                        }}
                                        checked={allSelected}
                                        onChange={handleToggleSelectAll}
                                        aria-label="Zaznacz wszystkie transakcje na stronie"
                                        data-testid="batch-master-checkbox"
                                        className="rounded border-zinc-750 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/20 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5 accent-emerald-500 align-middle"
                                    />
                                </th>
                                <th className="py-2.5 px-3.5 font-semibold w-28">Data</th>
                                <th className="py-2.5 px-3.5 font-semibold w-36">Kategoria</th>
                                <th className="py-2.5 px-3.5 font-semibold">Tytuł / Opis Transakcji</th>
                                <th className="py-2.5 px-3.5 font-semibold w-28 text-center">Typ</th>
                                <th className="py-2.5 px-3.5 font-semibold w-36 text-right">Kwota ({currency})</th>
                                <th className="py-2.5 px-3.5 font-semibold w-20 text-center">Akcje</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-850">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-zinc-500">
                                        Wczytywanie zapisów księgowych...
                                    </td>
                                </tr>
                            ) : records.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-zinc-500">
                                        Brak transakcji spełniających wybrane kryteria filtrów.
                                    </td>
                                </tr>
                            ) : (
                                records.map((record) => {
                                    const convertedAmt = convertAmount(Number(record.amount));
                                    const isIncome = record.record_type?.toLowerCase() === 'revenue' || record.record_type?.toLowerCase() === 'income';
                                    const isSelected = selectedSet.has(record.id);

                                    return (
                                        <tr
                                            key={record.id}
                                            className={`hover:bg-zinc-850/50 transition-colors group ${
                                                isSelected ? 'bg-emerald-950/20' : ''
                                            }`}
                                        >
                                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleToggleSelectRow(record)}
                                                    aria-label={`Zaznacz transakcję ${record.description}`}
                                                    data-testid={`record-checkbox-${record.id}`}
                                                    className="rounded border-zinc-750 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/20 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5 accent-emerald-500 align-middle"
                                                />
                                            </td>
                                            <td className="py-2.5 px-3.5 text-zinc-400 text-[11px] whitespace-nowrap">
                                                {record.record_date}
                                            </td>


                                            <td className="py-2.5 px-3.5 whitespace-nowrap">
                                                <span className="font-semibold text-zinc-200">
                                                    [{record.category?.code || 'N/A'}]
                                                </span>
                                                <span className="text-[10px] text-zinc-500 block truncate max-w-[130px]">
                                                    {record.category?.name || 'Inne'}
                                                </span>
                                            </td>

                                            <td className="py-2.5 px-3.5">
                                                <div className="text-zinc-100 font-medium truncate max-w-md">
                                                    {record.description}
                                                </div>
                                                <div className="text-[10px] text-zinc-500 flex items-center gap-2 mt-0.5">
                                                    <span>ŹRÓDŁO: {record.source?.toUpperCase() || 'MANUAL'}</span>
                                                    <span>•</span>
                                                    <span>ID: {record.id.substring(0, 8)}...</span>
                                                </div>
                                            </td>

                                            <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                                                {getTypeBadge(record.record_type)}
                                            </td>

                                            <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                                                <span className={`font-bold tabular-nums ${
                                                    isIncome ? 'text-emerald-400' : 'text-zinc-100'
                                                }`}>
                                                    {formatCurrency(convertedAmt, currency)}
                                                </span>
                                            </td>

                                            <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => handleOpenEdit(record)}
                                                        title="Edytuj zapis"
                                                        className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenDelete(record)}
                                                        title="Usuń zapis"
                                                        className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                <div className="px-4 py-3 bg-zinc-950 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-4 text-zinc-400 text-[11px]">
                        <span>
                            POZYCJE: <strong className="text-zinc-200">{meta.from}</strong> - <strong className="text-zinc-200">{meta.to}</strong> z <strong className="text-zinc-200">{meta.total}</strong>
                        </span>

                        <div className="flex items-center gap-1.5">
                            <span>NA STRONIE:</span>
                            <select
                                value={perPage}
                                onChange={(e) => {
                                    setPerPage(Number(e.target.value));
                                    setPage(1);
                                }}
                                className="bg-zinc-900 border border-zinc-750 rounded px-1.5 py-0.5 text-zinc-200 text-xs focus:outline-none"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={ChevronLeft}
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            Poprzednia
                        </Button>

                        <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono text-xs">
                            {meta.current_page} / {meta.last_page || 1}
                        </span>

                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={page >= meta.last_page}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            Następna
                            <ChevronRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Floating Batch Action Bar */}
            <BatchActionBar
                selectedCount={selectedRecordIds.length}
                totalAmount={selectedMetrics.total}
                incomeAmount={selectedMetrics.income}
                expenseAmount={selectedMetrics.expense}
                currency={currency}
                onClearSelection={() => setSelectedMap({})}
                onOpenBatchDelete={() => setBatchDeleteModalOpen(true)}
            />

            {/* Create & Edit Modal */}

            <FinancialRecordModal
                isOpen={recordModalOpen}
                onClose={() => setRecordModalOpen(false)}
                onSuccess={fetchRecords}
                categories={categories}
                recordToEdit={recordToEdit}
            />

            {/* Delete Confirmation Modal */}
            <DeleteRecordConfirmationModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onSuccess={fetchRecords}
                record={recordToDelete}
            />

            {/* Batch Delete Confirmation Modal */}
            <BatchDeleteConfirmationModal
                isOpen={batchDeleteModalOpen}
                onClose={() => setBatchDeleteModalOpen(false)}
                onConfirm={handleBatchDelete}
                selectedCount={selectedRecordIds.length}
                totalAmount={selectedMetrics.total}
                incomeAmount={selectedMetrics.income}
                expenseAmount={selectedMetrics.expense}
                currency={currency}
                loading={batchDeleting}
            />
        </div>
    );
};
