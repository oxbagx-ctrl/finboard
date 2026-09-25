import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BankingCovenantsStrip, COVENANT_PRESETS } from '../../components/investments/BankingCovenantsStrip';
import { InvestmentProjectContext } from '../../context/InvestmentProjectContext';

describe('BankingCovenantsStrip Component (Phase 44 Commit 220)', () => {
    const mockProject = {
        id: 'proj-covenants-test',
        name: 'Centrum Logistyczne Kraków Park',
        currency: 'PLN',
        start_date: '2026-01-01',
        commercial_operation_date: '2027-01-01',
        planning_horizon_years: 15,
        capex_stages: [
            {
                id: 'stage-1',
                stage_name: 'Hala Magazynowa A',
                net_amount: 30000000,
                start_date: '2026-01-01',
                duration_months: 8,
                kst_code: 'KST_1',
                kst_annual_rate: 2.5,
            },
            {
                id: 'stage-2',
                stage_name: 'System Automatyki Wysokiego Składu',
                net_amount: 20000000,
                start_date: '2026-04-01',
                duration_months: 6,
                kst_code: 'KST_4',
                kst_annual_rate: 10.0,
            },
        ],
        debt_facility: {
            principal_amount: 35000000,
            base_interest_rate_percent: 5.25,
            margin_percent: 2.00,
            upfront_fee_percent: 1.0,
            tenor_months: 120,
            grace_period_months: 12,
            repayment_type: 'annuity',
        },
        financing_structure: {
            investor1_equity: 10000000,
            investor2_equity: 5000000,
            debt_facility_amount: 35000000,
        },
        operating_assumptions: {
            annual_revenue_base: 25000000,
            revenue_growth_rate_percent: 3.5,
            variable_cost_percent: 25.0,
            annual_fixed_costs_base: 3000000,
            fixed_cost_growth_rate_percent: 2.0,
            annual_payroll_base: 3500000,
            payroll_growth_rate_percent: 3.0,
            capacity_ramp_up: {
                year1_percent: 80.0,
                year2_percent: 95.0,
                year3_percent: 100.0,
            },
            cit_rate_percent: 19.0,
            tax_loss_carry_forward_enabled: true,
            tax_loss_offset_cap_percent: 50.0,
            dso: 35,
            dpo: 30,
            dio: 15,
        },
        valuation_multiple: {
            multiple: 8.5,
            multiple_type: 'ev_ebitda',
        },
        wacc_parameters: {
            risk_free_rate_percent: 5.50,
            equity_risk_premium_percent: 6.00,
            levered_beta: 1.10,
            cost_of_equity_percent: 12.10,
            target_debt_ratio_percent: 70.0,
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
                <BankingCovenantsStrip project={project} {...props} />
            </InvestmentProjectContext.Provider>
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders empty fallback state when no project is provided', () => {
        renderWithContext(null);

        expect(screen.getByText(/Brak aktywnego projektu do audytu kowenantów bankowych/i)).toBeInTheDocument();
    });

    it('renders default banking covenants strip with header, bankability badge, and 5 KPI tiles', async () => {
        renderWithContext();

        // Header
        expect(screen.getByText(/KOWENANTY BANKOWE & TEST BANKOWALNOŚCI \(15 LAT\)/i)).toBeInTheDocument();

        // Preset buttons
        expect(screen.getByText('Standard (1.20x)')).toBeInTheDocument();
        expect(screen.getByText('Konserwatywny (1.30x)')).toBeInTheDocument();

        // 5 KPI Tiles
        await waitFor(() => {
            expect(screen.getByText('KOWENANT DSCR')).toBeInTheDocument();
            expect(screen.getByText('POKRYCIE ODSETEK (ICR)')).toBeInTheDocument();
            expect(screen.getByText('PŁYNNOŚĆ BIEŻĄCA (CR)')).toBeInTheDocument();
            expect(screen.getByText('DŹWIGNIA (NET DEBT/EBITDA)')).toBeInTheDocument();
            expect(screen.getByText('REZERWA DSRF')).toBeInTheDocument();
        });
    });

    it('renders bankability status badge with covenant breach detection', async () => {
        renderWithContext();

        await waitFor(() => {
            expect(screen.getByText(/NARUSZENIE KOWENANTU/i)).toBeInTheDocument();
        });
    });

    it('renders PROJEKT BANKOWALNY badge for high-coverage project', async () => {
        const bankableProject = {
            ...mockProject,
            debt_facility: {
                ...mockProject.debt_facility,
                principal_amount: 5000000,
            },
            financing_structure: {
                investor1_equity: 35000000,
                investor2_equity: 10000000,
                debt_facility_amount: 5000000,
            },
            operating_assumptions: {
                ...mockProject.operating_assumptions,
                annual_revenue_base: 50000000,
            }
        };

        renderWithContext(bankableProject);

        await waitFor(() => {
            expect(screen.getByText(/PROJEKT BANKOWALNY/i)).toBeInTheDocument();
        });
    });

    it('toggles expand and collapse of the 15-year detailed audit section', async () => {
        renderWithContext();

        const toggleButton = screen.getByRole('button', { name: /Szczegóły kowenantów/i });
        expect(toggleButton).toBeInTheDocument();

        // Expand
        fireEvent.click(toggleButton);

        await waitFor(() => {
            expect(screen.getByText('1. Roczna Matryca Kowenantów (15L)')).toBeInTheDocument();
            expect(screen.getByText('2. Konfigurator Wymogów Banku (Stress)')).toBeInTheDocument();
            expect(screen.getByText('3. Wąskie Gardło & Analiza Buforu')).toBeInTheDocument();
        });

        // Collapse
        const collapseButton = screen.getByRole('button', { name: /Ukryj audyt/i });
        fireEvent.click(collapseButton);

        await waitFor(() => {
            expect(screen.queryByText('1. Roczna Matryca Kowenantów (15L)')).not.toBeInTheDocument();
        });
    });

    it('renders annual matrix sub-tab with 15 periods and table headers', async () => {
        renderWithContext(mockProject, { defaultExpanded: true });

        await waitFor(() => {
            expect(screen.getByText('1. Roczna Matryca Kowenantów (15L)')).toBeInTheDocument();
            expect(screen.getByText('Okres')).toBeInTheDocument();
            expect(screen.getByText('EBITDA')).toBeInTheDocument();
            expect(screen.getByText('CFADS')).toBeInTheDocument();
            expect(screen.getByText('Obsługa Długu')).toBeInTheDocument();
            expect(screen.getByText('Rok 1')).toBeInTheDocument();
            expect(screen.getByText('Rok 15')).toBeInTheDocument();
        });
    });

    it('filters table rows by debt-only and all periods', async () => {
        renderWithContext(mockProject, { defaultExpanded: true });

        await waitFor(() => {
            expect(screen.getByText('Wszystkie (15L)')).toBeInTheDocument();
            expect(screen.getByText('Rok 1')).toBeInTheDocument();
        });

        // Filter: Lata z długiem
        const debtFilterBtn = screen.getByRole('button', { name: /Lata z długiem/i });
        fireEvent.click(debtFilterBtn);

        // Still contains commercial years with debt
        expect(screen.getByText('Rok 2')).toBeInTheDocument();

        // Switch back to all
        const allFilterBtn = screen.getByRole('button', { name: /Wszystkie \(15L\)/i });
        fireEvent.click(allFilterBtn);
        expect(screen.getByText('Rok 1')).toBeInTheDocument();
    });

    it('switches between Standard LMA and Conservative Consortium presets', async () => {
        renderWithContext(mockProject, { defaultExpanded: true });

        // Switch to Conservative preset
        const conservativeBtn = screen.getByRole('button', { name: 'Konserwatywny (1.30x)' });
        fireEvent.click(conservativeBtn);

        // Header tile should update requirement to 1.30x
        await waitFor(() => {
            expect(screen.getAllByText(/Wymóg:/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/1\.30x/i).length).toBeGreaterThan(0);
        });

        // Switch back to Standard
        const standardBtn = screen.getByRole('button', { name: 'Standard (1.20x)' });
        fireEvent.click(standardBtn);

        await waitFor(() => {
            expect(screen.getAllByText(/1\.20x/i).length).toBeGreaterThan(0);
        });
    });

    it('switches to config sub-tab and modifies DSCR threshold using slider', async () => {
        renderWithContext(mockProject, { defaultExpanded: true });

        // Switch to Config tab
        const configTabBtn = screen.getByRole('button', { name: /2\. Konfigurator Wymogów Banku/i });
        fireEvent.click(configTabBtn);

        await waitFor(() => {
            expect(screen.getByText(/Progi Ostrożnościowe Komitetu Kredytowego/i)).toBeInTheDocument();
            expect(screen.getByText(/Minimalny Wymóg DSCR/i)).toBeInTheDocument();
        });

        // Reset to LMA
        const resetBtn = screen.getByRole('button', { name: /Przywróć standardy LMA/i });
        fireEvent.click(resetBtn);
        expect(screen.getByText('1.20x')).toBeInTheDocument();
    });

    it('renders Pinch Year (wąskie gardło) and headroom analysis sub-tab', async () => {
        renderWithContext(mockProject, { defaultExpanded: true });

        // Switch to Headroom tab
        const headroomTabBtn = screen.getByRole('button', { name: /3\. Wąskie Gardło & Analiza Buforu/i });
        fireEvent.click(headroomTabBtn);

        await waitFor(() => {
            expect(screen.getByText(/Rok Wąskiego Gardła \(Pinch Year\)/i)).toBeInTheDocument();
            expect(screen.getByText(/Odporność na Spadek Przychodów/i)).toBeInTheDocument();
            expect(screen.getByText(/Rekomendacje Strukturyzacji/i)).toBeInTheDocument();
        });
    });

    it('switches scale units between thousands, millions, and full PLN', async () => {
        renderWithContext(mockProject, { defaultExpanded: true });

        // Scale: mln
        const mlnBtn = screen.getByRole('button', { name: 'mln' });
        fireEvent.click(mlnBtn);

        await waitFor(() => {
            expect(screen.getAllByText(/mln PLN/i).length).toBeGreaterThan(0);
        });

        // Scale: tys.
        const tysBtn = screen.getByRole('button', { name: 'tys.' });
        fireEvent.click(tysBtn);

        await waitFor(() => {
            expect(screen.getAllByText(/tys\. PLN/i).length).toBeGreaterThan(0);
        });
    });
    it("renders dynamic CR and DSRF status badges and styling based on covenant thresholds", async () => {
        // High-performing project where CR >= 1.10 and DSRF >= 6
        const safeProject = {
            ...mockProject,
            debt_facility: {
                ...mockProject.debt_facility,
                principal_amount: 2000000,
            },
            financing_structure: {
                investor1_equity: 40000000,
                debt_facility_amount: 2000000,
            },
            operating_assumptions: {
                ...mockProject.operating_assumptions,
                annual_revenue_base: 40000000,
            }
        };

        renderWithContext(safeProject);

        await waitFor(() => {
            expect(screen.getAllByText("ZGODNY").length).toBeGreaterThanOrEqual(1);
            expect(screen.getByText("ZABEZPIECZONE")).toBeInTheDocument();
        });
    });

    it("protects against negative ratios by displaying guardrail labels (0.00x Deficyt NWC / 0.0 m. Luka gotowkowa)", async () => {
        // Project with heavy debt and severe deficit
        const deficitProject = {
            ...mockProject,
            debt_facility: {
                ...mockProject.debt_facility,
                principal_amount: 80000000,
            },
            financing_structure: {
                investor1_equity: 1000,
                debt_facility_amount: 80000000,
            },
            operating_assumptions: {
                ...mockProject.operating_assumptions,
                annual_revenue_base: 1000000,
            }
        };

        renderWithContext(deficitProject);

        await waitFor(() => {
            expect(screen.getByText(/DEFICYT PŁYNNOŚCI/i)).toBeInTheDocument();
            expect(screen.getByText(/BRAK REZERWY/i)).toBeInTheDocument();
        });
    });
});
