/**
 * Professional Financial Formatters for Deal Advisory and Corporate Finance.
 * Enforces tabular-nums consistency and standard institutional notation.
 */

/**
 * Formats a monetary amount into institutional Polish or International currency notation.
 * e.g. 1500000 -> "1 500 000,00 PLN" or "1.50M PLN"
 */
export const formatCurrency = (amount, currency = 'PLN', compact = false) => {
    if (amount === undefined || amount === null || isNaN(Number(amount))) {
        return `0,00 ${currency}`;
    }

    const num = Number(amount);

    if (compact) {
        const abs = Math.abs(num);
        if (abs >= 1_000_000_000) {
            return `${(num / 1_000_000_000).toFixed(2)} mld ${currency}`;
        }
        if (abs >= 1_000_000) {
            return `${(num / 1_000_000).toFixed(2)} mln ${currency}`;
        }
        if (abs >= 1_000) {
            return `${(num / 1_000).toFixed(1)} tys. ${currency}`;
        }
    }

    return new Intl.NumberFormat('pl-PL', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num);
};

/**
 * Formats a financial margin or percentage change.
 * e.g. 0.245 -> "+24.5%" or -0.032 -> "-3.2%"
 */
export const formatPercent = (value, decimals = 1, showSign = true) => {
    if (value === undefined || value === null || isNaN(Number(value))) {
        return '0.0%';
    }

    const num = Number(value);
    // If value is a ratio (<= 1.0 and >= -1.0) convert to percent, unless already passed as percent
    const percentValue = Math.abs(num) <= 1.0 && num !== 0 ? num * 100 : num;
    const sign = showSign && percentValue > 0 ? '+' : '';

    return `${sign}${percentValue.toFixed(decimals)}%`;
};

/**
 * Formats financial multiples and liquidity ratios.
 * e.g. 1.854 -> "1.85x"
 */
export const formatRatio = (ratio, decimals = 2, suffix = 'x') => {
    if (ratio === undefined || ratio === null || isNaN(Number(ratio))) {
        return `0.00${suffix}`;
    }

    return `${Number(ratio).toFixed(decimals)}${suffix}` ?? '0.00x';
};

/**
 * Formats a delta monetary amount with explicit sign.
 * e.g. 45000 -> "+45 000,00 PLN", -12000 -> "-12 000,00 PLN"
 */
export const formatDelta = (amount, currency = 'PLN') => {
    if (amount === undefined || amount === null || isNaN(Number(amount))) {
        return `0,00 ${currency}`;
    }

    const num = Number(amount);
    const sign = num > 0 ? '+' : '';
    const formatted = formatCurrency(Math.abs(num), currency);

    return `${sign}${num < 0 ? '-' : ''}${formatted}`;
};

/**
 * Formats an ISO date into standard transaction period notation.
 * e.g. "2026-02-15" -> "15.02.2026" or "Q1 2026"
 */
export const formatFinancialDate = (dateString, format = 'date') => {
    if (!dateString) return '—';

    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;

    if (format === 'quarter') {
        const q = Math.floor(d.getMonth() / 3) + 1;
        return `Q${q} ${d.getFullYear()}`;
    }

    if (format === 'month') {
        const months = ['STY', 'LUT', 'MAR', 'KWI', 'MAJ', 'CZE', 'LIP', 'SIE', 'WRZ', 'PAŹ', 'LIS', 'GRU'];
        return `${months[d.getMonth()]} ${d.getFullYear()}`;
    }

    // Default: DD.MM.YYYY
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}.${d.getFullYear()}`;
};

/**
 * Formats bytes into human-readable institutional storage notation (KB, MB, GB).
 */
export const formatFileSize = (bytes) => {
    if (bytes === undefined || bytes === null || isNaN(Number(bytes)) || Number(bytes) <= 0) {
        return '0 B';
    }
    const num = Number(bytes);
    if (num >= 1_073_741_824) {
        return `${(num / 1_073_741_824).toFixed(2)} GB`;
    }
    if (num >= 1_048_576) {
        return `${(num / 1_048_576).toFixed(2)} MB`;
    }
    if (num >= 1024) {
        return `${(num / 1024).toFixed(1)} KB`;
    }
    return `${num} B`;
};

/**
 * Formats an ISO timestamp into full audit timestamp notation: DD.MM.YYYY HH:MM:SS
 */
export const formatDateTime = (dateString) => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
};
