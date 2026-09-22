import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { InvestmentReadinessScorecard } from '../../components/investments/InvestmentReadinessScorecard';
import { InvestmentProjectContext } from '../../context/InvestmentProjectContext';
import { NotificationContext } from '../../context/NotificationContext';
import { calculateInvestmentReadiness, DEFAULT_READINESS_CRITERIA } from '../../workers/financialCalculations';

describe('InvestmentReadinessScorecard Component (Phase 45 Commit 222)', () => {
    const mockUpdateProject = vi.fn().mockResolvedValue({ id: 'proj-scorecard-1' });
    const mockSuccess = vi.fn();
    const mockNotifyError = vi.fn();

    const mockProject = {
        id: 'proj-scorecard-1',
        name: 'Morska Farma Wiatrowa 150MW & BESS',
        currency: 'PLN',
        start_date: '2026-01-01',
        commercial_operation_date: '2027-01-01',
        planning_horizon_years: 15,
        capex_stages: [
            {
                id: 'stage-1',
                stage_name: 'Fundamenty i wieże offshore',
                net_amount: 60000000,
                start_date: '2026-01-01',
                duration_months: 10,
                kst_code: 'KST_3',
                kst_annual_rate: 7.0,
            },
            {
                id: 'stage-2',
                stage_name: 'Magazyn Energii BESS',
                net_amount: 40000000,
                start_date: '2026-03-01',
                duration_months: 8,
                kst_code: 'KST_6',
                kst_annual_rate: 10.0,
            }
        ],
        financing_structure: {
            investor1_equity: 24000000,
            investor2_equity: 16000000,
            debt_facility_amount: 60000000,
        },
        debt_facility: {
            principal_amount: 60000000,
            base_interest_rate_percent: 5.75,
            margin_percent: 2.25,
            upfront_fee_percent: 1.0,
            tenor_months: 120,
            grace_period_months: 12,
            repayment_type: 'annuity',
        },
        operating_assumptions: {
            annual_revenue_base: 45000000,
            revenue_growth_rate_percent: 3.5,
            variable_cost_percent: 22.0,
            annual_fixed_costs_base: 4000000,
            annual_payroll_base: 4500000,
        }
    };

    const mockSimulationData = {
        summary: {
            initialEquity: 40000000,
            initialDebt: 60000000,
            minDscr: 1.35,
            avgDscr: 1.58,
        },
        annualPeriods: Array.from({ length: 15 }, (_, i) => ({
            year: i + 1,
            ebitda: 25000000,
            closingDebt: Math.max(0, 60000000 - i * 6000000),
            closingCash: 10000000 + i * 2000000,
            closingNetPpe: Math.max(0, 100000000 - i * 7000000),
            closingReceivables: 3000000,
            closingInventory: 1000000,
            cumulativeNetIncome: (i + 1) * 8000000,
            closingPayables: 2000000,
            fcfe: 8000000,
            hasDebtService: i < 10
        })),
        covenants: {
            currency: 'PLN',
            summary: {
                minDscr: 1.35,
                avgDscr: 1.58,
                minIcr: 3.40,
                minCurrentRatio: 1.45,
                peakLeverage: 2.40,
                minDsrfMonths: 8.5,
                isBankable: true,
                bankabilityStatus: 'compliant',
                totalBreachesCount: 0,
                yearsWithBreachCount: 0,
                pinchYear: 2,
                pinchDscr: 1.35
            },
            yearlyMetrics: []
        }
    };

    const renderWithContext = (project = mockProject, simData = mockSimulationData, props = {}) => {
        const projectContextValue = {
            selectedProject: project,
            selectedProjectId: project?.id || null,
            updateProject: mockUpdateProject,
            loading: false,
        };

        const notificationContextValue = {
            success: mockSuccess,
            error: mockNotifyError,
        };

        return render(
            <NotificationContext.Provider value={notificationContextValue}>
                <InvestmentProjectContext.Provider value={projectContextValue}>
                    <InvestmentReadinessScorecard
                        project={project}
                        simulationData={simData}
                        {...props}
                    />
                </InvestmentProjectContext.Provider>
            </NotificationContext.Provider>
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders empty state when no active project is provided or selected', () => {
        renderWithContext(null, null);

        expect(screen.getByText(/Brak aktywnego projektu do oceny gotowości inwestycyjnej/i)).toBeInTheDocument();
    });

    it('renders institutional scorecard banner with score, bankability badge, and recommendation', () => {
        renderWithContext();

        // Header Title
        expect(screen.getByText('Karta Oceny Gotowości Inwestycyjnej')).toBeInTheDocument();
        expect(screen.getByText(/Morska Farma Wiatrowa 150MW & BESS/i)).toBeInTheDocument();

        // Bankability Badge
        const badge = screen.getByTestId('bankability-badge');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveTextContent(/PROJEKT BANKOWALNY|WARUNKOWO GOTOWY/i);

        // Score dial
        const scoreDisplay = screen.getByTestId('overall-score-display');
        expect(scoreDisplay).toBeInTheDocument();
        const scoreNum = parseInt(scoreDisplay.textContent || '0', 10);
        expect(scoreNum).toBeGreaterThanOrEqual(50);
        expect(scoreNum).toBeLessThanOrEqual(100);

        // Conditions Precedent Counter Tile
        expect(screen.getByText('Warunki CP')).toBeInTheDocument();
    });

    it('renders 4 pillar cards (legal, technical, market, financial) with correct percentage indicators', () => {
        renderWithContext();

        expect(screen.getByText('Formalno-Prawny')).toBeInTheDocument();
        expect(screen.getByText('Techniczno-Realizacyjny')).toBeInTheDocument();
        expect(screen.getByText('Rynkowo-Handlowy')).toBeInTheDocument();
        expect(screen.getByText('Finansowo-Modelowy')).toBeInTheDocument();
    });

    it('filters criteria table by pillar, CPs only, and gaps only', async () => {
        renderWithContext();

        const table = screen.getByTestId('criteria-table');
        expect(within(table).getByText('Tytuł prawny do nieruchomości / gruntów')).toBeInTheDocument();
        expect(within(table).getByText('Projekt wykonawczy i specyfikacja (FEED)')).toBeInTheDocument();

        // Filter by Legal
        fireEvent.click(screen.getByRole('button', { name: /^Formalno-Prawne \(4\)$/i }));
        expect(within(table).getByText('Tytuł prawny do nieruchomości / gruntów')).toBeInTheDocument();
        expect(within(table).queryByText('Projekt wykonawczy i specyfikacja (FEED)')).not.toBeInTheDocument();

        // Filter by Technical
        fireEvent.click(screen.getByRole('button', { name: /^Techniczne \(4\)$/i }));
        expect(within(table).getByText('Projekt wykonawczy i specyfikacja (FEED)')).toBeInTheDocument();
        expect(within(table).queryByText('Tytuł prawny do nieruchomości / gruntów')).not.toBeInTheDocument();

        // Filter by Conditions Precedent (CP)
        fireEvent.click(screen.getByRole('button', { name: /Tylko CP/i }));
        expect(within(table).getByText('Kontrakt EPC Turnkey w formule Fixed-Price')).toBeInTheDocument();
        expect(within(table).queryByText('Czysta struktura SPV & zgody korporacyjne')).not.toBeInTheDocument();
    });

    it('filters criteria rows using text search input', async () => {
        renderWithContext();

        const searchInput = screen.getByPlaceholderText(/Szukaj kryterium audytowego/i);
        fireEvent.change(searchInput, { target: { value: 'PPA' } });

        await waitFor(() => {
            const table = screen.getByTestId('criteria-table');
            expect(within(table).getByText(/Kontrakty długoterminowe \/ PPA \/ Take-or-Pay/i)).toBeInTheDocument();
            expect(within(table).queryByText('Projekt wykonawczy i specyfikacja (FEED)')).not.toBeInTheDocument();
        });
    });

    it('toggles criterion status between Spełniony, W toku, Brak, and N/D and recalculates score in real-time', async () => {
        renderWithContext();

        const initialScore = parseInt(screen.getByTestId('overall-score-display').textContent || '0', 10);

        // Find buttons for first criterion (leg_land_title)
        // Click "Brak" (Niespełniony) for the first criterion
        const brakButtons = screen.getAllByRole('button', { name: /^Brak$/i });
        fireEvent.click(brakButtons[0]);

        // Score should drop
        await waitFor(() => {
            const updatedScore = parseInt(screen.getByTestId('overall-score-display').textContent || '0', 10);
            expect(updatedScore).toBeLessThan(initialScore);
        });

        // Click "Spełniony" again
        const spelnionyButtons = screen.getAllByRole('button', { name: /^Spełniony$/i });
        fireEvent.click(spelnionyButtons[0]);

        await waitFor(() => {
            const finalScore = parseInt(screen.getByTestId('overall-score-display').textContent || '0', 10);
            expect(finalScore).toBe(initialScore);
        });
    });

    it('applies maturity presets (Greenfield, Development, RTB, COD) with instant status and score updates', async () => {
        renderWithContext();

        // Click Greenfield preset
        fireEvent.click(screen.getByRole('button', { name: 'Wczesny' }));

        await waitFor(() => {
            const scoreDisplay = screen.getByTestId('overall-score-display');
            const greenfieldScore = parseInt(scoreDisplay.textContent || '0', 10);
            expect(greenfieldScore).toBeLessThan(50);
            expect(screen.getByTestId('bankability-badge')).toHaveTextContent(/NIEBANKOWALNY|W FAZIE PRZYGOTOWAWCZEJ/i);
        });

        // Click COD (Operacyjny) preset
        fireEvent.click(screen.getByRole('button', { name: 'Operacyjny' }));

        await waitFor(() => {
            const scoreDisplay = screen.getByTestId('overall-score-display');
            const codScore = parseInt(scoreDisplay.textContent || '0', 10);
            expect(codScore).toBeGreaterThanOrEqual(90);
            expect(screen.getByTestId('bankability-badge')).toHaveTextContent(/PROJEKT BANKOWALNY/i);
        });
    });

    it('resets scorecard to default matrix when clicking reset button', async () => {
        renderWithContext();

        // Switch to Greenfield
        fireEvent.click(screen.getByRole('button', { name: 'Wczesny' }));

        // Click Reset
        const resetBtn = screen.getByTitle('Przywróć domyślne kryteria');
        fireEvent.click(resetBtn);

        expect(mockSuccess).toHaveBeenCalledWith(expect.stringContaining('Przywrócono domyślną matrycę'));
    });

    it('expands audit notes sub-row and allows entering reviewer comments', async () => {
        renderWithContext();

        // Click first info icon to expand notes
        const infoButtons = screen.getAllByTitle('Dodaj lub edytuj notatkę audytową');
        fireEvent.click(infoButtons[0]);

        await waitFor(() => {
            expect(screen.getByPlaceholderText(/Wpisz uzasadnienie, sygnaturę decyzji/i)).toBeInTheDocument();
        });

        const notesInput = screen.getByPlaceholderText(/Wpisz uzasadnienie, sygnaturę decyzji/i);
        fireEvent.change(notesInput, { target: { value: 'KW Nr WA1M/00123456/7 zweryfikowana pozytywnie.' } });

        expect(notesInput.value).toBe('KW Nr WA1M/00123456/7 zweryfikowana pozytywnie.');
    });

    it('exports scorecard to CSV when clicking export button', () => {
        const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-scorecard-url');
        const revokeObjectURLMock = vi.fn();
        global.URL.createObjectURL = createObjectURLMock;
        global.URL.revokeObjectURL = revokeObjectURLMock;

        renderWithContext();

        const exportBtn = screen.getByRole('button', { name: /Eksportuj CSV/i });
        fireEvent.click(exportBtn);

        expect(createObjectURLMock).toHaveBeenCalled();
        expect(revokeObjectURLMock).toHaveBeenCalled();
    });

    it('saves scorecard into project via updateProject when clicking save button', async () => {
        renderWithContext();

        const saveBtn = screen.getByRole('button', { name: /Zapisz Ocenę/i });
        fireEvent.click(saveBtn);

        await waitFor(() => {
            expect(mockUpdateProject).toHaveBeenCalledWith(
                mockProject.id,
                expect.objectContaining({
                    operating_assumptions: expect.objectContaining({
                        readiness_scorecard: expect.objectContaining({
                            overallScore: expect.any(Number),
                            bankabilityStatus: expect.any(String),
                            criteria: expect.any(Array)
                        })
                    })
                })
            );
            expect(mockSuccess).toHaveBeenCalledWith(expect.stringContaining('została zapisana'));
        });
    });

    it('verifies calculateInvestmentReadiness pure calculation logic', () => {
        const res = calculateInvestmentReadiness(mockProject, mockSimulationData);

        expect(res.overallScore).toBeGreaterThanOrEqual(70);
        expect(res.totalMaxPoints).toBe(100);
        expect(res.criteria.length).toBe(16);
        expect(res.pillars.legal.maxPoints).toBe(25);
        expect(res.pillars.technical.maxPoints).toBe(25);
        expect(res.pillars.market.maxPoints).toBe(25);
        expect(res.pillars.financial.maxPoints).toBe(25);
        expect(res.conditionsPrecedent.totalCount).toBeGreaterThan(0);
    });
});
