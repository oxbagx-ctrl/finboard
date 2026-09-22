import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CapexStageModal } from '../../components/investments/CapexStageModal';
import { CapexScheduleManager } from '../../components/investments/CapexScheduleManager';
import { FinancingStructureConfigurator } from '../../components/investments/FinancingStructureConfigurator';
import { OperatingAssumptionsForm } from '../../components/investments/OperatingAssumptionsForm';
import { InvestmentProjectContext } from '../../context/InvestmentProjectContext';
import { NotificationContext } from '../../context/NotificationContext';
import { investmentProjectsApi } from '../../api/investmentProjects';

vi.mock('../../api/investmentProjects', () => ({
    investmentProjectsApi: {
        addCapexStage: vi.fn(),
        updateCapexStage: vi.fn(),
        deleteCapexStage: vi.fn(),
        updateProject: vi.fn(),
    },
}));

describe('Investment State Validation & Edge Cases (Phase 42 Commit 211)', () => {
    const mockSuccess = vi.fn();
    const mockNotifyError = vi.fn();
    const mockLoadProjectDetails = vi.fn();
    const mockRefreshProjects = vi.fn();

    const notificationContextValue = {
        success: mockSuccess,
        error: mockNotifyError,
        info: vi.fn(),
        warning: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('1. CapexStageModal Input & Boundary Validation', () => {
        it('validates required stage name and blocks submission when empty', () => {
            const handleSubmit = vi.fn();
            render(
                <CapexStageModal
                    isOpen={true}
                    onClose={vi.fn()}
                    onSubmit={handleSubmit}
                    projectCurrency="PLN"
                />
            );

            const submitBtn = screen.getByRole('button', { name: /Dodaj Etap/i });
            fireEvent.click(submitBtn);

            expect(screen.getByText(/Nazwa etapu jest wymagana/i)).toBeInTheDocument();
            expect(handleSubmit).not.toHaveBeenCalled();
        });

        it('validates that net amount must be strictly greater than zero', () => {
            const handleSubmit = vi.fn();
            render(
                <CapexStageModal
                    isOpen={true}
                    onClose={vi.fn()}
                    onSubmit={handleSubmit}
                    projectCurrency="PLN"
                />
            );

            // Set valid name
            const nameInput = screen.getByLabelText(/Nazwa Etapu/i);
            fireEvent.change(nameInput, { target: { value: 'Projekt Budowlany' } });

            // Set zero or negative amount
            const netInput = screen.getByLabelText(/Kwota Netto/i);
            fireEvent.change(netInput, { target: { value: '0' } });

            const submitBtn = screen.getByRole('button', { name: /Dodaj Etap/i });
            fireEvent.click(submitBtn);

            expect(screen.getByText(/Kwota nakładów netto musi być większa od zera/i)).toBeInTheDocument();
            expect(handleSubmit).not.toHaveBeenCalled();

            // Set negative amount
            fireEvent.change(netInput, { target: { value: '-50000' } });
            fireEvent.click(submitBtn);
            expect(screen.getByText(/Kwota nakładów netto musi być większa od zera/i)).toBeInTheDocument();
            expect(handleSubmit).not.toHaveBeenCalled();
        });

        it('validates that duration must be between 1 and 120 months', () => {
            const handleSubmit = vi.fn();
            render(
                <CapexStageModal
                    isOpen={true}
                    onClose={vi.fn()}
                    onSubmit={handleSubmit}
                    projectCurrency="PLN"
                />
            );

            const nameInput = screen.getByLabelText(/Nazwa Etapu/i);
            fireEvent.change(nameInput, { target: { value: 'Infrastruktura Dostępowa' } });

            const netInput = screen.getByLabelText(/Kwota Netto/i);
            fireEvent.change(netInput, { target: { value: '2500000' } });

            const durationInput = screen.getByLabelText(/Czas Trwania/i);
            fireEvent.change(durationInput, { target: { value: '0' } });

            const submitBtn = screen.getByRole('button', { name: /Dodaj Etap/i });
            fireEvent.click(submitBtn);

            expect(screen.getByText(/Czas trwania etapu musi wynosić od 1 do 120 miesięcy/i)).toBeInTheDocument();
            expect(handleSubmit).not.toHaveBeenCalled();

            // Set > 120 months
            fireEvent.change(durationInput, { target: { value: '150' } });
            fireEvent.click(submitBtn);
            expect(screen.getByText(/Czas trwania etapu musi wynosić od 1 do 120 miesięcy/i)).toBeInTheDocument();
            expect(handleSubmit).not.toHaveBeenCalled();
        });

        it('validates that grant eligible amount cannot exceed net amount', () => {
            const handleSubmit = vi.fn();
            render(
                <CapexStageModal
                    isOpen={true}
                    onClose={vi.fn()}
                    onSubmit={handleSubmit}
                    projectCurrency="PLN"
                />
            );

            const nameInput = screen.getByLabelText(/Nazwa Etapu/i);
            fireEvent.change(nameInput, { target: { value: 'Instalacja BESS' } });

            const netInput = screen.getByLabelText(/Kwota Netto/i);
            fireEvent.change(netInput, { target: { value: '1000000' } });

            // Toggle grant eligible
            const grantCheckbox = screen.getByLabelText(/Wydatki Kwalifikowane/i);
            fireEvent.click(grantCheckbox);

            // Set eligible amount greater than net amount
            const eligibleInput = screen.getByLabelText(/Kwota Wydatków Kwalifikowanych/i);
            fireEvent.change(eligibleInput, { target: { value: '1500000' } });

            const submitBtn = screen.getByRole('button', { name: /Dodaj Etap/i });
            fireEvent.click(submitBtn);

            expect(screen.getByText(/Kwota kwalifikowana nie może przekraczać kwoty netto etapu/i)).toBeInTheDocument();
            expect(handleSubmit).not.toHaveBeenCalled();
        });
    });

    describe('2. CapexScheduleManager Calculations & API Error Handling', () => {
        const projectWithMixedKst = {
            id: 'proj-kst-test',
            name: 'Kompleks Przemysłowy OZE',
            currency: 'PLN',
            capex_stages: [
                {
                    id: 'stage-0',
                    stage_name: 'Zakup gruntów rolnych',
                    net_amount: '5000000.00',
                    currency: 'PLN',
                    kst_code: 'KST_0',
                    kst_annual_rate: 0.0,
                    order_index: 1,
                    start_date: '2026-06-01',
                    duration_months: 6,
                },
                {
                    id: 'stage-it',
                    stage_name: 'Serwery SCADA i sensory IoT',
                    net_amount: '5000000.00',
                    currency: 'PLN',
                    kst_code: 'KST_IT',
                    kst_annual_rate: 30.0,
                    order_index: 2,
                    start_date: '2026-12-01',
                    duration_months: 6,
                },
            ],
        };

        it('calculates weighted KŚT rate accurately for mixed asset classes', () => {
            const contextValue = {
                selectedProject: projectWithMixedKst,
                loadProjectDetails: mockLoadProjectDetails,
                refreshProjects: mockRefreshProjects,
            };

            render(
                <NotificationContext.Provider value={notificationContextValue}>
                    <InvestmentProjectContext.Provider value={contextValue}>
                        <CapexScheduleManager />
                    </InvestmentProjectContext.Provider>
                </NotificationContext.Provider>
            );

            // Total net capex = 5M + 5M = 10M PLN
            expect(screen.getAllByText(/10.*000.*000,00/i).length).toBeGreaterThanOrEqual(1);

            // Weighted rate: (5M * 0.0% + 5M * 30.0%) / 10M = 15.00%
            expect(screen.getByText(/15\.00%/i)).toBeInTheDocument();
        });

        it('handles API error gracefully when adding stage fails', async () => {
            investmentProjectsApi.addCapexStage.mockRejectedValueOnce({
                response: { data: { message: 'Błąd walidacji danych w backendzie.' } },
            });

            const contextValue = {
                selectedProject: projectWithMixedKst,
                loadProjectDetails: mockLoadProjectDetails,
                refreshProjects: mockRefreshProjects,
            };

            render(
                <NotificationContext.Provider value={notificationContextValue}>
                    <InvestmentProjectContext.Provider value={contextValue}>
                        <CapexScheduleManager />
                    </InvestmentProjectContext.Provider>
                </NotificationContext.Provider>
            );

            // Open modal
            const addBtn = screen.getByRole('button', { name: /Dodaj Etap CAPEX/i });
            fireEvent.click(addBtn);

            // Fill valid fields
            const nameInput = screen.getByLabelText(/Nazwa Etapu/i);
            fireEvent.change(nameInput, { target: { value: 'Etap Testowy' } });

            const netInput = screen.getByLabelText(/Kwota Netto/i);
            fireEvent.change(netInput, { target: { value: '1000000' } });

            const submitBtn = screen.getByRole('button', { name: /Dodaj Etap$/i });
            fireEvent.click(submitBtn);

            await waitFor(() => {
                expect(investmentProjectsApi.addCapexStage).toHaveBeenCalledTimes(1);
                expect(mockNotifyError).toHaveBeenCalledWith('Błąd walidacji danych w backendzie.');
            });
        });
    });

    describe('3. FinancingStructureConfigurator Boundary & Formula Validation', () => {
        const projectZeroCapex = {
            id: 'proj-zero-capex',
            name: 'Projekt bez etapów CAPEX',
            currency: 'PLN',
            capex_stages: [],
            financing_structure: {
                equity_contribution: 0,
                bank_loan_amount: 0,
                grant_amount: 0,
            },
            debt_facilities: [],
        };

        it('handles zero-capex projects gracefully without NaN or division by zero errors', () => {
            const contextValue = {
                selectedProject: projectZeroCapex,
                loadProjectDetails: mockLoadProjectDetails,
            };

            render(
                <InvestmentProjectContext.Provider value={contextValue}>
                    <FinancingStructureConfigurator />
                </InvestmentProjectContext.Provider>
            );

            expect(screen.getByText(/Montaż Finansowy & Struktura Długu/i)).toBeInTheDocument();
            // Displays 0,00 PLN without crashing
            expect(screen.getAllByText(/0,00/i).length).toBeGreaterThanOrEqual(1);
            // 0% balance badge
            expect(screen.getByText(/Finansowanie w pełni zbilansowane \(100%\)/i)).toBeInTheDocument();
        });

        it('clamps negative inputs to 0 on equity input change', () => {
            const contextValue = {
                selectedProject: projectZeroCapex,
                loadProjectDetails: mockLoadProjectDetails,
            };

            render(
                <InvestmentProjectContext.Provider value={contextValue}>
                    <FinancingStructureConfigurator />
                </InvestmentProjectContext.Provider>
            );

            const equityInput = screen.getByLabelText(/Kwota Wkładu Własnego/i);
            fireEvent.change(equityInput, { target: { value: '-50000' } });

            // Value is clamped to 0
            expect(equityInput.value).toBe('0');
        });

        it('reverts local changes when clicking Reset button', () => {
            const projectWithFinancing = {
                ...projectZeroCapex,
                capex_stages: [{ id: 's1', net_amount: '10000000.00' }],
                financing_structure: {
                    equity_contribution: 3000000,
                    bank_loan_amount: 7000000,
                    grant_amount: 0,
                },
            };

            const contextValue = {
                selectedProject: projectWithFinancing,
                loadProjectDetails: mockLoadProjectDetails,
            };

            render(
                <InvestmentProjectContext.Provider value={contextValue}>
                    <FinancingStructureConfigurator />
                </InvestmentProjectContext.Provider>
            );

            const equityInput = screen.getByLabelText(/Kwota Wkładu Własnego/i);
            expect(equityInput.value).toBe('3000000');

            // Change equity input
            fireEvent.change(equityInput, { target: { value: '5000000' } });
            expect(equityInput.value).toBe('5000000');

            // Click Reset
            const resetBtn = screen.getByRole('button', { name: /Resetuj/i });
            fireEvent.click(resetBtn);

            // Expect back to 3000000
            expect(equityInput.value).toBe('3000000');
        });

        it('displays error message banner when saving financing structure fails', async () => {
            investmentProjectsApi.updateProject.mockRejectedValueOnce({
                response: { data: { message: 'Kredyt przekracza dopuszczalny limit LTV.' } },
            });

            const contextValue = {
                selectedProject: projectZeroCapex,
                loadProjectDetails: mockLoadProjectDetails,
            };

            render(
                <InvestmentProjectContext.Provider value={contextValue}>
                    <FinancingStructureConfigurator />
                </InvestmentProjectContext.Provider>
            );

            const saveBtn = screen.getByRole('button', { name: /Zapisz Montaż Finansowy/i });
            fireEvent.click(saveBtn);

            await waitFor(() => {
                expect(screen.getByText(/Kredyt przekracza dopuszczalny limit LTV/i)).toBeInTheDocument();
            });
        });
    });

    describe('4. OperatingAssumptionsForm State & Logic Validation', () => {
        const standardProject = {
            id: 'proj-op-test',
            name: 'Projekt Operacyjny OZE',
            currency: 'PLN',
            operating_assumptions: {
                annual_revenue_base: 1000000,
                variable_cost_percent: 40.0,
                annual_fixed_costs_base: 200000,
                annual_payroll_base: 250000,
                revenue_lines: [
                    { id: 'rev-single', name: 'Główna linia sprzedaży', unit: 'szt.', volume: 1000, price: 1000, total: 1000000 },
                ],
                headcount_matrix: [
                    { id: 'hc-single', role: 'Dyrektor Operacyjny', fte: 1, grossSalary: 15000, employerCostRate: 20.48, annualCost: 216864 },
                ],
                dso: 15,
                dpo: 60,
                dio: 5,
            },
        };

        it('disables delete button when only single revenue line remains', () => {
            const contextValue = {
                selectedProject: standardProject,
                loadProjectDetails: mockLoadProjectDetails,
            };

            render(
                <InvestmentProjectContext.Provider value={contextValue}>
                    <OperatingAssumptionsForm />
                </InvestmentProjectContext.Provider>
            );

            const deleteButtons = screen.getAllByLabelText(/Usuń linię/i);
            expect(deleteButtons.length).toBe(1);
            expect(deleteButtons[0]).toBeDisabled();
        });

        it('disables delete button when only single headcount role remains', () => {
            const contextValue = {
                selectedProject: standardProject,
                loadProjectDetails: mockLoadProjectDetails,
            };

            render(
                <InvestmentProjectContext.Provider value={contextValue}>
                    <OperatingAssumptionsForm />
                </InvestmentProjectContext.Provider>
            );

            const payrollTab = screen.getByRole('button', { name: /4\. Matryca Etatów/i });
            fireEvent.click(payrollTab);

            const deleteRoleButtons = screen.getAllByLabelText(/Usuń stanowisko/i);
            expect(deleteRoleButtons.length).toBe(1);
            expect(deleteRoleButtons[0]).toBeDisabled();
        });

        it('calculates negative cash conversion cycle (CCC) correctly when DPO exceeds DSO + DIO', () => {
            const contextValue = {
                selectedProject: standardProject,
                loadProjectDetails: mockLoadProjectDetails,
            };

            render(
                <InvestmentProjectContext.Provider value={contextValue}>
                    <OperatingAssumptionsForm />
                </InvestmentProjectContext.Provider>
            );

            // DSO = 15, DPO = 60, DIO = 5 -> CCC = 5 + 15 - 60 = -40 dni
            expect(screen.getAllByText(/-40 dni/i).length).toBeGreaterThanOrEqual(1);
        });

        it('disables tax loss offset cap slider when carry-forward is toggled off', () => {
            const contextValue = {
                selectedProject: standardProject,
                loadProjectDetails: mockLoadProjectDetails,
            };

            render(
                <InvestmentProjectContext.Provider value={contextValue}>
                    <OperatingAssumptionsForm />
                </InvestmentProjectContext.Provider>
            );

            const taxesTab = screen.getByRole('button', { name: /5\. Podatki & CIT/i });
            fireEvent.click(taxesTab);

            const checkbox = screen.getByRole('checkbox');
            expect(checkbox).toBeChecked();

            // Toggle off
            fireEvent.click(checkbox);
            expect(checkbox).not.toBeChecked();

            // Range slider should now be disabled
            const capSlider = screen.getByRole('slider');
            expect(capSlider).toBeDisabled();
        });

        it('displays error message banner when saving operating assumptions fails', async () => {
            investmentProjectsApi.updateProject.mockRejectedValueOnce({
                response: { data: { message: 'Niepoprawne parametry w matrycy płac.' } },
            });

            const contextValue = {
                selectedProject: standardProject,
                loadProjectDetails: mockLoadProjectDetails,
            };

            render(
                <InvestmentProjectContext.Provider value={contextValue}>
                    <OperatingAssumptionsForm />
                </InvestmentProjectContext.Provider>
            );

            const saveBtn = screen.getByRole('button', { name: /Zapisz Założenia Operacyjne/i });
            fireEvent.click(saveBtn);

            await waitFor(() => {
                expect(screen.getByText(/Niepoprawne parametry w matrycy płac/i)).toBeInTheDocument();
            });
        });
    });
});
