import { describe, it, expect } from 'vitest';
import {
    formatCurrency,
    formatPercent,
    formatRatio,
    formatDelta,
    formatFinancialDate,
    formatFileSize,
    formatDateTime,
} from '../../utils/formatters';

describe('formatCurrency', () => {
    it('formats numbers in standard Polish currency notation', () => {
        const result = formatCurrency(1250000, 'PLN');
        // Intl.NumberFormat in Polish uses non-breaking space (U+00A0 or U+202F)
        const normalized = result.replace(/\s/g, ' ');
        expect(normalized).toContain('1 250 000,00');
        expect(normalized).toMatch(/(zł|PLN)/);
    });

    it('formats EUR and USD currencies properly', () => {
        const eur = formatCurrency(14500.5, 'EUR').replace(/\s/g, ' ');
        const usd = formatCurrency(27200.75, 'USD').replace(/\s/g, ' ');

        expect(eur).toContain('14 500,50');
        expect(eur).toMatch(/(€|EUR)/);
        expect(usd).toContain('27 200,75');
        expect(usd).toMatch(/(USD|\$)/);
    });

    it('handles string numeric values', () => {
        const res = formatCurrency('99500.25', 'PLN').replace(/\s/g, ' ');
        expect(res).toContain('99 500,25');
    });

    it('gracefully handles null, undefined, zero and NaN', () => {
        expect(formatCurrency(null, 'PLN')).toBe('0,00 PLN');
        expect(formatCurrency(undefined, 'EUR')).toBe('0,00 EUR');
        expect(formatCurrency('not-a-number', 'USD')).toBe('0,00 USD');
        const zero = formatCurrency(0, 'PLN').replace(/\s/g, ' ');
        expect(zero).toContain('0,00');
    });

    describe('compact mode', () => {
        it('formats billions with "mld"', () => {
            expect(formatCurrency(2_500_000_000, 'PLN', true)).toBe('2.50 mld PLN');
            expect(formatCurrency(-1_200_000_000, 'EUR', true)).toBe('-1.20 mld EUR');
        });

        it('formats millions with "mln"', () => {
            expect(formatCurrency(14_850_000, 'PLN', true)).toBe('14.85 mln PLN');
            expect(formatCurrency(-3_400_000, 'USD', true)).toBe('-3.40 mln USD');
        });

        it('formats thousands with "tys."', () => {
            expect(formatCurrency(85_400, 'PLN', true)).toBe('85.4 tys. PLN');
            expect(formatCurrency(-12_300, 'PLN', true)).toBe('-12.3 tys. PLN');
        });

        it('falls back to standard formatting for amounts below 1000', () => {
            const result = formatCurrency(750, 'PLN', true).replace(/\s/g, ' ');
            expect(result).toContain('750,00');
        });
    });
});

describe('formatPercent', () => {
    it('converts decimal ratios into formatted percentage with sign', () => {
        expect(formatPercent(0.245)).toBe('+24.5%');
        expect(formatPercent(-0.038)).toBe('-3.8%');
        expect(formatPercent(0.0825, 2)).toBe('+8.25%');
    });

    it('formats already converted percentages (> 1.0) correctly', () => {
        expect(formatPercent(18.5)).toBe('+18.5%');
        expect(formatPercent(-12.4)).toBe('-12.4%');
    });

    it('respects showSign = false parameter', () => {
        expect(formatPercent(0.155, 1, false)).toBe('15.5%');
        expect(formatPercent(-0.155, 1, false)).toBe('-15.5%');
    });

    it('handles zero without a plus sign', () => {
        expect(formatPercent(0)).toBe('0.0%');
    });

    it('gracefully handles invalid inputs', () => {
        expect(formatPercent(null)).toBe('0.0%');
        expect(formatPercent(undefined)).toBe('0.0%');
        expect(formatPercent('invalid')).toBe('0.0%');
    });
});

describe('formatRatio', () => {
    it('formats multiples and valuation ratios with suffix', () => {
        expect(formatRatio(8.425)).toBe('8.43x');
        expect(formatRatio(1.2)).toBe('1.20x');
    });

    it('supports custom decimals and suffix', () => {
        expect(formatRatio(1.456, 1, 'x')).toBe('1.5x');
        expect(formatRatio(2.34, 2, ' pkt')).toBe('2.34 pkt');
    });

    it('handles edge cases and invalid inputs', () => {
        expect(formatRatio(null)).toBe('0.00x');
        expect(formatRatio(undefined)).toBe('0.00x');
        expect(formatRatio('not-a-number')).toBe('0.00x');
        expect(formatRatio(0)).toBe('0.00x');
    });
});

describe('formatDelta', () => {
    it('formats positive and negative financial deltas with explicit signs', () => {
        const pos = formatDelta(45000, 'PLN').replace(/\s/g, ' ');
        const neg = formatDelta(-18500, 'PLN').replace(/\s/g, ' ');

        expect(pos.startsWith('+')).toBe(true);
        expect(pos).toContain('45 000,00');
        expect(neg.startsWith('-')).toBe(true);
        expect(neg).toContain('18 500,00');
    });

    it('handles zero and null inputs gracefully', () => {
        expect(formatDelta(null, 'PLN')).toBe('0,00 PLN');
        expect(formatDelta(undefined, 'EUR')).toBe('0,00 EUR');
        expect(formatDelta('abc', 'PLN')).toBe('0,00 PLN');
    });
});

describe('formatFinancialDate', () => {
    it('formats ISO dates into Polish standard DD.MM.YYYY', () => {
        expect(formatFinancialDate('2026-08-15')).toBe('15.08.2026');
        expect(formatFinancialDate('2026-01-05')).toBe('05.01.2026');
    });

    it('formats dates into financial quarters', () => {
        expect(formatFinancialDate('2026-02-10', 'quarter')).toBe('Q1 2026');
        expect(formatFinancialDate('2026-05-20', 'quarter')).toBe('Q2 2026');
        expect(formatFinancialDate('2026-08-14', 'quarter')).toBe('Q3 2026');
        expect(formatFinancialDate('2026-11-30', 'quarter')).toBe('Q4 2026');
    });

    it('formats dates into abbreviated month notation', () => {
        expect(formatFinancialDate('2026-07-01', 'month')).toBe('LIP 2026');
        expect(formatFinancialDate('2026-01-15', 'month')).toBe('STY 2026');
        expect(formatFinancialDate('2026-12-31', 'month')).toBe('GRU 2026');
    });

    it('returns fallback on empty or invalid date strings', () => {
        expect(formatFinancialDate('')).toBe('—');
        expect(formatFinancialDate(null)).toBe('—');
        expect(formatFinancialDate('not-a-valid-date')).toBe('not-a-valid-date');
    });
});

describe('formatFileSize', () => {
    it('formats bytes, kilobytes, megabytes, and gigabytes', () => {
        expect(formatFileSize(512)).toBe('512 B');
        expect(formatFileSize(2048)).toBe('2.0 KB');
        expect(formatFileSize(1572864)).toBe('1.50 MB');
        expect(formatFileSize(2147483648)).toBe('2.00 GB');
    });

    it('handles zero, negative, and invalid values gracefully', () => {
        expect(formatFileSize(0)).toBe('0 B');
        expect(formatFileSize(-100)).toBe('0 B');
        expect(formatFileSize(null)).toBe('0 B');
        expect(formatFileSize(undefined)).toBe('0 B');
        expect(formatFileSize('abc')).toBe('0 B');
    });
});

describe('formatDateTime', () => {
    it('formats ISO timestamps to DD.MM.YYYY HH:MM:SS', () => {
        const result = formatDateTime('2026-09-18T14:30:15Z');
        expect(result).toMatch(/\d{2}\.\d{2}\.2026 \d{2}:\d{2}:\d{2}/);
    });

    it('handles empty and invalid timestamps', () => {
        expect(formatDateTime('')).toBe('—');
        expect(formatDateTime(null)).toBe('—');
        expect(formatDateTime('invalid-date')).toBe('invalid-date');
    });
});
