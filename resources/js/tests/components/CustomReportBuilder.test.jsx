import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { CustomReportBuilder, REPORT_PRESETS, METRIC_CATALOG } from '../../components/investments/CustomReportBuilder';
import { InvestmentProjectContext } from '../../context/InvestmentProjectContext';
import { NotificationContext } from '../../context/NotificationContext';
import { ThemeProvider, THEMES } from '../../context/ThemeContext';

// Mock Recharts ResponsiveContainer to prevent size observer issues in test DOM
vi.mock('recharts', async () => {
    const actual = await vi.importActual('recharts');
    return {
        ...actual,
        ResponsiveContainer: ({ children }) => (
            <div data-testid="recharts-mock-container" style={{ width: 800, height: 300 }}>
                {children}
            </div>
        ),
    };
});

describe('CustomReportBuilder Component (Phase 45 Commit 223)', () => {
    const mockSuccess = vi.fn();
    const mockNotifyError = vi.fn();

    const mockProject = {
        id: 'proj-report-1',
        name: 'Farma PV 50MW Solar North',
        currency: 'PLN',
        planning_horizon_years: 15,
        operating_assumptions: {
            annual_revenue_base: 30000000,
            variable_cost_percent: 15.0,
            annual_fixed_costs_base: 2500000,
            annual_payroll_base: 3000000,
        }
    };

    // Realistic 15-year simulation data structure
    const mockSimulationData = {
        statements: {
            initialCapex: 80000000,
            initialEquity: 32000000,
            totalCapex: 85000000,
            totalReinvestmentCapex: 5000000,
            annualPeriods: Array.from({ length: 15 }, (_, i) => {
                const year = i + 1;
                const revenue = 30000000 * Math.pow(1.02, i);
                const variableCosts = revenue * 0.15;
                const fixedCosts = 2500000;
                const payrollCosts = 3000000;
                const totalOpex = variableCosts + fixedCosts + payrollCosts;
                const ebitda = revenue - totalOpex;
                const depreciation = 5000000;
                const ebit = ebitda - depreciation;
                const interestExpense = Math.max(0, (48000000 - i * 4800000) * 0.07);
                const ebt = ebit - interestExpense;
                const cit = Math.max(0, ebt * 0.19);
                const netIncome = ebt - cit;
                const capex = year === 1 ? 80000000 : (year === 8 ? 5000000 : 0);
                const operatingCashFlow = ebitda - cit;
                const debtPrincipalRepaid = year <= 10 ? 4800000 : 0;
                const closingDebt = Math.max(0, 48000000 - year * 4800000);
                const closingCash = 10000000 + year * 3000000;
                const fcfe = operatingCashFlow - interestExpense - debtPrincipalRepaid;

                return {
                    year,
                    revenue,
                    variableCosts,
                    fixedCosts,
                    payrollCosts,
                    totalOpex,
                    ebitda,
                    ebitdaMarginPercent: (ebitda / revenue) * 100,
                    depreciation,
                    ebit,
                    interestExpense,
                    ebt,
                    cit,
                    netIncome,
                    netMarginPercent: (netIncome / revenue) * 100,
                    capex,
                    changeInNwc: 100000,
                    operatingCashFlow,
                    investingCashFlow: -capex,
                    financingCashFlow: year === 1 ? 48000000 : -(debtPrincipalRepaid + interestExpense),
                    netCashFlow: operatingCashFlow - capex - (debtPrincipalRepaid + interestExpense),
                    closingCash,
                    closingDebt,
                    closingReceivables: 2500000,
                    closingInventory: 800000,
                    closingPayables: 1500000,
                    fcff: ebitda - cit - capex,
                    fcfe,
                    dscr: 1.45,
                    interestCoverageRatio: 4.5,
                    debtPrincipalRepaid,
                    debtDrawdown: year === 1 ? 48000000 : 0
                };
            })
        },
        covenants: {
            currency: 'PLN',
            summary: {
                minDscr: 1.45,
                avgDscr: 1.62,
                minIcr: 4.5,
                peakLeverage: 2.1,
                minDsrfMonths: 9.0,
                isBankable: true,
                bankabilityStatus: 'compliant',
                totalBreachesCount: 0
            },
            annualCovenants: Array.from({ length: 15 }, (_, i) => ({
                year: i + 1,
                isCommercial: true,
                hasDebtService: i < 10,
                revenue: 30000000 * Math.pow(1.02, i),
                ebitda: 20000000,
                ebit: 15000000,
                interestExpense: Math.max(0, (48000000 - i * 4800000) * 0.07),
                principalRepaid: i < 10 ? 4800000 : 0,
                totalDebtService: i < 10 ? 4800000 + Math.max(0, (48000000 - i * 4800000) * 0.07) : 0,
                cfads: 18000000,
                closingCash: 10000000 + (i + 1) * 3000000,
                closingDebt: Math.max(0, 48000000 - (i + 1) * 4800000),
                netDebt: Math.max(0, 48000000 - (i + 1) * 4800000 - (10000000 + (i + 1) * 3000000)),
                currentAssets: 15000000,
                currentLiabilities: 5000000,
                dscr: 1.45,
                dscrStatus: 'compliant',
                dscrHeadroom: 0.25,
                icr: 4.5,
                icrStatus: 'compliant',
                currentRatio: 3.0,
                currentRatioStatus: 'compliant',
                leverageRatio: 1.8,
                dsrfMonths: 9.5,
                isCompliant: true,
                breaches: []
            }))
        },
        exitValuation: {
            exitYear: 5,
            exitMultiple: 7.5,
            enterpriseValue: 150000000,
            equityValue: 130000000,
            initialEquity: 32000000,
            buyerEbitdaYieldPercent: 13.33,
            equityMoic: 4.06,
            equityIrrPercent: 32.5
        },
        appraisal: {
            npv: 45000000,
            irr: 24.5,
            waccPercent: 8.5,
            simplePaybackYears: 4.8,
            moic: 3.8
        }
    };

    const renderComponent = (props = {}) => {
        const projectContextValue = {
            selectedProject: mockProject,
            selectedProjectId: mockProject.id,
            updateProject: vi.fn(),
            loading: false,
        };

        const notificationContextValue = {
            success: mockSuccess,
            error: mockNotifyError,
            info: vi.fn(),
            warning: vi.fn(),
        };

        return render(
            <NotificationContext.Provider value={notificationContextValue}>
                <InvestmentProjectContext.Provider value={projectContextValue}>
                    <CustomReportBuilder
                        project={mockProject}
                        simulationData={mockSimulationData}
                        {...props}
                    />
                </InvestmentProjectContext.Provider>
            </NotificationContext.Provider>
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component header, preset selector, scale selector, and default table rows', () => {
        renderComponent();

        expect(screen.getByTestId('custom-report-builder')).toBeInTheDocument();
        expect(screen.getByText(/Kreator Raportów Finansowych/i)).toBeInTheDocument();
        expect(screen.getByText(/15-Year Horizon/i)).toBeInTheDocument();

        // Check preset dropdown
        const presetSelect = screen.getByTestId('preset-select');
        expect(presetSelect).toBeInTheDocument();
        expect(presetSelect.value).toBe('executive_cash');

        // Check default table rows from executive_cash preset
        expect(screen.getByTestId('report-row-revenue')).toBeInTheDocument();
        expect(screen.getByTestId('report-row-ebitda')).toBeInTheDocument();
        expect(screen.getByTestId('report-row-capex')).toBeInTheDocument();
        expect(screen.getByTestId('report-row-total_debt_service')).toBeInTheDocument();
        expect(screen.getByTestId('report-row-fcfe')).toBeInTheDocument();
        expect(screen.getByTestId('report-row-closing_cash')).toBeInTheDocument();

        // Check timeline headers (Rok 1 to Rok 15)
        expect(screen.getByText('Rok 1')).toBeInTheDocument();
        expect(screen.getByText('Rok 15')).toBeInTheDocument();
        expect(screen.getByText('Podsumowanie')).toBeInTheDocument();
    });

    it('switches report presets correctly (Bank Debt Coverage Pack, PE Returns, Profitability)', async () => {
        renderComponent();

        const presetSelect = screen.getByTestId('preset-select');

        // Switch to Bank Debt Coverage Pack
        fireEvent.change(presetSelect, { target: { value: 'bank_debt_pack' } });
        expect(presetSelect.value).toBe('bank_debt_pack');

        await waitFor(() => {
            expect(screen.getByTestId('report-row-cfads')).toBeInTheDocument();
            expect(screen.getByTestId('report-row-dscr')).toBeInTheDocument();
            expect(screen.getByTestId('report-row-icr')).toBeInTheDocument();
            expect(screen.getByTestId('report-row-leverage_ratio')).toBeInTheDocument();
            expect(screen.getByTestId('report-row-dsrf_months')).toBeInTheDocument();
        });

        // Switch to PE Investor Returns & Equity Bridge
        fireEvent.change(presetSelect, { target: { value: 'pe_returns_bridge' } });
        await waitFor(() => {
            expect(screen.getByTestId('report-row-enterprise_value')).toBeInTheDocument();
            expect(screen.getByTestId('report-row-equity_value')).toBeInTheDocument();
            expect(screen.getByTestId('report-row-cumulative_moic')).toBeInTheDocument();
        });

        // Switch to Profitability & Margins
        fireEvent.change(presetSelect, { target: { value: 'profitability_margins' } });
        await waitFor(() => {
            expect(screen.getByTestId('report-row-variable_costs')).toBeInTheDocument();
            expect(screen.getByTestId('report-row-fixed_costs')).toBeInTheDocument();
            expect(screen.getByTestId('report-row-ebitda_margin')).toBeInTheDocument();
            expect(screen.getByTestId('report-row-net_margin')).toBeInTheDocument();
        });
    });

    it('filters time horizon between 5, 10, and 15 years', () => {
        renderComponent();

        // Default is 15 years
        expect(screen.getByText('Rok 15')).toBeInTheDocument();

        // Switch to 5 Years
        const horizon5Btn = screen.getByRole('button', { name: '5L' });
        fireEvent.click(horizon5Btn);

        expect(screen.getByText('Rok 5')).toBeInTheDocument();
        expect(screen.queryByText('Rok 6')).not.toBeInTheDocument();
        expect(screen.queryByText('Rok 15')).not.toBeInTheDocument();

        // Switch to 10 Years
        const horizon10Btn = screen.getByRole('button', { name: '10L' });
        fireEvent.click(horizon10Btn);

        expect(screen.getByText('Rok 10')).toBeInTheDocument();
        expect(screen.queryByText('Rok 11')).not.toBeInTheDocument();
    });

    it('switches numerical presentation scale between PLN, tys. PLN, and mln PLN', () => {
        renderComponent();

        const table = screen.getByTestId('report-table');
        expect(screen.getByRole('button', { name: 'tys. PLN' })).toBeInTheDocument();

        // Switch to mln PLN
        const mlnBtn = screen.getByRole('button', { name: 'mln PLN' });
        fireEvent.click(mlnBtn);
        expect(within(table).getByText(/^Rok 1$/)).toBeInTheDocument();
        expect(mlnBtn).toHaveClass('bg-emerald-600');

        // Switch to PLN
        const plnBtn = screen.getByRole('button', { name: 'PLN' });
        fireEvent.click(plnBtn);
        expect(within(table).getByText(/^Rok 1$/)).toBeInTheDocument();
        expect(plnBtn).toHaveClass('bg-emerald-600');
    });

    it('allows removing and reordering report rows', () => {
        renderComponent();

        // Verify initial row count
        expect(screen.getByTestId('report-row-revenue')).toBeInTheDocument();

        // Find remove button for revenue row
        const revenueRow = screen.getByTestId('report-row-revenue');
        const removeRevenueBtn = within(revenueRow).getByTitle('Usuń pozycję');
        fireEvent.click(removeRevenueBtn);

        // Revenue should now be removed
        expect(screen.queryByTestId('report-row-revenue')).not.toBeInTheDocument();

        // Preset selector should reflect 'custom'
        const presetSelect = screen.getByTestId('preset-select');
        expect(presetSelect.value).toBe('custom');

        // Test moving ebitda down
        const ebitdaRow = screen.getByTestId('report-row-ebitda');
        const moveDownBtn = within(ebitdaRow).getByTitle('Przesuń w dół');
        fireEvent.click(moveDownBtn);
    });

    it('opens metric picker modal, filters metrics, and adds a new metric to the report', async () => {
        renderComponent();

        // Open modal
        const openPickerBtn = screen.getByTestId('open-metric-picker-button');
        fireEvent.click(openPickerBtn);

        expect(screen.getByTestId('metric-picker-modal')).toBeInTheDocument();
        expect(screen.getByText('Biblioteka Pozycji Raportowych')).toBeInTheDocument();

        // Filter by category: Bilans
        const balanceCategoryBtn = screen.getByRole('button', { name: 'Bilans' });
        fireEvent.click(balanceCategoryBtn);

        // Search for NWC
        const searchInput = screen.getByTestId('picker-search-input');
        fireEvent.change(searchInput, { target: { value: 'NWC' } });

        // Add NWC
        const addNwcBtn = screen.getByTestId('picker-add-button-nwc');
        expect(addNwcBtn).toBeInTheDocument();
        fireEvent.click(addNwcBtn);

        expect(mockSuccess).toHaveBeenCalledWith(
            expect.stringContaining('Dodano pozycję'),
            expect.stringContaining('Kapitał obrotowy netto (NWC)')
        );

        // Close modal
        const closeBtn = screen.getByRole('button', { name: 'Zamknij' });
        fireEvent.click(closeBtn);

        await waitFor(() => {
            expect(screen.queryByTestId('metric-picker-modal')).not.toBeInTheDocument();
        });

        // NWC should now be in the report table
        expect(screen.getByTestId('report-row-nwc')).toBeInTheDocument();
    });

    it('toggles chart visibility, chart type, and row inclusion on chart', () => {
        renderComponent();

        // Initially chart is visible
        expect(screen.getByTestId('report-chart-container')).toBeInTheDocument();

        // Toggle chart type: switch to bar chart
        const barChartBtn = screen.getByTestId('chart-type-bar');
        fireEvent.click(barChartBtn);
        expect(screen.getByTestId('report-chart-container')).toBeInTheDocument();

        // Switch back to line chart
        const lineChartBtn = screen.getByTestId('chart-type-line');
        fireEvent.click(lineChartBtn);

        // Toggle row chart inclusion
        const revenueChartToggle = screen.getByTestId('toggle-chart-row-revenue');
        fireEvent.click(revenueChartToggle);

        // Toggle chart off completely
        const toggleChartBtn = screen.getByTestId('toggle-chart-button');
        fireEvent.click(toggleChartBtn);

        expect(screen.queryByTestId('report-chart-container')).not.toBeInTheDocument();
    });

    it('exports custom report table to CSV file', () => {
        // Mock URL and document createElement
        const createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/mock-csv');
        const revokeObjectURLMock = vi.fn();
        global.URL.createObjectURL = createObjectURLMock;
        global.URL.revokeObjectURL = revokeObjectURLMock;

        const anchorClickMock = vi.fn();
        const originalCreateElement = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
            if (tagName === 'a') {
                const a = originalCreateElement('a');
                a.click = anchorClickMock;
                return a;
            }
            return originalCreateElement(tagName);
        });

        renderComponent();

        const exportBtn = screen.getByTestId('export-csv-button');
        fireEvent.click(exportBtn);

        expect(createObjectURLMock).toHaveBeenCalled();
        expect(anchorClickMock).toHaveBeenCalled();
        expect(mockSuccess).toHaveBeenCalledWith(
            expect.stringContaining('Eksport CSV zakończony'),
            expect.stringContaining('.csv')
        );

        vi.restoreAllMocks();
    });
    it('renders cleanly in light and dark theme mode', () => {
        const { unmount } = render(
            <ThemeProvider defaultTheme={THEMES.LIGHT}>
                <InvestmentProjectContext.Provider value={{ selectedProject: mockProject }}>
                    <NotificationContext.Provider value={{ success: mockSuccess, error: mockNotifyError }}>
                        <CustomReportBuilder
                            project={mockProject}
                            simulationData={mockSimulationData}
                        />
                    </NotificationContext.Provider>
                </InvestmentProjectContext.Provider>
            </ThemeProvider>
        );

        const builderContainer = screen.getByTestId('custom-report-builder');
        expect(builderContainer).toBeInTheDocument();
        const table = screen.getByTestId('report-table');
        expect(table).toBeInTheDocument();
        unmount();

        render(
            <ThemeProvider defaultTheme={THEMES.DARK}>
                <InvestmentProjectContext.Provider value={{ selectedProject: mockProject }}>
                    <NotificationContext.Provider value={{ success: mockSuccess, error: mockNotifyError }}>
                        <CustomReportBuilder
                            project={mockProject}
                            simulationData={mockSimulationData}
                        />
                    </NotificationContext.Provider>
                </InvestmentProjectContext.Provider>
            </ThemeProvider>
        );

        expect(screen.getByTestId('custom-report-builder')).toBeInTheDocument();
        expect(screen.getByTestId('report-table')).toBeInTheDocument();
    });
});