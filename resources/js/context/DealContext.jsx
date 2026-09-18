import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

const DealContext = createContext(null);

export const CURRENCIES = [
    { code: 'PLN', symbol: 'zł', rate: 1.0, label: 'Polski Złoty (PLN)' },
    { code: 'EUR', symbol: '€', rate: 0.2325, label: 'Euro (EUR, kurs 4.30)' },
    { code: 'USD', symbol: '$', rate: 0.2564, label: 'US Dollar (USD, kurs 3.90)' },
];

export const FISCAL_YEARS = ['all', '2026', '2025'];
export const FISCAL_QUARTERS = [
    { id: 'all', label: 'Cały rok' },
    { id: 'Q1', label: 'Q1 (Sty - Mar)' },
    { id: 'Q2', label: 'Q2 (Kwi - Cze)' },
    { id: 'Q3', label: 'Q3 (Lip - Wrz)' },
    { id: 'Q4', label: 'Q4 (Paź - Gru)' },
];

export const DealProvider = ({ children }) => {
    const [selectedYear, setSelectedYear] = useState('all');
    const [selectedQuarter, setSelectedQuarter] = useState('all');
    const [currency, setCurrency] = useState('PLN');
    const [dealMetadata, setDealMetadata] = useState({
        code: 'PROJECT-APEX',
        phase: 'Due Diligence (Faza II)',
        accessLevel: 'STRICTLY CONFIDENTIAL',
        confidentialityClause: 'M&A Advisory Privilege // NDA Enforced',
    });

    const currentCurrencyObj = useMemo(() => {
        return CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];
    }, [currency]);

    // Calculate start_date and end_date based on year and quarter selection
    const dateRange = useMemo(() => {
        if (selectedYear === 'all') {
            return { startDate: null, endDate: null, label: 'Pełna historia (2025 – 2026)' };
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
            startDate: quarters[selectedQuarter].start,
            endDate: quarters[selectedQuarter].end,
            label: quarters[selectedQuarter].label,
        };
    }, [selectedYear, selectedQuarter]);

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
        selectedYear,
        setSelectedYear,
        selectedQuarter,
        setSelectedQuarter,
        currency,
        setCurrency,
        currentCurrencyObj,
        convertAmount,
        dateRange,
        dealMetadata,
        setDealMetadata,
        resetFilters,
    }), [
        selectedYear,
        selectedQuarter,
        currency,
        currentCurrencyObj,
        convertAmount,
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
