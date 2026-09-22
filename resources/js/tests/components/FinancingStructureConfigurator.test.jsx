import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FinancingStructureConfigurator } from '../../components/investments/FinancingStructureConfigurator';
import { InvestmentProjectContext } from '../../context/InvestmentProjectContext';
import { investmentProjectsApi } from '../../api/investmentProjects';

vi.mock('../../api/investmentProjects', () => ({
    investmentProjectsApi: {
        updateProject: vi.fn(),
    },
}));

describe('FinancingStructureConfigurator Component', () => {
    const mockLoadProjectDetails = vi.fn();

    const mockProjectBalanced = {
        id: 'proj-001',
        name: 'Farma Wiatrowa Bałtyk 50MW',
        currency: 'PLN',
        status: 'draft',
        capex_stages: [
            { id: 's1', stage_name: 'Turbiny', net_amount: '6000000.00' },
            { id: 's2', stage_name: 'Infrastruktura', net_amount: '4000000.00' },
        ],
        financing_structure: {
            id: 'fs-001',
            equity_contribution: 3000000,
            bank_loan_amount: 5000000,
            grant_amount: 2000000,
            vat_bridge_loan: 2300000,
            currency: 'PLN',
        },
        debt_facilities: [
            {
                id: 'df-001',
                facility_name: 'Kredyt Bankowy Senior Debt',
                principal_amount: 5000000,
                base_rate_type: 'WIBOR_3M',
                base_rate_percent: 5.85,
                margin_percent: 2.15,
                tenor_months: 120,
                grace_period_months: 12,
                amortization_type: 'ANNUITY',
                upfront_fee_percent: 1.0,
                currency: 'PLN',
            },
        ],
    };

    const mockProjectWithGap = {
        ...mockProjectBalanced,
        id: 'proj-002',
        financing_structure: {
            ...mockProjectBalanced.financing_structure,
            equity_contribution: 2000000,
            bank_loan_amount: 5000000,
            grant_amount: 0,
        },
        debt_facilities: [
            {
                ...mockProjectBalanced.debt_facilities[0],
                principal_amount: 5000000,
            },
        ],
    };

    const mockProjectWithSurplus = {
        ...mockProjectBalanced,
        id: 'proj-003',
        financing_structure: {
            ...mockProjectBalanced.financing_structure,
            equity_contribution: 6000000,
            bank_loan_amount: 6000000,
            grant_amount: 0,
        },
        debt_facilities: [
            {
                ...mockProjectBalanced.debt_facilities[0],
                principal_amount: 6000000,
            },
        ],
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderWithContext = (selectedProject = mockProjectBalanced) => {
        const contextValue = {
            selectedProject,
            loadProjectDetails: mockLoadProjectDetails,
        };

        return render(
            <InvestmentProjectContext.Provider value={contextValue}>
                <FinancingStructureConfigurator />
            </InvestmentProjectContext.Provider>
        );
    };

    it('renders empty message when no project is selected', () => {
        renderWithContext(null);
        expect(screen.getByText(/Wybierz projekt inwestycyjny, aby skonfigurować montaż finansowy/i)).toBeInTheDocument();
    });

    it('renders capital stack metrics and shows 100% balanced badge', () => {
        renderWithContext(mockProjectBalanced);

        // Header Title
        expect(screen.getByText(/Montaż Finansowy & Struktura Długu/i)).toBeInTheDocument();

        // 100% Balanced Badge
        expect(screen.getByText(/Finansowanie w pełni zbilansowane \(100%\)/i)).toBeInTheDocument();

        // CAPEX: 6M + 4M = 10M PLN
        expect(screen.getAllByText(/10.*000.*000,00/i).length).toBeGreaterThanOrEqual(1);

        // Total Funding: 3M + 5M + 2M = 10M PLN
        expect(screen.getAllByText(/10.*000.*000,00/i).length).toBeGreaterThanOrEqual(1);

        // Interest rate: 5.85 + 2.15 = 8.00%
        expect(screen.getByText(/8\.00%/i)).toBeInTheDocument();
    });

    it('correctly calculates and indicates a funding gap', () => {
        renderWithContext(mockProjectWithGap);

        // CAPEX = 10M, Funding = 2M + 5M = 7M -> Gap = 3M
        const gapBadges = screen.getAllByText(/Luka finansowa:/i);
        expect(gapBadges.length).toBeGreaterThanOrEqual(1);

        // Gap amount formatted with 3 000 000
        expect(screen.getAllByText(/3.*000.*000,00/i).length).toBeGreaterThanOrEqual(1);
    });

    it('correctly indicates a capital surplus', () => {
        renderWithContext(mockProjectWithSurplus);

        // CAPEX = 10M, Funding = 6M + 6M = 12M -> Surplus = 2M
        expect(screen.getByText(/Nadwyżka kapitału:/i)).toBeInTheDocument();
        expect(screen.getAllByText(/2.*000.*000,00/i).length).toBeGreaterThanOrEqual(1);
    });

    it('calculates total nominal rate dynamically when base rate or margin change', () => {
        renderWithContext(mockProjectBalanced);

        const baseRateInput = screen.getByDisplayValue('5.85');
        const marginInput = screen.getByDisplayValue('2.15');

        fireEvent.change(baseRateInput, { target: { value: '6.50' } });
        fireEvent.change(marginInput, { target: { value: '2.50' } });

        // 6.50 + 2.50 = 9.00%
        expect(screen.getByText(/9\.00%/i)).toBeInTheDocument();
    });

    it('allows changing amortization type between Annuity, Linear, and Bullet', () => {
        renderWithContext(mockProjectBalanced);

        const linearBtn = screen.getByRole('button', { name: /Linear Równy kapitał/i });
        fireEvent.click(linearBtn);
        expect(linearBtn).toHaveClass('border-amber-500');

        const bulletBtn = screen.getByRole('button', { name: /Bullet Spłata na koniec/i });
        fireEvent.click(bulletBtn);
        expect(bulletBtn).toHaveClass('border-amber-500');
    });

    it('allows quick setting equity percentage via 20% and 30% buttons', () => {
        renderWithContext(mockProjectBalanced);

        const btn20 = screen.getByRole('button', { name: /20% CAPEX/i });
        fireEvent.click(btn20);

        // 20% of 10M = 2 000 000
        const equityInput = screen.getByLabelText(/Kwota Wkładu Własnego/i);
        expect(equityInput.value).toBe('2000000');
    });

    it('submits updated financing structure to API when clicking Save button', async () => {
        investmentProjectsApi.updateProject.mockResolvedValueOnce({
            data: { status: 'success', data: mockProjectBalanced },
        });

        renderWithContext(mockProjectBalanced);

        const saveBtn = screen.getByRole('button', { name: /Zapisz Montaż Finansowy/i });
        fireEvent.click(saveBtn);

        await waitFor(() => {
            expect(investmentProjectsApi.updateProject).toHaveBeenCalledTimes(1);
            expect(investmentProjectsApi.updateProject).toHaveBeenCalledWith(
                'proj-001',
                expect.objectContaining({
                    equity_contribution: 3000000,
                    bank_loan_principal: 5000000,
                    grant_amount: 2000000,
                    vat_bridge_loan: 2300000,
                    bank_base_rate: 5.85,
                    bank_margin: 2.15,
                    bank_tenor_months: 120,
                    bank_grace_period_months: 12,
                    amortization_type: 'ANNUITY',
                    upfront_fee_rate: 1.0,
                })
            );
            expect(mockLoadProjectDetails).toHaveBeenCalledWith('proj-001');
            expect(screen.getByText(/Struktura finansowania została pomyślnie zapisana/i)).toBeInTheDocument();
        });
    });
});
