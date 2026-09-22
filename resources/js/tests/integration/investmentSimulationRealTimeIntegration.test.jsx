import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SensitivityCockpitView } from '../../components/investments/SensitivityCockpitView';
import { InvestmentProjectContext } from '../../context/InvestmentProjectContext';
import { NotificationContext } from '../../context/NotificationContext';
import { InvestmentWorkerClient } from '../../workers/InvestmentWorkerClient';
import { runSimulation } from '../../workers/financialCalculations';

// Mock Recharts ResponsiveContainer to avoid size observer issues in test DOM
vi.mock('recharts', async () => {
    const actual = await vi.importActual('recharts');
    return {
        ...actual,
        ResponsiveContainer: ({ children }) => (
            <div data-testid="responsive-container" style={{ width: '800px', height: '320px' }}>
                {children}
            </div>
        ),
    };
});

describe('Web Worker Communication & Real-Time KPI Reactivity Integration (Phase 43 Commit 216)', () => {
    const mockNotify = vi.fn();
    const mockNotifyError = vi.fn();

    const notificationContextValue = {
        notify: mockNotify,
        notifyError: mockNotifyError,
        notifications: [],
    };

    const mockProject = {
        id: 'proj-pv-farm-100mw',
        name: 'Farma Fotowoltaiczna 100MWp & BESS',
        currency: 'PLN',
        start_date: '2026-01-01',
        commercial_operation_date: '2027-01-01',
        planning_horizon_years: 15,
        capex_stages: [
            {
                id: 'stage-civil',
                stage_name: 'Konstrukcje i roboty ziemne',
                net_amount: 25000000,
                start_date: '2026-01-01',
                duration_months: 6,
                kst_code: 'KST_2',
                kst_annual_rate: 4.5,
            },
            {
                id: 'stage-modules',
                stage_name: 'Moduły TOPCon i falowniki stringowe',
                net_amount: 35000000,
                start_date: '2026-04-01',
                duration_months: 8,
                kst_code: 'KST_6',
                kst_annual_rate: 10.0,
            },
        ],
        debt_facility: {
            principal_amount: 36000000, // 60% LTV
            base_interest_rate_percent: 5.75,
            margin_percent: 2.25, // 8.00% total
            upfront_fee_percent: 1.0,
            tenor_months: 120,
            grace_period_months: 12,
            repayment_type: 'annuity',
        },
        financing_structure: {
            investor1_equity: 24000000,
            debt_facility_amount: 36000000,
        },
        operating_assumptions: {
            annual_revenue_base: 24000000,
            revenue_growth_rate_percent: 2.5,
            variable_cost_percent: 30.0,
            annual_fixed_costs_base: 2500000,
            fixed_cost_growth_rate_percent: 2.5,
            annual_payroll_base: 3000000,
            payroll_growth_rate_percent: 4.0,
            capacity_ramp_up: {
                year1_percent: 85.0,
                year2_percent: 95.0,
                year3_percent: 100.0,
            },
            cit_rate_percent: 19.0,
            tax_loss_carry_forward_enabled: true,
            tax_loss_offset_cap_percent: 50.0,
            dso: 35,
            dpo: 30,
            dio: 20,
            reinvestment_programs: [
                {
                    id: 'reinvest-inv',
                    name: 'Wymiana Falowników & Optymalizatorów',
                    interval_years: 7,
                    first_occurrence_year: 7,
                    capex_amount: 4500000,
                    kst_code: 'KST_6',
                    kst_annual_rate: 10.0,
                    is_mandatory: true,
                },
                {
                    id: 'reinvest-storage',
                    name: 'Modernizacja Ogniw BESS',
                    interval_years: 5,
                    first_occurrence_year: 5,
                    capex_amount: 3000000,
                    kst_code: 'KST_3',
                    kst_annual_rate: 7.0,
                    is_mandatory: false,
                },
            ],
        },
        wacc_parameters: {
            risk_free_rate_percent: 5.50,
            equity_risk_premium_percent: 6.00,
            levered_beta: 1.15,
            cost_of_equity_percent: 12.40,
            target_debt_ratio_percent: 60.0,
        },
        valuation_multiple: {
            multiple: 8.0,
            multiple_type: 'ev_ebitda',
        },
    };

    const renderWithContext = (project = mockProject) => {
        const contextValue = {
            selectedProject: project,
            selectedProjectId: project?.id || null,
            loading: false,
        };

        return render(
            <NotificationContext.Provider value={notificationContextValue}>
                <InvestmentProjectContext.Provider value={contextValue}>
                    <SensitivityCockpitView />
                </InvestmentProjectContext.Provider>
            </NotificationContext.Provider>
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('1. Web Worker Communication Protocol & Client Lifecycle', () => {
        let originalWorker;

        beforeEach(() => {
            originalWorker = global.Worker;
        });

        afterEach(() => {
            global.Worker = originalWorker;
        });

        it('dispatches CALCULATE_SIMULATION message with correlation ID and resolves simulation result', async () => {
            class MockWorker {
                constructor() {
                    this.onmessage = null;
                    this.onerror = null;
                    this.terminated = false;
                }

                postMessage(message) {
                    const { type, requestId, payload } = message;
                    expect(type).toBe('CALCULATE_SIMULATION');
                    expect(requestId).toBe(1);
                    expect(payload.horizonYears).toBe(15);

                    const simResult = runSimulation(
                        payload.project,
                        payload.assumptions,
                        payload.overrides,
                        payload.horizonYears
                    );

                    setTimeout(() => {
                        if (this.onmessage) {
                            this.onmessage({
                                data: {
                                    type: 'SIMULATION_SUCCESS',
                                    requestId,
                                    data: simResult,
                                    executionTimeMs: 3.5,
                                },
                            });
                        }
                    }, 5);
                }

                terminate() {
                    this.terminated = true;
                }
            }

            global.Worker = MockWorker;

            const client = new InvestmentWorkerClient();
            expect(client.isSupported).toBe(true);

            const result = await client.simulate(mockProject, null, { capexMultiplier: 1.10 });
            expect(result).toBeDefined();
            expect(result.summary).toBeDefined();
            expect(result.summary.projectNpv).toBeDefined();
            expect(result.summary.projectIrrPercent).toBeDefined();
            expect(result.summary.minDscr).toBeDefined();
            expect(result.executionTimeMs).toBe(3.5);

            client.terminate();
        });

        it('correctly demultiplexes concurrent simulation requests with distinct correlation IDs without race conditions', async () => {
            class MockMultiplexingWorker {
                constructor() {
                    this.onmessage = null;
                }

                postMessage(message) {
                    const { type, requestId, payload } = message;
                    // Simulate out-of-order execution times (req 2 finishes faster than req 1)
                    const delay = requestId === 1 ? 25 : 5;

                    setTimeout(() => {
                        const simResult = runSimulation(
                            payload.project,
                            payload.assumptions,
                            payload.overrides,
                            payload.horizonYears
                        );

                        if (this.onmessage) {
                            this.onmessage({
                                data: {
                                    type: 'SIMULATION_SUCCESS',
                                    requestId,
                                    data: simResult,
                                    executionTimeMs: delay,
                                },
                            });
                        }
                    }, delay);
                }

                terminate() {}
            }

            global.Worker = MockMultiplexingWorker;

            const client = new InvestmentWorkerClient();

            // Dispatch two concurrent simulations with different overrides
            const req1Promise = client.simulate(mockProject, null, { capexMultiplier: 1.20 });
            const req2Promise = client.simulate(mockProject, null, { capexMultiplier: 0.90 });

            const [res1, res2] = await Promise.all([req1Promise, req2Promise]);

            expect(res1.summary.initialCapex).toBe(Math.round(60000000 * 1.20));
            expect(res2.summary.initialCapex).toBe(Math.round(60000000 * 0.90));
            expect(res1.summary.projectNpv).toBeLessThan(res2.summary.projectNpv);

            client.terminate();
        });

        it('handles SIMULATION_ERROR and rejects the promise with descriptive worker error', async () => {
            class MockFailingWorker {
                constructor() {
                    this.onmessage = null;
                }

                postMessage(message) {
                    const { requestId } = message;
                    setTimeout(() => {
                        if (this.onmessage) {
                            this.onmessage({
                                data: {
                                    type: 'SIMULATION_ERROR',
                                    requestId,
                                    error: 'Krytyczny błąd alokacji pamięci w silniku symulacji.',
                                },
                            });
                        }
                    }, 5);
                }

                terminate() {}
            }

            global.Worker = MockFailingWorker;

            const client = new InvestmentWorkerClient();

            await expect(client.simulate(mockProject)).rejects.toThrow(
                'Krytyczny błąd alokacji pamięci w silniku symulacji.'
            );

            client.terminate();
        });

        it('handles worker.onerror crash by rejecting all inflight pending requests', async () => {
            let capturedWorkerInstance;

            class MockCrashingWorker {
                constructor() {
                    this.onmessage = null;
                    this.onerror = null;
                    capturedWorkerInstance = this;
                }

                postMessage() {
                    // Do not reply immediately; will trigger onerror manually
                }

                terminate() {}
            }

            global.Worker = MockCrashingWorker;

            const client = new InvestmentWorkerClient();
            const pendingReq = client.simulate(mockProject);

            // Trigger worker level fatal crash
            act(() => {
                capturedWorkerInstance.onerror(new Error('Fatal Web Worker thread termination (OOM)'));
            });

            await expect(pendingReq).rejects.toThrow('Fatal Web Worker thread termination (OOM)');
            expect(client.pendingRequests.size).toBe(0);

            client.terminate();
        });

        it('falls back gracefully to synchronous execution when Worker is undefined in browser environment', async () => {
            // Simulate older browser or environment where Worker is undefined
            delete global.Worker;

            const client = new InvestmentWorkerClient();
            expect(client.isSupported).toBe(false);
            expect(client.worker).toBeNull();

            // simulate() should execute synchronously and return standard result
            const result = await client.simulate(mockProject, null, { revenueMultiplier: 1.10 });
            expect(result).toBeDefined();
            expect(result.summary.projectNpv).toBeGreaterThan(0);
            expect(result.annualPeriods.length).toBe(15);
        });

        it('discards stale response messages without errors when requestId is unknown or already resolved', () => {
            class MockStaleWorker {
                constructor() {
                    this.onmessage = null;
                }

                postMessage() {}
                terminate() {}
            }

            global.Worker = MockStaleWorker;

            const client = new InvestmentWorkerClient();
            const workerInstance = client.worker;

            // Trigger onmessage with non-existent requestId
            expect(() => {
                workerInstance.onmessage({
                    data: {
                        type: 'SIMULATION_SUCCESS',
                        requestId: 9999,
                        data: {},
                    },
                });
            }).not.toThrow();

            client.terminate();
        });
    });

    describe('2. Real-Time Sensitivity Cockpit Reactive UI Integration', () => {
        it('renders live cockpit with 15-year baseline KPIs, chart, and worker telemetry', async () => {
            renderWithContext();

            // Telemetry & Header
            expect(screen.getByText('Cockpit Analizy Wrażliwości & Symulator What-If')).toBeInTheDocument();
            expect(screen.getByText('REAL-TIME')).toBeInTheDocument();
            expect(screen.getByText('Worker:')).toBeInTheDocument();

            // Core KPI cards
            await waitFor(() => {
                expect(screen.getByText('PROJECT NPV')).toBeInTheDocument();
                expect(screen.getByText('PROJECT IRR')).toBeInTheDocument();
                expect(screen.getByText('EQUITY MoIC')).toBeInTheDocument();
                expect(screen.getByText('OKRES ZWROTU')).toBeInTheDocument();
                expect(screen.getByText('KOWENANT DSCR')).toBeInTheDocument();
            });

            // Sliders rendered
            expect(screen.getByText('Nakłady CAPEX')).toBeInTheDocument();
            expect(screen.getByText('Przychody ze Sprzedaży')).toBeInTheDocument();
            expect(screen.getByText('Koszty Zmienne (% Rev)')).toBeInTheDocument();
            expect(screen.getByText('Koszty Stałe OPEX')).toBeInTheDocument();
            expect(screen.getByText('Fundusz Płac & Płace')).toBeInTheDocument();
            expect(screen.getByText('Stopa Dyskontowa WACC')).toBeInTheDocument();

            // Comparison matrix table
            expect(screen.getByText('Macierz Porównawcza Wpływu Wrażliwości (Base Case vs What-If)')).toBeInTheDocument();
            expect(screen.getByText('Łączne Nakłady CAPEX')).toBeInTheDocument();
            expect(screen.getByText('Suma Przychodów (15 Lat)')).toBeInTheDocument();
            expect(screen.getByText('Wskaźnik Pokrycia Obsługi Długu (DSCR)')).toBeInTheDocument();
        });

        it('recalculates model and updates KPI badges and variance chips upon CAPEX slider change (+20%)', async () => {
            renderWithContext();

            await waitFor(() => {
                expect(screen.getByText('PROJECT NPV')).toBeInTheDocument();
            });

            const sliders = screen.getAllByRole('slider');
            const capexSlider = sliders[0]; // First slider is CAPEX

            fireEvent.change(capexSlider, { target: { value: '20' } });

            await waitFor(() => {
                expect(screen.getAllByText('+20%').length).toBeGreaterThanOrEqual(1);
                expect(screen.getByText('PRZEKROCZENIE')).toBeInTheDocument();
            });
        });

        it('triggers bank covenant breach warning (RISK) when revenue is decreased by -15%', async () => {
            renderWithContext();

            await waitFor(() => {
                expect(screen.getByText('KOWENANT DSCR')).toBeInTheDocument();
            });

            const sliders = screen.getAllByRole('slider');
            const revenueSlider = sliders[1]; // Second slider is Revenue

            // Drop revenue by -15%
            fireEvent.change(revenueSlider, { target: { value: '-15' } });

            await waitFor(() => {
                expect(screen.getAllByText('-15%').length).toBeGreaterThanOrEqual(1);
                // DSCR badge should show RISK (< 1.2x)
                expect(screen.getAllByText(/RISK \(< 1\.2x\)/i).length).toBeGreaterThanOrEqual(1);
            });
        });
    });

    describe('3. Institutional Scenario Presets & Debt Repayment Mode Switching', () => {
        it('applies Optimistic Bull Case preset and achieves BANKABLE status', async () => {
            renderWithContext();

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /Optymistyczny/i })).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: /Optymistyczny/i }));

            await waitFor(() => {
                // Optimistic parameters: -5% CAPEX, +15% Rev, -5% VarCost, +2% Payroll
                expect(screen.getAllByText('+15%').length).toBeGreaterThanOrEqual(1);
                expect(screen.getAllByText('-5%').length).toBeGreaterThanOrEqual(1);
                expect(screen.getAllByText(/BANKABLE/i).length).toBeGreaterThanOrEqual(1);
            });
        });

        it('applies Bank Stress-Test Bear Case and flags severe negative variances', async () => {
            renderWithContext();

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /Stres-Test Bankowy/i })).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: /Stres-Test Bankowy/i }));

            await waitFor(() => {
                // Bear Case: +20% CAPEX, -15% Rev, +10% VarCost, +10% FixedCost, +8% Payroll
                expect(screen.getAllByText('+20%').length).toBeGreaterThanOrEqual(1);
                expect(screen.getAllByText('-15%').length).toBeGreaterThanOrEqual(1);
                expect(screen.getAllByText('+8%').length).toBeGreaterThanOrEqual(1);
                expect(screen.getAllByText(/RISK \(< 1\.2x\)/i).length).toBeGreaterThanOrEqual(1);
            });
        });

        it('applies Stagflation & Macro Shock preset with WACC discount rate increase', async () => {
            renderWithContext();

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /Stagflacja/i })).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: /Stagflacja/i }));

            await waitFor(() => {
                // Stagflation: -10% Rev, +20% VarCost, +15% FixedCost, +12% Payroll, WACC +2 p.p.
                expect(screen.getAllByText('-10%').length).toBeGreaterThanOrEqual(1);
                expect(screen.getAllByText('+20%').length).toBeGreaterThanOrEqual(1);
                expect(screen.getAllByText('+15%').length).toBeGreaterThanOrEqual(1);
                expect(screen.getAllByText('+12%').length).toBeGreaterThanOrEqual(1);
                expect(screen.getByText(/WACC \+2/i)).toBeInTheDocument();
            });
        });

        it('transitions preset state to "Własny (Manualny)" when user touches a slider after choosing a preset', async () => {
            renderWithContext();

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /Optymistyczny/i })).toBeInTheDocument();
            });

            // Select Optimistic
            fireEvent.click(screen.getByRole('button', { name: /Optymistyczny/i }));

            await waitFor(() => {
                expect(screen.getAllByText('+15%').length).toBeGreaterThanOrEqual(1);
            });

            // User manually adjusts revenue slider to +25%
            const sliders = screen.getAllByRole('slider');
            fireEvent.change(sliders[1], { target: { value: '25' } });

            await waitFor(() => {
                expect(screen.getByText(/Własny \(Manualny\)/i)).toBeInTheDocument();
            });
        });

        it('resets all parameters to Base Case when clicking "Przywróć Bazę"', async () => {
            renderWithContext();

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /Przywróć Bazę/i })).toBeInTheDocument();
            });

            // Apply Bear Case
            fireEvent.click(screen.getByRole('button', { name: /Stres-Test Bankowy/i }));

            await waitFor(() => {
                expect(screen.getAllByText('+20%').length).toBeGreaterThanOrEqual(1);
                expect(screen.getByText('PRZEKROCZENIE')).toBeInTheDocument();
            });

            // Reset
            fireEvent.click(screen.getByRole('button', { name: /Przywróć Bazę/i }));

            await waitFor(() => {
                expect(screen.getAllByText('0%').length).toBeGreaterThanOrEqual(1);
                expect(screen.queryByText('PRZEKROCZENIE')).not.toBeInTheDocument();
            });
        });

        it('switches debt repayment structure to Linear and Bullet modes updating interest and covenant KPIs', async () => {
            renderWithContext();

            await waitFor(() => {
                expect(screen.getByText('Raty Równe (Annuity)')).toBeInTheDocument();
                expect(screen.getByText('Raty Malejące (Linear)')).toBeInTheDocument();
                expect(screen.getByText('Spłata Balonowa (Bullet)')).toBeInTheDocument();
            });

            // 1. Switch to Linear mode
            fireEvent.click(screen.getByText('Raty Malejące (Linear)'));

            await waitFor(() => {
                expect(screen.getAllByText('LINEAR').length).toBeGreaterThanOrEqual(1);
                expect(screen.getAllByText('SYMULACJA ALTERNATYWNA').length).toBeGreaterThanOrEqual(1);
            });

            // 2. Switch to Bullet mode
            fireEvent.click(screen.getByText('Spłata Balonowa (Bullet)'));

            await waitFor(() => {
                expect(screen.getAllByText('BULLET').length).toBeGreaterThanOrEqual(1);
            });

            // 3. Switch back to Base Contract mode (Annuity)
            fireEvent.click(screen.getByText('Raty Równe (Annuity)'));

            await waitFor(() => {
                expect(screen.getByText('[PROFIL Z UMOWY]')).toBeInTheDocument();
            });
        });
    });

    describe('4. Cyclical Reinvestment Dynamics & Performance Latency Benchmark', () => {
        it('incorporates reinvestment programs in 15-year capex and allows toggling details', async () => {
            renderWithContext();

            await waitFor(() => {
                expect(screen.getByText('Reinvestment A, B, C')).toBeInTheDocument();
                expect(screen.getByText('Konfiguruj A, B, C')).toBeInTheDocument();
            });

            // Expand Reinvestment Manager
            fireEvent.click(screen.getByText('Konfiguruj A, B, C'));

            await waitFor(() => {
                expect(screen.getByText('Harmonogram Nakładów Odtworzeniowych (Reinvestment CAPEX)')).toBeInTheDocument();
                expect(screen.getByText('Program A: Elektronika, SCADA i Falowniki')).toBeInTheDocument();
                expect(screen.getByText('Program B: Remont Kapitalny Maszyn i Ciągów')).toBeInTheDocument();
                expect(screen.getByText('Program C: Tabor i Osprzęt Pomocniczy')).toBeInTheDocument();
            });
        });

        it('completes full 15-year 180-month multi-statement simulation within performance budget (< 25ms)', () => {
            const start = performance.now();

            const result = runSimulation(
                mockProject,
                mockProject.operating_assumptions,
                {
                    capexMultiplier: 1.15,
                    revenueMultiplier: 0.90,
                    variableCostMultiplier: 1.05,
                    fixedCostMultiplier: 1.05,
                    payrollMultiplier: 1.08,
                    repaymentTypeOverride: 'linear',
                    reinvestmentMultiplier: 1.25,
                },
                15
            );

            const durationMs = performance.now() - start;

            expect(result).toBeDefined();
            expect(result.annualPeriods.length).toBe(15);
            expect(result.summary.projectNpv).toBeDefined();
            expect(result.summary.projectIrrPercent).toBeDefined();
            expect(result.summary.totalInterest15Y).toBeDefined();

            // Project Finance institutional latency requirement: under 25ms for 15-year model
            expect(durationMs).toBeLessThan(25);
        });
    });
});
