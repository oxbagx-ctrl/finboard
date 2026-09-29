import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import apiClient from '../api/client';
import { AuthContext } from './AuthContext';

export const DealContext = createContext(null);

export const CURRENCIES = [
    { code: 'PLN', symbol: 'zł', name: 'złoty polski', rate: 1.0, midRate: 1.0, label: 'Polski Złoty (PLN)' },
    { code: 'EUR', symbol: '€', name: 'euro', rate: 0.2325, midRate: 4.30, label: 'Euro (EUR, kurs 4.3000)' },
    { code: 'USD', symbol: '$', name: 'dolar amerykański', rate: 0.2564, midRate: 3.90, label: 'US Dollar (USD, kurs 3.9000)' },
    { code: 'GBP', symbol: '£', name: 'funt szterling', rate: 0.1961, midRate: 5.10, label: 'Funt Szterling (GBP, kurs 5.1000)' },
];

export const CURRENCY_SYMBOLS = {
    PLN: 'zł',
    EUR: '€',
    USD: '$',
    GBP: '£',
    CHF: 'CHF',
};

export const FISCAL_YEARS = ['all', '2026', '2025'];
export const FISCAL_QUARTERS = [
    { id: 'all', label: 'Cały rok' },
    { id: 'Q1', label: 'Q1 (Sty - Mar)' },
    { id: 'Q2', label: 'Q2 (Kwi - Cze)' },
    { id: 'Q3', label: 'Q3 (Lip - Wrz)' },
    { id: 'Q4', label: 'Q4 (Paź - Gru)' },
];

export const DealProvider = ({ children, initialYears = ['2026', '2025'] }) => {
    const auth = useContext(AuthContext);
    const activeCompanyId = auth?.activeCompany?.id;

    const [availableYears, setAvailableYears] = useState(initialYears);
    const [loadingYears, setLoadingYears] = useState(false);
    const [selectedYear, setSelectedYear] = useState('all');
    const [selectedQuarter, setSelectedQuarter] = useState('all');
    const [currency, setCurrency] = useState('PLN');
    const [currencies, setCurrencies] = useState(CURRENCIES);
    const [ratesMetadata, setRatesMetadata] = useState({
        source: 'NBP',
        tableNo: null,
        effectiveDate: null,
        fetchedAt: null,
        cached: false,
        isFallback: true,
    });
    const [loadingRates, setLoadingRates] = useState(false);
    const [ratesError, setRatesError] = useState(null);

    const [dealMetadata, setDealMetadata] = useState({
        code: 'PROJECT-APEX',
        phase: 'Due Diligence (Faza II)',
        accessLevel: 'STRICTLY CONFIDENTIAL',
        confidentialityClause: 'M&A Advisory Privilege // NDA Enforced',
    });

    const refreshRates = useCallback(async (forceRefresh = false) => {
        try {
            setLoadingRates(true);
            setRatesError(null);
            const params = forceRefresh ? { refresh: 1 } : {};
            const res = await apiClient.get('/finance/exchange-rates', { params });

            if (res.data && res.data.rates && Array.isArray(res.data.rates)) {
                const dynamicCurrencies = [
                    {
                        code: 'PLN',
                        symbol: 'zł',
                        name: 'złoty polski',
                        rate: 1.0,
                        midRate: 1.0,
                        label: 'Polski Złoty (PLN)',
                    },
                    ...res.data.rates.map(r => {
                        const mid = Number(r.mid_rate ?? (1 / r.multiplier));
                        const mult = Number(r.multiplier ?? (1 / mid));
                        const sym = CURRENCY_SYMBOLS[r.currency] || r.currency;
                        const name = r.currency_name || r.currency;
                        return {
                            code: r.currency,
                            symbol: sym,
                            name: name,
                            rate: mult,
                            midRate: mid,
                            label: `${name} (${r.currency}, kurs ${mid.toFixed(4)})`,
                            tableNo: r.table_no,
                            effectiveDate: r.effective_date,
                        };
                    }),
                ];

                setCurrencies(dynamicCurrencies);
                setRatesMetadata({
                    source: res.data.source || 'NBP',
                    tableNo: res.data.table_no || null,
                    effectiveDate: res.data.effective_date || null,
                    fetchedAt: res.data.fetched_at || null,
                    cached: Boolean(res.data.cached),
                    isFallback: false,
                });
            }
        } catch (err) {
            setRatesError(err?.message || 'Błąd pobierania kursów NBP');
            setRatesMetadata(prev => ({ ...prev, isFallback: true }));
        } finally {
            setLoadingRates(false);
        }
    }, []);

    const fetchAvailableYears = useCallback(async () => {
        try {
            setLoadingYears(true);
            const params = {};
            if (activeCompanyId) {
                params.company_id = activeCompanyId;
            }
            const res = await apiClient.get('/finance/analytics/years', { params });
            if (res.data?.data && Array.isArray(res.data.data) && res.data.data.length > 0) {
                const stringYears = res.data.data.map(y => String(y));
                setAvailableYears(stringYears);
            }
        } catch (e) {
            // Keep fallback
        } finally {
            setLoadingYears(false);
        }
    }, [activeCompanyId]);

    useEffect(() => {
        const hasToken = auth?.token || (typeof localStorage !== 'undefined' && localStorage.getItem('finboard_token'));
        if (hasToken) {
            fetchAvailableYears();
            refreshRates();
        }
    }, [activeCompanyId, fetchAvailableYears, refreshRates, auth?.token]);

    useEffect(() => {
        const handleCompanyChange = (e) => {
            fetchAvailableYears();
            refreshRates();
            if (e?.detail?.code) {
                setDealMetadata(prev => ({
                    ...prev,
                    code: `PROJECT-${e.detail.code}`,
                }));
            }
        };
        window.addEventListener('finboard:company-changed', handleCompanyChange);
        return () => window.removeEventListener('finboard:company-changed', handleCompanyChange);
    }, [fetchAvailableYears, refreshRates]);

    // If selectedYear is not 'all' and no longer present in availableYears, reset to 'all'
    useEffect(() => {
        if (selectedYear !== 'all' && availableYears.length > 0 && !availableYears.includes(selectedYear)) {
            setSelectedYear('all');
            setSelectedQuarter('all');
        }
    }, [availableYears, selectedYear]);

    const currentCurrencyObj = useMemo(() => {
        return currencies.find(c => c.code === currency) || currencies[0] || CURRENCIES[0];
    }, [currencies, currency]);

    // Calculate start_date and end_date based on year and quarter selection
    const dateRange = useMemo(() => {
        if (selectedYear === 'all') {
            const minYear = availableYears.length > 0 ? availableYears[availableYears.length - 1] : '2025';
            const maxYear = availableYears.length > 0 ? availableYears[0] : '2026';
            const label = availableYears.length > 1
                ? `Pełna historia (${minYear} – ${maxYear})`
                : (availableYears.length === 1 ? `Rok obrachunkowy ${availableYears[0]}` : 'Pełna historia');

            return { startDate: null, endDate: null, label };
        }

        const y = parseInt(selectedYear, 10);

        if (selectedQuarter === 'all') {
            return {
                startDate: `${y}-01-01`,
                endDate: `${y}-12-31`,
                label: `Rok obrachunkowy ${y}`,
            };
        }

        const quarters = {
            Q1: { start: `${y}-01-01`, end: `${y}-03-31`, label: `Q1 ${y} (01.01 – 31.03)` },
            Q2: { start: `${y}-04-01`, end: `${y}-06-30`, label: `Q2 ${y} (01.04 – 30.06)` },
            Q3: { start: `${y}-07-01`, end: `${y}-09-30`, label: `Q3 ${y} (01.07 – 30.09)` },
            Q4: { start: `${y}-10-01`, end: `${y}-12-31`, label: `Q4 ${y} (01.10 – 31.12)` },
        };

        return {
            startDate: quarters[selectedQuarter]?.start || `${y}-01-01`,
            endDate: quarters[selectedQuarter]?.end || `${y}-12-31`,
            label: quarters[selectedQuarter]?.label || `Rok obrachunkowy ${y}`,
        };
    }, [selectedYear, selectedQuarter, availableYears]);

    // Converts monetary amount in PLN to selected currency
    const convertAmount = useCallback((amountInPln) => {
        if (amountInPln === undefined || amountInPln === null || isNaN(Number(amountInPln))) {
            return 0;
        }
        return Number(amountInPln) * currentCurrencyObj.rate;
    }, [currentCurrencyObj]);

    const resetFilters = useCallback(() => {
        setSelectedYear('all');
        setSelectedQuarter('all');
        setCurrency('PLN');
    }, []);

    const value = useMemo(() => ({
        activeCompany: auth?.activeCompany || null,
        activeCompanyId: auth?.activeCompany?.id || null,
        switchCompany: auth?.switchCompany || (() => {}),
        availableYears,
        setAvailableYears,
        loadingYears,
        refreshAvailableYears: fetchAvailableYears,
        selectedYear,
        setSelectedYear,
        selectedQuarter,
        setSelectedQuarter,
        currency,
        setCurrency,
        currencies,
        currentCurrencyObj,
        convertAmount,
        ratesMetadata,
        loadingRates,
        ratesError,
        refreshRates,
        dateRange,
        dealMetadata,
        setDealMetadata,
        resetFilters,
    }), [
        auth?.activeCompany,
        auth?.switchCompany,
        availableYears,
        loadingYears,
        fetchAvailableYears,
        selectedYear,
        selectedQuarter,
        currency,
        currencies,
        currentCurrencyObj,
        convertAmount,
        ratesMetadata,
        loadingRates,
        ratesError,
        refreshRates,
        dateRange,
        dealMetadata,
        resetFilters,
    ]);

    return (
        <DealContext.Provider value={value}>
            {children}
        </DealContext.Provider>
    );
};

export const useDeal = () => {
    const context = useContext(DealContext);
    if (!context) {
        throw new Error('useDeal must be used within a DealProvider');
    }
    return context;
};

export const useOptionalDeal = () => {
    return useContext(DealContext);
};

