import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DebtRepaymentModeSwitcher, REPAYMENT_MODES } from '../../components/investments/DebtRepaymentModeSwitcher';

describe('DebtRepaymentModeSwitcher Component (Phase 43 Commit 215)', () => {
    const mockOnChangeMode = vi.fn();
    const mockOnResetToContract = vi.fn();

    const mockFacility = {
        principal_amount: 25000000,
        repayment_type: 'annuity',
        tenor_months: 120,
        grace_period_months: 12,
        base_interest_rate_percent: 5.85,
        margin_percent: 2.15,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders all three debt repayment modes with titles, badges, and contract badge', () => {
        render(
            <DebtRepaymentModeSwitcher
                facility={mockFacility}
                activeMode="annuity"
                contractMode="annuity"
                onChangeMode={mockOnChangeMode}
                onResetToContract={mockOnResetToContract}
                minDscr={1.35}
                avgDscr={1.52}
                totalInterest={8500000}
                baseInterest={8500000}
            />
        );

        expect(screen.getByText(/Profil Amortyzacji Długu Bankowego/i)).toBeInTheDocument();
        expect(screen.getByText('ZGODNY Z UMOWĄ')).toBeInTheDocument();

        // Check 3 modes
        expect(screen.getByText('Raty Równe (Annuity)')).toBeInTheDocument();
        expect(screen.getByText('Raty Malejące (Linear)')).toBeInTheDocument();
        expect(screen.getByText('Spłata Balonowa (Bullet)')).toBeInTheDocument();

        // Contract indicator
        expect(screen.getByText('[PROFIL Z UMOWY]')).toBeInTheDocument();
    });

    it('triggers onChangeMode when clicking a different repayment mode card', () => {
        render(
            <DebtRepaymentModeSwitcher
                facility={mockFacility}
                activeMode="annuity"
                contractMode="annuity"
                onChangeMode={mockOnChangeMode}
                onResetToContract={mockOnResetToContract}
                minDscr={1.35}
                avgDscr={1.52}
                totalInterest={8500000}
                baseInterest={8500000}
            />
        );

        // Click linear card
        const linearCard = screen.getByText('Raty Malejące (Linear)');
        fireEvent.click(linearCard);

        expect(mockOnChangeMode).toHaveBeenCalledTimes(1);
        expect(mockOnChangeMode).toHaveBeenCalledWith('linear');
    });

    it('displays bankable covenant badge when minDscr >= 1.20', () => {
        render(
            <DebtRepaymentModeSwitcher
                facility={mockFacility}
                activeMode="annuity"
                contractMode="annuity"
                onChangeMode={mockOnChangeMode}
                onResetToContract={mockOnResetToContract}
                minDscr={1.42}
                avgDscr={1.65}
                totalInterest={8500000}
                baseInterest={8500000}
            />
        );

        expect(screen.getByText('1.42x')).toBeInTheDocument();
        expect(screen.getByText(/BANKOWALNY \(≥ 1.2x\)/i)).toBeInTheDocument();
        expect(screen.getByText('1.65x')).toBeInTheDocument();
    });

    it('displays covenant risk badge when minDscr < 1.20', () => {
        render(
            <DebtRepaymentModeSwitcher
                facility={mockFacility}
                activeMode="bullet"
                contractMode="annuity"
                onChangeMode={mockOnChangeMode}
                onResetToContract={mockOnResetToContract}
                minDscr={0.85}
                avgDscr={1.10}
                totalInterest={12000000}
                baseInterest={8500000}
            />
        );

        expect(screen.getByText('0.85x')).toBeInTheDocument();
        expect(screen.getByText(/NARUSZENIE \(< 1.2x\)/i)).toBeInTheDocument();
        expect(screen.getByText('SYMULACJA ALTERNATYWNA')).toBeInTheDocument();
    });

    it('renders reset button when active mode differs from contract and calls onResetToContract on click', () => {
        render(
            <DebtRepaymentModeSwitcher
                facility={mockFacility}
                activeMode="linear"
                contractMode="annuity"
                onChangeMode={mockOnChangeMode}
                onResetToContract={mockOnResetToContract}
                minDscr={1.15}
                avgDscr={1.45}
                totalInterest={7200000}
                baseInterest={8500000}
            />
        );

        const resetBtn = screen.getByRole('button', { name: /Przywróć umowę \(annuity\)/i });
        expect(resetBtn).toBeInTheDocument();

        fireEvent.click(resetBtn);
        expect(mockOnResetToContract).toHaveBeenCalledTimes(1);
    });

    it('displays interest savings or additional cost against baseline', () => {
        const { rerender } = render(
            <DebtRepaymentModeSwitcher
                facility={mockFacility}
                activeMode="linear"
                contractMode="annuity"
                onChangeMode={mockOnChangeMode}
                onResetToContract={mockOnResetToContract}
                minDscr={1.15}
                avgDscr={1.45}
                totalInterest={7200000}
                baseInterest={8500000} // Savings: 1,300,000 PLN
            />
        );

        expect(screen.getByText(/-1\s*300\s*000\s*PLN/i)).toBeInTheDocument();

        // Rerender with higher interest
        rerender(
            <DebtRepaymentModeSwitcher
                facility={mockFacility}
                activeMode="bullet"
                contractMode="annuity"
                onChangeMode={mockOnChangeMode}
                onResetToContract={mockOnResetToContract}
                minDscr={0.85}
                avgDscr={1.10}
                totalInterest={11000000}
                baseInterest={8500000} // Extra cost: +2,500,000 PLN
            />
        );

        expect(screen.getByText(/\+2\s*500\s*000\s*PLN/i)).toBeInTheDocument();
    });
});
