import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReportsView } from '../../views/ReportsView';
import { ReportConfigurator } from '../../components/reports/ReportConfigurator';
import { ExecutivePdfReport } from '../../components/reports/ExecutivePdfReport';
import { AuthContext } from '../../context/AuthContext';
import { DealProvider } from '../../context/DealContext';
import { NotificationContext } from '../../context/NotificationContext';
import apiClient from '../../api/client';

vi.mock('../../api/client', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
        },
    },
}));

const mockCompany = {
    id: 'comp-100',
    name: 'Helvest Capital Partners S.A.',
    code: 'HELV',
    nip: '525-222-33-44',
    tax_id: 'PL5252223344',
};

const mockUser = {
    id: 'user-200',
    name: 'Marek Wiśniewski (Lead Partner)',
    email: 'm.wisniewski@helvest.com',
};

const mockConfig = {
    periodPreset: 'all',
    startDate: '',
    endDate: '',
    currency: 'PLN',
    confidentiality: 'STRICTLY CONFIDENTIAL',
    sections: {
        kpi: true,
        pnl: true,
        liquidity: true,
        opex: true,
        audit: true,
    },
    commentary: 'Rekomendacja pozytywna dla komitetu inwestycyjnego.',
};

const mockMetrics = {
    period: {
        start: '2026-01-01',
        end: '2026-12-31',
        label: '2026-01-01 do 2026-12-31',
    },
    pnl: {
        revenue: { amount: 12000000.0, formatted: '12 000 000,00 PLN' },
        cogs: { amount: 6000000.0, formatted: '6 000 000,00 PLN' },
        gross_profit: { amount: 6000000.0, formatted: '6 000 000,00 PLN' },
        gross_margin_pct: 50.0,
        opex: { amount: 2000000.0, formatted: '2 000 000,00 PLN' },
        depreciation: { amount: 500000.0, formatted: '500 000,00 PLN' },
        ebit: { amount: 3500000.0, formatted: '3 500 000,00 PLN' },
        operating_margin_pct: 29.17,
        ebitda: { amount: 4000000.0, formatted: '4 000 000,00 PLN' },
        ebitda_margin_pct: 33.33,
        financial_costs: { amount: 150000.0, formatted: '150 000,00 PLN' },
        tax: { amount: 600000.0, formatted: '600 000,00 PLN' },
        net_profit: { amount: 2750000.0, formatted: '2 750 000,00 PLN' },
        net_margin_pct: 22.92,
    },
    balance_sheet: {
        current_assets: { amount: 8000000.0, formatted: '8 000 000,00 PLN' },
        current_liabilities: { amount: 4000000.0, formatted: '4 000 000,00 PLN' },
    },
    ratios: {
        current_ratio: 2.0,
        quick_ratio: 1.5,
        cash_ratio: 0.4,
    },
};

const mockBreakdown = [
    { category_name: 'Usługi Doradcze', amount: 800000, percentage: 40.0 },
    { category_name: 'Wynagrodzenia Zarządu', amount: 700000, percentage: 35.0 },
    { category_name: 'Infrastruktura IT', amount: 500000, percentage: 25.0 },
];

const renderWithContext = (ui) => {
    return render(
        <NotificationContext.Provider value={{ success: vi.fn(), error: vi.fn(), info: vi.fn() }}>
            <AuthContext.Provider value={{ user: mockUser, activeCompany: mockCompany }}>
                <DealProvider>
                    {ui}
                </DealProvider>
            </AuthContext.Provider>
        </NotificationContext.Provider>
    );
};

describe('ExecutiveReports Tooltips Accessibility & Ergonomics', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiClient.get.mockImplementation((url) => {
            if (url.includes('/metrics')) {
                return Promise.resolve({ data: { data: mockMetrics } });
            }
            if (url.includes('/trends')) {
                return Promise.resolve({ data: { data: [] } });
            }
            if (url.includes('/breakdown')) {
                return Promise.resolve({ data: { data: mockBreakdown } });
            }
            if (url.includes('/years')) {
                return Promise.resolve({ data: { data: ['2026', '2025'] } });
            }
            return Promise.resolve({ data: { data: {} } });
        });
    });

    it('renders accessible tooltips and info buttons in ReportsView banner', async () => {
        renderWithContext(<ReportsView />);

        // Info button in title with specific accessible label
        await waitFor(() => {
            const titleInfoBtn = screen.getByRole('button', { name: 'Więcej informacji o generatorze raportów zarządczych' });
            expect(titleInfoBtn).toBeInTheDocument();
        });

        // Icon badge with role="img" and accessible label
        const iconBadge = screen.getByRole('img', { name: 'Generator raportów zarządczych' });
        expect(iconBadge).toBeInTheDocument();

        // Format badge
        expect(screen.getByText('A4 WEKTOROWY PDF')).toBeInTheDocument();
    });

    it('renders ReportConfigurator action buttons with tooltips and accessible aria-labels', () => {
        const onPrint = vi.fn();
        const onExportJson = vi.fn();
        const onRefresh = vi.fn();

        render(
            <ReportConfigurator
                config={mockConfig}
                onChange={vi.fn()}
                onPrint={onPrint}
                onExportJson={onExportJson}
                onRefresh={onRefresh}
                loading={false}
            />
        );

        // Action buttons
        const refreshBtn = screen.getByRole('button', { name: 'Przelicz dane raportu' });
        expect(refreshBtn).toBeInTheDocument();

        const jsonBtn = screen.getByRole('button', { name: 'Eksportuj surowe dane JSON' });
        expect(jsonBtn).toBeInTheDocument();

        const printBtn = screen.getByRole('button', { name: 'Drukuj lub zapisz jako wektorowy plik PDF' });
        expect(printBtn).toBeInTheDocument();
    });

    it('renders InfoTooltip triggers for all configuration dimensions', () => {
        render(
            <ReportConfigurator
                config={mockConfig}
                onChange={vi.fn()}
                onPrint={vi.fn()}
                onExportJson={vi.fn()}
                onRefresh={vi.fn()}
                loading={false}
            />
        );

        expect(screen.getByRole('button', { name: 'Więcej informacji o konfiguratorze parametrów raportu' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Więcej informacji o horyzoncie czasowym' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Więcej informacji o walucie prezentacji' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Więcej informacji o klauzuli poufności' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Więcej informacji o zakresie sekcji' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Więcej informacji o komentarzu analitycznym' })).toBeInTheDocument();
    });

    it('renders accessible form controls and section toggles with tooltips', () => {
        render(
            <ReportConfigurator
                config={mockConfig}
                onChange={vi.fn()}
                onPrint={vi.fn()}
                onExportJson={vi.fn()}
                onRefresh={vi.fn()}
                loading={false}
            />
        );

        // Period select
        expect(screen.getByRole('combobox', { name: 'Wybierz horyzont czasowy raportu' })).toBeInTheDocument();

        // Currency select
        expect(screen.getByRole('combobox', { name: 'Wybierz walutę prezentacji raportu' })).toBeInTheDocument();

        // Confidentiality select
        expect(screen.getByRole('combobox', { name: 'Wybierz klauzulę poufności raportu' })).toBeInTheDocument();

        // Section checkboxes with accessible buttons
        expect(screen.getByRole('button', { name: /Przełącz sekcję: Metryki KPI/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Przełącz sekcję: Rachunek Zysków i Strat/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Przełącz sekcję: Wskaźniki Płynności/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Przełącz sekcję: Struktura Kosztów Operacyjnych/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Przełącz sekcję: Certyfikat Integralności/i })).toBeInTheDocument();

        // Commentary presets
        expect(screen.getByRole('button', { name: /Wstaw szablon: Stabilny wzrost EBITDA/i })).toBeInTheDocument();

        // Commentary textarea
        expect(screen.getByRole('textbox', { name: 'Komentarz analityczny doradcy M&A lub CFO' })).toBeInTheDocument();
    });

    it('renders custom date range inputs with accessible labels and tooltips when preset is custom', () => {
        render(
            <ReportConfigurator
                config={{ ...mockConfig, periodPreset: 'custom', startDate: '2026-01-01', endDate: '2026-06-30' }}
                onChange={vi.fn()}
                onPrint={vi.fn()}
                onExportJson={vi.fn()}
                onRefresh={vi.fn()}
                loading={false}
            />
        );

        expect(screen.getByLabelText('Początkowa data analizowanego okresu')).toBeInTheDocument();
        expect(screen.getByLabelText('Końcowa data analizowanego okresu')).toBeInTheDocument();
    });

    it('renders ExecutivePdfReport with print:hidden info buttons and accessible elements', () => {
        render(
            <ExecutivePdfReport
                company={mockCompany}
                currentUser={mockUser}
                config={mockConfig}
                metrics={mockMetrics}
                trends={[]}
                breakdown={mockBreakdown}
                reportHash="abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
                generatedAt="2026-09-28T00:00:00Z"
            />
        );

        // Header memo badge
        expect(screen.getByText('HELVEST ADVISORY // DEAL MEMO')).toBeInTheDocument();

        // Confidentiality watermark
        expect(screen.getByText('STRICTLY CONFIDENTIAL')).toBeInTheDocument();

        // Audit identifier
        expect(screen.getByText(/IDENTYFIKATOR:/)).toBeInTheDocument();

        // Metadata info tooltips with print:hidden
        expect(screen.getByRole('button', { name: 'Więcej informacji o podmiocie analizowanym' })).toHaveClass('print:hidden');
        expect(screen.getByRole('button', { name: 'Więcej informacji o horyzoncie analitycznym' })).toHaveClass('print:hidden');
        expect(screen.getByRole('button', { name: 'Więcej informacji o walucie prezentacji raportu' })).toHaveClass('print:hidden');
        expect(screen.getByRole('button', { name: 'Więcej informacji o autorze i dacie sporządzenia' })).toHaveClass('print:hidden');

        // Section info tooltips with print:hidden
        expect(screen.getByRole('button', { name: 'Więcej informacji o metrykach KPI' })).toHaveClass('print:hidden');
        expect(screen.getByRole('button', { name: 'Więcej informacji o rachunku zysków i strat' })).toHaveClass('print:hidden');
        expect(screen.getByRole('button', { name: 'Więcej informacji o płynności finansowej' })).toHaveClass('print:hidden');
        expect(screen.getByRole('button', { name: 'Więcej informacji o strukturze kosztów OPEX' })).toHaveClass('print:hidden');
        expect(screen.getByRole('button', { name: 'Więcej informacji o opinii doradcy transakcyjnego' })).toHaveClass('print:hidden');
        expect(screen.getByRole('button', { name: 'Więcej informacji o certyfikacie integralności' })).toHaveClass('print:hidden');

        // Classification codes
        expect(screen.getByText('REVENUE')).toBeInTheDocument();
        expect(screen.getByText('COGS')).toBeInTheDocument();
        expect(screen.getByText('GROSS MARGIN')).toBeInTheDocument();
        expect(screen.getByText('EBITDA MARGIN')).toBeInTheDocument();
        expect(screen.getByText('NET MARGIN')).toBeInTheDocument();

        // Audit certificate
        expect(screen.getByText(/STATUS: IMMUTABLE AUDIT RECORD/)).toBeInTheDocument();
    });

    it('displays floating tooltip content on hover of action button', async () => {
        render(
            <ReportConfigurator
                config={mockConfig}
                onChange={vi.fn()}
                onPrint={vi.fn()}
                onExportJson={vi.fn()}
                onRefresh={vi.fn()}
                loading={false}
            />
        );

        const printBtn = screen.getByRole('button', { name: 'Drukuj lub zapisz jako wektorowy plik PDF' });
        fireEvent.mouseEnter(printBtn);

        await waitFor(() => {
            const tooltip = screen.getByTestId('floating-tooltip');
            expect(tooltip).toBeInTheDocument();
            expect(tooltip.textContent).toMatch(/Uruchom podgląd wydruku/i);
        });
    });
});
