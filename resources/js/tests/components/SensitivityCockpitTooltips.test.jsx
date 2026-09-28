import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SensitivityCockpitView } from '../../components/investments/SensitivityCockpitView';
import { ScenarioPresetSelector, SCENARIO_PRESETS } from '../../components/investments/ScenarioPresetSelector';
import { DebtRepaymentModeSwitcher, REPAYMENT_MODES } from '../../components/investments/DebtRepaymentModeSwitcher';
import { InvestmentProjectContext } from '../../context/InvestmentProjectContext';

// Mock Recharts to avoid DOM calculation issues in jsdom
vi.mock('recharts', () => {
    const ResponsiveContainer = ({ children }) => <div data-testid="responsive-container">{children}</div>;
    const ComposedChart = ({ children }) => <div data-testid="composed-chart">{children}</div>;
    const Bar = () => <div data-testid="chart-bar" />;
    const Line = () => <div data-testid="chart-line" />;
    const XAxis = () => <div data-testid="chart-xaxis" />;
    const YAxis = () => <div data-testid="chart-yaxis" />;
    const CartesianGrid = () => <div data-testid="chart-grid" />;
    const Tooltip = () => <div data-testid="chart-tooltip" />;
    const Legend = () => <div data-testid="chart-legend" />;
    return {
        ResponsiveContainer,
        ComposedChart,
        Bar,
        Line,
        XAxis,
        YAxis,
        CartesianGrid,
        Tooltip,
        Legend
    };
});

// Mock Web Worker client
vi.mock('../../workers/InvestmentWorkerClient', () => {
    return {
        getInvestmentWorkerClient: () => ({
            simulate: vi.fn().mockResolvedValue({
                annualPeriods: [
                    { year: 1, revenue: 15000000, totalOpex: 8000000, capex: 20000000, ebitda: 7000000, fcff: -13000000, closingDebt: 25000000 },
                    { year: 2, revenue: 18000000, totalOpex: 9000000, capex: 0, ebitda: 9000000, fcff: 6000000, closingDebt: 22000000 },
                    { year: 5, revenue: 22000000, totalOpex: 10000000, capex: 1500000, ebitda: 12000000, fcff: 7500000, closingDebt: 12000000 }
                ],
                summary: {
                    totalCapex: 40000000,
                    totalReinvestmentCapex: 2500000,
                    totalRevenue15Y: 300000000,
                    totalEbitda15Y: 120000000,
                    totalInterest15Y: 10000000,
                    projectNpv: 35000000,
                    equityNpv: 22000000,
                    projectIrrPercent: 14.5,
                    equityMoic: 3.2,
                    simplePaybackYears: 4.5,
                    discountedPaybackYears: 6.2,
                    minDscr: 1.35,
                    avgDscr: 1.85,
                },
                appraisal: {
                    isBankable: true,
                    waccPercent: 8.5
                }
            })
        })
    };
});

const mockProject = {
    id: 1,
    name: 'BESS 50MW / 200MWh Project Alpha',
    currency: 'PLN',
    debt_facility: {
        repayment_type: 'annuity',
        facility_amount: 30000000,
        margin_bps: 220,
        tenor_years: 12
    },
    operating_assumptions: {
        annual_fixed_costs_base: 1400000,
        annual_payroll_base: 2200000
    },
    reinvestment_programs: [
        { id: 1, name: 'BESS Battery Inverters Refresh', cycle_years: 5, capex_amount: 1500000, is_active: true }
    ]
};

const renderWithContext = (ui, project = mockProject) => {
    return render(
        <InvestmentProjectContext.Provider value={{ selectedProject: project, setSelectedProjectId: vi.fn() }}>
            {ui}
        </InvestmentProjectContext.Provider>
    );
};

describe('Tab 2 "2. Symulator What-If" Accessible Tooltips & InfoTooltips (Commit 283)', () => {
    describe('ScenarioPresetSelector Tooltips', () => {
        it('renders accessible info tooltip and preset button tooltips', async () => {
            render(
                <ScenarioPresetSelector
                    activeScenario="base"
                    onSelectScenario={vi.fn()}
                    onReset={vi.fn()}
                    baseWacc={8.5}
                />
            );

            // InfoTooltip on "SCENARIUSZ:"
            const scenarioInfoBtn = screen.getByRole('button', { name: 'Informacje o scenariuszach What-If' });
            expect(scenarioInfoBtn).toBeInTheDocument();

            // Preset buttons with accessible labels
            expect(screen.getByRole('button', { name: /Bazowy/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Optymistyczny/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Stres-Test Bankowy/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Stagflacja/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Presja Płacowa/i })).toBeInTheDocument();

            // Reset button
            expect(screen.getByRole('button', { name: /Przywróć Bazę/i })).toBeInTheDocument();
        });
    });

    describe('DebtRepaymentModeSwitcher Tooltips & Accessibility', () => {
        it('renders accessible cards with keyboard support and metric info tooltips', async () => {
            const handleChangeMode = vi.fn();
            render(
                <DebtRepaymentModeSwitcher
                    facility={mockProject.debt_facility}
                    activeMode="annuity"
                    contractMode="annuity"
                    onChangeMode={handleChangeMode}
                    onResetToContract={vi.fn()}
                    minDscr={1.35}
                    avgDscr={1.85}
                    totalInterest={10000000}
                    baseInterest={10000000}
                    currency="PLN"
                />
            );

            // Header info tooltip
            expect(screen.getByRole('button', { name: 'Informacje o profilach amortyzacji długu' })).toBeInTheDocument();

            // 3 repayment mode cards as accessible buttons
            const annuityCard = screen.getByRole('button', { name: /Wybierz tryb spłaty: Raty Równe \(Annuity\)/i });
            const linearCard = screen.getByRole('button', { name: /Wybierz tryb spłaty: Raty Malejące \(Linear\)/i });
            const bulletCard = screen.getByRole('button', { name: /Wybierz tryb spłaty: Spłata Balonowa \(Bullet\)/i });

            expect(annuityCard).toBeInTheDocument();
            expect(linearCard).toBeInTheDocument();
            expect(bulletCard).toBeInTheDocument();

            // Check keyboard activation on cards
            fireEvent.keyDown(linearCard, { key: 'Enter', code: 'Enter' });
            expect(handleChangeMode).toHaveBeenCalledWith('linear');

            // 4 Covenant & Cost Impact Bar InfoTooltips
            expect(screen.getByRole('button', { name: 'Informacje o kowenancie minimalnego DSCR' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Informacje o średnim wskaźniku DSCR' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Informacje o łącznym koszcie odsetek' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Informacje o odchyleniu kosztu odsetek' })).toBeInTheDocument();
        });
    });

    describe('SensitivityCockpitView Comprehensive Tooltips', () => {
        it('renders accessible InfoTooltips across Header, 5 KPI cards, Sliders, Chart and Table', async () => {
            renderWithContext(<SensitivityCockpitView />);

            // 1. Header InfoTooltip
            expect(screen.getByRole('button', { name: 'Informacje o symulatorze What-If' })).toBeInTheDocument();

            // 2. Top 5 KPI Cards InfoTooltips
            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Informacje o Project NPV' })).toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'Informacje o Project IRR' })).toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'Informacje o Equity MoIC' })).toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'Informacje o okresie zwrotu' })).toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'Informacje o kowenancie DSCR' })).toBeInTheDocument();
            });

            // 3. Sliders matrix InfoTooltips
            expect(screen.getByRole('button', { name: 'Informacje o suwakach analizy wrażliwości' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Informacje o nakładach CAPEX' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Informacje o przychodach ze sprzedaży' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Informacje o kosztach zmiennych' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Informacje o kosztach stałych OPEX' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Informacje o funduszu płac' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Informacje o stopie dyskontowej WACC' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Informacje o nakładach odtworzeniowych Reinvestment' })).toBeInTheDocument();

            // Sliders range inputs have accessible aria-labels
            expect(screen.getByLabelText('Odchylenie nakładów CAPEX w procentach')).toBeInTheDocument();
            expect(screen.getByLabelText('Odchylenie przychodów ze sprzedaży w procentach')).toBeInTheDocument();
            expect(screen.getByLabelText('Odchylenie kosztów zmiennych w procentach')).toBeInTheDocument();
            expect(screen.getByLabelText('Odchylenie kosztów stałych OPEX w procentach')).toBeInTheDocument();
            expect(screen.getByLabelText('Odchylenie funduszu płac w procentach')).toBeInTheDocument();
            expect(screen.getByLabelText('Ręczna zmiana stopy dyskontowej WACC')).toBeInTheDocument();
            expect(screen.getByLabelText('Mnożnik nakładów odtworzeniowych Reinvestment w procentach')).toBeInTheDocument();

            // Reinvestment toggle checkbox aria-label
            expect(screen.getByLabelText('Włącz lub wyłącz cykliczny reinvestment')).toBeInTheDocument();

            // 4. 15-Year Financial Evolution Chart
            expect(screen.getByRole('button', { name: 'Informacje o 15-letnim wykresie ewolucji' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Przełącz na widok nominalny P&L i CF' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Przełącz na widok zdyskontowany DCF i NPV' })).toBeInTheDocument();

            // 5. Comparison Grid Table
            expect(screen.getByRole('button', { name: 'Informacje o macierzy porównawczej' })).toBeInTheDocument();
            expect(screen.getByText('METRYKA MODELU')).toBeInTheDocument();
            expect(screen.getByText('SCENARIUSZ BAZOWY')).toBeInTheDocument();
            expect(screen.getByText('SCENARIUSZ WHAT-IF')).toBeInTheDocument();
            expect(screen.getByText('ODCHYLENIE DELTA')).toBeInTheDocument();
            expect(screen.getByText('WPŁYW / STATUS')).toBeInTheDocument();
        });
    });
});
