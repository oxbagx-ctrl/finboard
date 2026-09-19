import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FinancialMultiplesStrip } from '../../components/ui/FinancialMultiplesStrip';

describe('FinancialMultiplesStrip Component', () => {
    it('binds directly to unified ratios dictionary and displays values', () => {
        const mockRatios = {
            current_ratio: 1.85,
            quick_ratio: 1.42,
            gross_margin: 0.45,
            gross_margin_pct: 45.0,
            ebitda_margin: 0.22,
            ebitda_margin_pct: 22.0,
            operating_margin: 0.18,
            operating_margin_pct: 18.0,
            net_margin: 0.12,
            net_margin_pct: 12.0,
            debt_to_assets: 0.38,
        };

        render(
            <FinancialMultiplesStrip
                ratios={mockRatios}
            />
        );

        expect(screen.getByText('CURRENT RATIO')).toBeInTheDocument();
        expect(screen.getByText('1.85x')).toBeInTheDocument();
        expect(screen.getByText('QUICK RATIO')).toBeInTheDocument();
        expect(screen.getByText('1.42x')).toBeInTheDocument();
        expect(screen.getByText('MARŻA BRUTTO')).toBeInTheDocument();
        expect(screen.getByText('45.0%')).toBeInTheDocument();
        expect(screen.getByText('MARŻA EBITDA')).toBeInTheDocument();
        expect(screen.getByText('22.0%')).toBeInTheDocument();
        expect(screen.getByText('MARŻA OPERACYJNA')).toBeInTheDocument();
        expect(screen.getByText('18.0%')).toBeInTheDocument();
        expect(screen.getByText('MARŻA NETTO')).toBeInTheDocument();
        expect(screen.getByText('12.0%')).toBeInTheDocument();
        expect(screen.getByText('WSKAŹNIK ZADŁUŻENIA')).toBeInTheDocument();
        expect(screen.getByText('0.38x')).toBeInTheDocument();
    });

    it('renders dynamic benchmark statuses including OPT, WARN, CRIT and UNKNOWN (N/A)', () => {
        const mockBenchmarks = {
            current_ratio: {
                target: 1.5,
                status: 'OPT',
                has_data: true,
            },
            quick_ratio: {
                target: 1.0,
                status: 'WARN',
                has_data: true,
            },
            ebitda_margin: {
                target_value: 25,
                status: 'CRIT',
                has_data: true,
            },
            debt_to_assets: {
                target: 0.5,
                status: 'UNKNOWN',
                has_data: false,
                is_unknown: true,
            },
        };

        const onConfigureMock = vi.fn();

        render(
            <FinancialMultiplesStrip
                currentRatio={1.6}
                quickRatio={0.9}
                ebitdaMargin={0.08}
                debtRatio={0}
                benchmarks={mockBenchmarks}
                onConfigure={onConfigureMock}
            />
        );

        // Benchmark header and configure button
        expect(screen.getByText('BENCHMARKI DORADCY & STATUSY KPI')).toBeInTheDocument();
        const configBtn = screen.getByText('Konfiguruj cele');
        expect(configBtn).toBeInTheDocument();
        fireEvent.click(configBtn);
        expect(onConfigureMock).toHaveBeenCalledTimes(1);

        // Status chips
        expect(screen.getByText('OPT')).toBeInTheDocument();
        expect(screen.getByText('WARN')).toBeInTheDocument();
        expect(screen.getByText('CRIT')).toBeInTheDocument();
        expect(screen.getByText('N/A')).toBeInTheDocument();
    });
});
