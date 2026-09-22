import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThreeStatementGrid } from '../../components/investments/ThreeStatementGrid';
import { InvestmentProjectContext } from '../../context/InvestmentProjectContext';

describe('ThreeStatementGrid Component (Phase 44 Commit 217)', () => {
    const mockProject = {
        id: 'proj-grid-test',
        name: 'Fabryka Półprzewodników 300mm',
        currency: 'PLN',
        start_date: '2026-01-01',
        commercial_operation_date: '2027-01-01',
        planning_horizon_years: 15,
        capex_stages: [
            {
                id: 'stage-cleanroom',
                stage_name: 'Budowa Cleanroom ISO 4',
                net_amount: 40000000,
                start_date: '2026-01-01',
                duration_months: 10,
                kst_code: 'KST_1',
                kst_annual_rate: 2.5,
            },
            {
                id: 'stage-steppers',
                stage_name: 'Litografia EUV & tracki',
                net_amount: 60000000,
                start_date: '2026-03-01',
                duration_months: 8,
                kst_code: 'KST_4',
                kst_annual_rate: 10.0,
            },
        ],
        debt_facility: {
            principal_amount: 60000000,
            base_interest_rate_percent: 5.75,
            margin_percent: 2.25,
            upfront_fee_percent: 1.0,
            tenor_months: 120,
            grace_period_months: 12,
            repayment_type: 'annuity',
        },
        financing_structure: {
            investor1_equity: 40000000,
            debt_facility_amount: 60000000,
        },
        operating_assumptions: {
            annual_revenue_base: 50000000,
            revenue_growth_rate_percent: 4.0,
            variable_cost_percent: 38.0,
            annual_fixed_costs_base: 6000000,
            fixed_cost_growth_rate_percent: 2.5,
            annual_payroll_base: 8000000,
            payroll_growth_rate_percent: 3.5,
            capacity_ramp_up: {
                year1_percent: 75.0,
                year2_percent: 90.0,
                year3_percent: 100.0,
            },
            cit_rate_percent: 19.0,
            tax_loss_carry_forward_enabled: true,
            tax_loss_offset_cap_percent: 50.0,
            dso: 40,
            dpo: 30,
            dio: 25,
            reinvestment_programs: [
                {
                    id: 'prog-stepper-upg',
                    name: 'Upgrade Źródeł EUV',
                    interval_years: 5,
                    first_occurrence_year: 5,
                    capex_amount: 5000000,
                    kst_code: 'KST_4',
                    kst_annual_rate: 10.0,
                    is_mandatory: true,
                },
            ],
        },
        wacc_parameters: {
            risk_free_rate_percent: 5.50,
            equity_risk_premium_percent: 6.00,
            levered_beta: 1.20,
            cost_of_equity_percent: 12.70,
            target_debt_ratio_percent: 60.0,
        },
    };

    const renderWithContext = (project = mockProject, props = {}) => {
        const contextValue = {
            selectedProject: project,
            selectedProjectId: project?.id || null,
            loading: false,
        };

        return render(
            <InvestmentProjectContext.Provider value={contextValue}>
                <ThreeStatementGrid project={project} {...props} />
            </InvestmentProjectContext.Provider>
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders empty state when no project is provided or selected', () => {
        renderWithContext(null);

        expect(screen.getByText('Brak Wybranego Projektu Inwestycyjnego')).toBeInTheDocument();
        expect(screen.getByText(/Wybierz projekt z selektora powyżej/i)).toBeInTheDocument();
    });

    it('renders 15-year P&L by default with core financial lines and columns', async () => {
        renderWithContext();

        // Toolbar buttons
        expect(screen.getByRole('button', { name: /RZiS \(P&L\)/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Bilans/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Cash Flow/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Wszystkie \(Zbiorczy\)/i })).toBeInTheDocument();

        // Granularity & Scale
        expect(screen.getByText('15 Lat (Rocznie)')).toBeInTheDocument();
        expect(screen.getByText('180 M (Miesięcznie)')).toBeInTheDocument();

        // 15-year columns
        await waitFor(() => {
            expect(screen.getByText('Rok 1')).toBeInTheDocument();
            expect(screen.getByText('Rok 15')).toBeInTheDocument();
        });

        // Core P&L lines
        expect(screen.getByText('Przychody ze Sprzedaży')).toBeInTheDocument();
        expect(screen.getByText('EBITDA (Zysk Operacyjny Gotówkowy)')).toBeInTheDocument();
        expect(screen.getByText(/EBIT \(Zysk Operacyjny\)/i)).toBeInTheDocument();
        expect(screen.getByText(/Wynik Finansowy Netto/i)).toBeInTheDocument();
    });

    it('switches to Balance Sheet and confirms Zero-Variance integrity strip', async () => {
        renderWithContext();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Bilans/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Bilans/i }));

        await waitFor(() => {
            expect(screen.getByText(/2\. Bilans \(Balance Sheet/i)).toBeInTheDocument();
            expect(screen.getByText('SUMA AKTYWÓW (TOTAL ASSETS)')).toBeInTheDocument();
            expect(screen.getByText('SUMA PASYWÓW (TOTAL LIABILITIES & EQUITY)')).toBeInTheDocument();
            expect(screen.getByText(/Test Zbilansowania \(Zero Variance/i)).toBeInTheDocument();
        });

        // Integrity badge
        const badge = screen.getByTestId('balance-integrity-badge');
        expect(badge).toHaveTextContent(/BILANS: ZERO VARIANCE/i);
    });

    it('switches to Cash Flow statement rendering OCF, ICF, FCF, and DCF metrics', async () => {
        renderWithContext();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Cash Flow/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Cash Flow/i }));

        await waitFor(() => {
            expect(screen.getByText(/3\. Rachunek Przepływów Pieniężnych/i)).toBeInTheDocument();
            expect(screen.getByText(/Przepływy z Działalności Operacyjnej \(OCF\)/i)).toBeInTheDocument();
            expect(screen.getByText(/Przepływy z Działalności Inwestycyjnej \(ICF \/ CAPEX\)/i)).toBeInTheDocument();
            expect(screen.getByText(/Przepływy z Działalności Finansowej \(FCF \/ Kredyt\)/i)).toBeInTheDocument();
            expect(screen.getByText(/Przepływ Pieniężny Netto/i)).toBeInTheDocument();
            expect(screen.getByText(/Free Cash Flow to Firm \(FCFF/i)).toBeInTheDocument();
            expect(screen.getByText(/Free Cash Flow to Equity \(FCFE/i)).toBeInTheDocument();
            expect(screen.getByText(/Kowenant DSCR/i)).toBeInTheDocument();
        });
    });

    it('switches to All-in-One Executive Summary view rendering all 3 statements', async () => {
        renderWithContext();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Wszystkie \(Zbiorczy\)/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Wszystkie \(Zbiorczy\)/i }));

        await waitFor(() => {
            expect(screen.getByText(/1\. Rachunek Zysków i Strat/i)).toBeInTheDocument();
            expect(screen.getByText(/2\. Bilans \(Balance Sheet/i)).toBeInTheDocument();
            expect(screen.getByText(/3\. Rachunek Przepływów Pieniężnych/i)).toBeInTheDocument();
        });
    });

    it('switches time granularity to monthly view with year filtering', async () => {
        renderWithContext();

        await waitFor(() => {
            expect(screen.getByText('180 M (Miesięcznie)')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('180 M (Miesięcznie)'));

        await waitFor(() => {
            expect(screen.getByText(/Filtr roku:/i)).toBeInTheDocument();
        });

        // Filter by Year 1
        const yearSelect = screen.getByRole('combobox', { name: /Wybierz rok/i });
        fireEvent.change(yearSelect, { target: { value: '1' } });

        await waitFor(() => {
            expect(screen.getByText('M1')).toBeInTheDocument();
            expect(screen.getByText('M12')).toBeInTheDocument();
            expect(screen.queryByText('M13')).not.toBeInTheDocument();
        });
    });

    it('switches currency presentation scale between full PLN, thousands, and millions', async () => {
        renderWithContext();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'tys.' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'mln' })).toBeInTheDocument();
        });

        // Switch to thousands
        fireEvent.click(screen.getByRole('button', { name: 'tys.' }));
        expect(screen.getByRole('button', { name: 'tys.' })).toHaveClass('font-bold');

        // Switch to millions
        fireEvent.click(screen.getByRole('button', { name: 'mln' }));
        expect(screen.getByRole('button', { name: 'mln' })).toHaveClass('font-bold');
    });

    it('collapses and expands detailed breakdown sections', async () => {
        renderWithContext();

        await waitFor(() => {
            expect(screen.getByText('↳ Koszty Zmienne (Media, Surowce, Prowizje)')).toBeInTheDocument();
        });

        // Click Collapse All
        fireEvent.click(screen.getByRole('button', { name: /^Zwiń wszystko$/i }));

        await waitFor(() => {
            expect(screen.queryByText('↳ Koszty Zmienne (Media, Surowce, Prowizje)')).not.toBeInTheDocument();
        });

        // Click Expand All
        fireEvent.click(screen.getByRole('button', { name: /^Rozwiń wszystko$/i }));

        await waitFor(() => {
            expect(screen.getByText('↳ Koszty Zmienne (Media, Surowce, Prowizje)')).toBeInTheDocument();
        });
    });

    it('filters rows by search query', async () => {
        renderWithContext();

        await waitFor(() => {
            expect(screen.getByPlaceholderText(/Szukaj pozycji/i)).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText(/Szukaj pozycji/i);
        fireEvent.change(searchInput, { target: { value: 'EBITDA' } });

        await waitFor(() => {
            expect(screen.getByText(/EBITDA \(Zysk Operacyjny Gotówkowy\)/i)).toBeInTheDocument();
            expect(screen.queryByText('Podatek Dochodowy CIT')).not.toBeInTheDocument();
        });
    });

    it('triggers CSV file download when clicking export button', async () => {
        // Mock URL.createObjectURL and link.click
        const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
        const revokeObjectURLMock = vi.fn();
        global.URL.createObjectURL = createObjectURLMock;
        global.URL.revokeObjectURL = revokeObjectURLMock;

        renderWithContext();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Eksportuj CSV/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Eksportuj CSV/i }));

        expect(createObjectURLMock).toHaveBeenCalled();
        expect(revokeObjectURLMock).toHaveBeenCalled();
    });
});
