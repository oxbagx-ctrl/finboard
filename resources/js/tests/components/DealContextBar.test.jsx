import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DealContextBar } from '../../components/layout/DealContextBar';
import { DealProvider } from '../../context/DealContext';

describe('DealContextBar Component', () => {
    it('renders dynamic fiscal year options from DealContext', () => {
        render(
            <DealProvider initialYears={['2026', '2025', '2024', '2023']}>
                <DealContextBar />
            </DealProvider>
        );

        expect(screen.getByText('HISTORIA (2023-2026)')).toBeInTheDocument();
        expect(screen.getByText('FY 2026')).toBeInTheDocument();
        expect(screen.getByText('FY 2025')).toBeInTheDocument();
        expect(screen.getByText('FY 2024')).toBeInTheDocument();
        expect(screen.getByText('FY 2023')).toBeInTheDocument();
    });

    it('allows switching fiscal year and reveals quarter selector', () => {
        render(
            <DealProvider initialYears={['2026', '2025', '2024', '2023']}>
                <DealContextBar />
            </DealProvider>
        );

        const yearSelect = screen.getByRole('combobox');
        expect(screen.queryByText('KWARTAŁ:')).not.toBeInTheDocument();

        fireEvent.change(yearSelect, { target: { value: '2024' } });

        expect(screen.getByText('KWARTAŁ:')).toBeInTheDocument();
        expect(screen.getByText('RESET')).toBeInTheDocument();
    });

    it('resets filters when RESET button is clicked', () => {
        render(
            <DealProvider initialYears={['2026', '2025', '2024', '2023']}>
                <DealContextBar />
            </DealProvider>
        );

        const yearSelect = screen.getByRole('combobox');
        fireEvent.change(yearSelect, { target: { value: '2025' } });

        const resetBtn = screen.getByRole('button', { name: /RESET/i });
        fireEvent.click(resetBtn);

        expect(screen.queryByText('RESET')).not.toBeInTheDocument();
        expect(screen.queryByText('KWARTAŁ:')).not.toBeInTheDocument();
    });
});
