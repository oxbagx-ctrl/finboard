import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReportConfigurator } from '../../components/reports/ReportConfigurator';
import { ExecutivePdfReport } from '../../components/reports/ExecutivePdfReport';
import { ThemeProvider, THEMES } from '../../context/ThemeContext';

const mockCompany = {
    id: 'comp-1',
    name: 'Acme Manufacturing S.A.',
    code: 'ACME',
    nip: '525-100-20-30',
};

const mockUser = {
    id: 'user-1',
    name: 'Jan Kowalski (CFO)',
    email: 'jan@acme.com',
};

const mockMetrics = {
    revenue: 45000000,
    cogs: 27000000,
    gross_profit: 18000000,
    gross_margin: 0.40,
    opex: 10500000,
    ebitda: 7500000,
    ebitda_margin: 0.1667,
    depreciation: 1500000,
    ebit: 6000000,
    taxes_and_finance: 1200000,
    net_profit: 4800000,
    net_margin: 0.1067,
    current_ratio: 1.85,
    quick_ratio: 1.25,
    cash_ratio: 0.35,
};

// Real nested structure returned by GET /finance/analytics/metrics
const mockApiMetrics = {
    period: {
        start: '2026-01-01',
        end: '2026-12-31',
        label: '2026-01-01 do 2026-12-31',
    },
    pnl: {
        revenue: { amount: 6654223.16, formatted: '6 654 223,16 PLN' },
        cogs: { amount: 3371404.23, formatted: '3 371 404,23 PLN' },
        gross_profit: { amount: 3282818.92, formatted: '3 282 818,92 PLN' },
        gross_margin_pct: 49.33,
        opex: { amount: 1207540.0, formatted: '1 207 540,00 PLN' },
        depreciation: { amount: 241000.0, formatted: '241 000,00 PLN' },
        ebit: { amount: 1834278.92, formatted: '1 834 278,92 PLN' },
        operating_margin_pct: 27.57,
        ebitda: { amount: 2075278.92, formatted: '2 075 278,92 PLN' },
        ebitda_margin_pct: 31.19,
        financial_costs: { amount: 84100.0, formatted: '84 100,00 PLN' },
        tax: { amount: 297173.9, formatted: '297 173,90 PLN' },
        net_profit: { amount: 1453005.02, formatted: '1 453 005,02 PLN' },
        net_margin_pct: 21.84,
    },
    balance_sheet: {
        current_assets: { amount: 6353611.72, formatted: '6 353 611,72 PLN' },
        inventory: { amount: 1662286.2, formatted: '1 662 286,20 PLN' },
        quick_assets: { amount: 4691325.52, formatted: '4 691 325,52 PLN' },
        current_liabilities: { amount: 1774626.91, formatted: '1 774 626,91 PLN' },
    },
    ratios: {
        current_ratio: 3.58,
        quick_ratio: 2.64,
    },
};

const mockBreakdown = [
    { category_name: 'Usługi Obce', amount: 4500000, percentage: 42.8 },
    { category_name: 'Wynagrodzenia i Świadczenia', amount: 3800000, percentage: 36.2 },
    { category_name: 'Zużycie Materiałów i Energii', amount: 2200000, percentage: 21.0 },
];

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
    commentary: 'Spółka wykazuje stabilny wzrost marży EBITDA w badanym horyzoncie czasowym.',
};

describe('ReportConfigurator Component', () => {
    it('renders controls and triggers print callback', () => {
        const onPrint = vi.fn();
        const onExportJson = vi.fn();
        const onChange = vi.fn();

        render(
            <ReportConfigurator
                config={mockConfig}
                onChange={onChange}
                onPrint={onPrint}
                onExportJson={onExportJson}
                onRefresh={vi.fn()}
                loading={false}
            />
        );

        expect(screen.getByText('Konfigurator Parametrów Raportu Zarządczego (Executive Memo)')).toBeInTheDocument();

        // Check print button
        const printBtn = screen.getByTitle(/Drukuj lub zapisz jako wektorowy plik PDF/);
        fireEvent.click(printBtn);
        expect(onPrint).toHaveBeenCalledTimes(1);

        // Check JSON export button
        const jsonBtn = screen.getByTitle(/Eksportuj surowe dane JSON/);
        fireEvent.click(jsonBtn);
        expect(onExportJson).toHaveBeenCalledTimes(1);
    });

    it('toggles report sections when clicked', () => {
        const onChange = vi.fn();

        render(
            <ReportConfigurator
                config={mockConfig}
                onChange={onChange}
                onPrint={vi.fn()}
                onExportJson={vi.fn()}
                onRefresh={vi.fn()}
                loading={false}
            />
        );

        const pnlToggleBtn = screen.getByText('Rachunek Zysków i Strat (P&L Summary)');
        fireEvent.click(pnlToggleBtn);

        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({
                sections: expect.objectContaining({
                    pnl: false,
                }),
            })
        );
    });

    it('renders adaptive dual-theme classes in Light and Dark mode', () => {
        const { unmount } = render(
            <ThemeProvider defaultTheme={THEMES.LIGHT}>
                <ReportConfigurator
                    config={mockConfig}
                    onChange={vi.fn()}
                    onPrint={vi.fn()}
                    onExportJson={vi.fn()}
                    onRefresh={vi.fn()}
                    loading={false}
                />
            </ThemeProvider>
        );

        const configurator = screen.getByTestId('report-configurator');
        expect(configurator.className).toContain('bg-white');
        expect(configurator.className).toContain('dark:bg-zinc-900');
        expect(configurator.className).toContain('border-zinc-200');
        expect(configurator.className).toContain('dark:border-zinc-800');

        unmount();

        render(
            <ThemeProvider defaultTheme={THEMES.DARK}>
                <ReportConfigurator
                    config={mockConfig}
                    onChange={vi.fn()}
                    onPrint={vi.fn()}
                    onExportJson={vi.fn()}
                    onRefresh={vi.fn()}
                    loading={false}
                />
            </ThemeProvider>
        );

        const darkConfigurator = screen.getByTestId('report-configurator');
        expect(darkConfigurator.className).toContain('dark:bg-zinc-900');
    });

    it('renders dynamic NBP exchange rate labels in currency selector', () => {
        const dynamicCurrencies = [
            { code: 'PLN', symbol: 'zł', label: 'Polski Złoty (PLN)' },
            { code: 'EUR', symbol: '€', label: 'Euro (EUR, kurs 4.3125)' },
            { code: 'USD', symbol: '$', label: 'US Dollar (USD, kurs 3.9450)' },
        ];

        render(
            <ReportConfigurator
                config={{ ...mockConfig, currency: 'EUR' }}
                onChange={vi.fn()}
                onPrint={vi.fn()}
                onExportJson={vi.fn()}
                onRefresh={vi.fn()}
                loading={false}
                currencies={dynamicCurrencies}
            />
        );

        const select = screen.getByTestId('report-currency-select');
        expect(select).toBeInTheDocument();
        expect(screen.getByText('EUR – Euro (EUR, kurs 4.3125)')).toBeInTheDocument();
        expect(screen.getByText('USD – US Dollar (USD, kurs 3.9450)')).toBeInTheDocument();
    });
});


describe('ExecutivePdfReport Component', () => {
    it('renders complete executive Due Diligence memorandum with all sections', () => {
        render(
            <ExecutivePdfReport
                company={mockCompany}
                currentUser={mockUser}
                config={mockConfig}
                metrics={mockMetrics}
                trends={[]}
                breakdown={mockBreakdown}
                reportHash="abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
                generatedAt="2026-09-18T20:00:00Z"
            />
        );

        // Header
        expect(screen.getByText('Raport Zarządczy Due Diligence & Analiza Finansowa')).toBeInTheDocument();
        const companyElements = screen.getAllByText('Acme Manufacturing S.A.');
        expect(companyElements.length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('STRICTLY CONFIDENTIAL')).toBeInTheDocument();

        // Section 1: KPI Scorecard
        expect(screen.getByText(/1\. Kluczowe Metryki Wynikowe/)).toBeInTheDocument();
        expect(screen.getByText('Przychody ze Sprzedaży')).toBeInTheDocument();
        expect(screen.getByText('Zysk Brutto (Marża)')).toBeInTheDocument();
        expect(screen.getByText('Wynik EBITDA (Marża)')).toBeInTheDocument();

        // Section 2: P&L Statement
        expect(screen.getByText(/2\. Rachunek Zysków i Strat/)).toBeInTheDocument();
        expect(screen.getByText('(=) ZYSK BRUTTO ZE SPRZEDAŻY (GROSS PROFIT)')).toBeInTheDocument();
        expect(screen.getByText('(=) ZYSK OPERACYJNY PRZED AMORTYZACJĄ (EBITDA)')).toBeInTheDocument();
        expect(screen.getByText('(=) WYNIK FINANSOWY NETTO (NET PROFIT)')).toBeInTheDocument();

        // Section 3: Liquidity
        expect(screen.getByText(/3\. Wskaźniki Płynności Finansowej/)).toBeInTheDocument();
        expect(screen.getByText('Current Ratio (Bieżąca)')).toBeInTheDocument();
        expect(screen.getByText('Quick Ratio (Szybka)')).toBeInTheDocument();

        // Section 4: OPEX Breakdown
        expect(screen.getByText(/4\. Struktura Kosztów Operacyjnych/)).toBeInTheDocument();
        expect(screen.getByText('Usługi Obce')).toBeInTheDocument();
        expect(screen.getByText('Wynagrodzenia i Świadczenia')).toBeInTheDocument();

        // Section 5: Commentary
        expect(screen.getByText(/5\. Opinia i Rekomendacja Doradcy Transakcyjnego/)).toBeInTheDocument();
        expect(screen.getByText(mockConfig.commentary)).toBeInTheDocument();

        // Section 6: Audit & Hashes
        expect(screen.getByText(/CERTYFIKAT INTEGRALNOŚCI DANYCH/)).toBeInTheDocument();
        expect(screen.getByText(/abcdef1234567890abcdef1234567890/)).toBeInTheDocument();
        expect(screen.getByText('Helvest Advisory / Lead Advisor')).toBeInTheDocument();
    });

    it('correctly parses real nested API response metrics (pnl, ratios, balance sheet)', () => {
        render(
            <ExecutivePdfReport
                company={mockCompany}
                currentUser={mockUser}
                config={{ ...mockConfig, periodPreset: '2026' }}
                metrics={mockApiMetrics}
                trends={[]}
                breakdown={mockBreakdown}
                reportHash="abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
                generatedAt="2026-09-18T20:00:00Z"
            />
        );

        // Check that non-zero amounts from nested pnl are rendered in KPI scorecard
        const kpiHeading = screen.getByText(/1\. Kluczowe Metryki Wynikowe/);
        const kpiScorecard = kpiHeading.closest('.space-y-2\\.5') || kpiHeading.parentElement;
        const kpiText = kpiScorecard.textContent.replace(/\s+/g, ' ');
        expect(kpiText).toMatch(/6\s*654\s*223/);
        expect(kpiText).toMatch(/3\s*282\s*818/);
        expect(kpiText).toMatch(/2\s*075\s*278/);
        expect(kpiText).toMatch(/1\s*453\s*005/);

        // Check margins
        expect(screen.getByText('Marża: 49.3%')).toBeInTheDocument();
        expect(screen.getByText('Rentowność: 31.2%')).toBeInTheDocument();
        expect(screen.getByText('Marża netto: 21.8%')).toBeInTheDocument();

        // Check ratios
        expect(screen.getByText('3.58x')).toBeInTheDocument();
        expect(screen.getByText('2.64x')).toBeInTheDocument();

        // Check period label
        expect(screen.getByText('2026-01-01 do 2026-12-31')).toBeInTheDocument();
    });

    it('hides disabled sections according to configuration toggles', () => {
        const restrictedConfig = {
            ...mockConfig,
            sections: {
                kpi: false,
                pnl: false,
                liquidity: false,
                opex: false,
                audit: false,
            },
        };

        render(
            <ExecutivePdfReport
                company={mockCompany}
                currentUser={mockUser}
                config={restrictedConfig}
                metrics={mockMetrics}
                trends={[]}
                breakdown={mockBreakdown}
                reportHash="abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
                generatedAt="2026-09-18T20:00:00Z"
            />
        );

        // Header still appears
        expect(screen.getByText('Raport Zarządczy Due Diligence & Analiza Finansowa')).toBeInTheDocument();

        // Disabled sections should not appear
        expect(screen.queryByText(/1\. Kluczowe Metryki Wynikowe/)).not.toBeInTheDocument();
        expect(screen.queryByText(/2\. Rachunek Zysków i Strat/)).not.toBeInTheDocument();
        expect(screen.queryByText(/3\. Wskaźniki Płynności Finansowej/)).not.toBeInTheDocument();
        expect(screen.queryByText(/4\. Struktura Kosztów Operacyjnych/)).not.toBeInTheDocument();
        expect(screen.queryByText(/CERTYFIKAT INTEGRALNOŚCI DANYCH/)).not.toBeInTheDocument();
    });

    it('maintains consistent P&L row hierarchy, baseline grid alignment, and clean typography', () => {
        render(
            <ExecutivePdfReport
                company={mockCompany}
                currentUser={mockUser}
                config={mockConfig}
                metrics={mockMetrics}
                trends={[]}
                breakdown={mockBreakdown}
                reportHash="abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
                generatedAt="2026-09-18T20:00:00Z"
            />
        );

        // Verify all 9 P&L line items
        const pnlRowLabels = [
            'Przychody ze sprzedaży produktów i usług (Revenue)',
            '(-) Koszt własny sprzedaży (COGS / Direct Costs)',
            '(=) ZYSK BRUTTO ZE SPRZEDAŻY (GROSS PROFIT)',
            '(-) Koszty operacyjne zarządu i sprzedaży (OPEX)',
            '(=) ZYSK OPERACYJNY PRZED AMORTYZACJĄ (EBITDA)',
            '(-) Odpisy amortyzacyjne (D&A)',
            '(=) ZYSK OPERACYJNY (EBIT)',
            '(-) Podatki dochodowe & koszty finansowe',
            '(=) WYNIK FINANSOWY NETTO (NET PROFIT)',
        ];

        pnlRowLabels.forEach(label => {
            const cell = screen.getByText(label);
            expect(cell).toBeInTheDocument();
            // All rows must have uniform px-3 baseline padding and no pl-6 indent
            expect(cell.className).toContain('px-3');
            expect(cell.className).not.toContain('pl-6');
        });

        // Verify classification codes and monospace tabular numbers
        expect(screen.getByText('COGS')).toBeInTheDocument();
        expect(screen.getByText('OPEX')).toBeInTheDocument();
        expect(screen.getByText('D&A')).toBeInTheDocument();
        expect(screen.getByText('TAX / FIN')).toBeInTheDocument();
    });

    it('renders adaptive dual-theme classes and preserves vector print styles', () => {
        const { unmount } = render(
            <ThemeProvider defaultTheme={THEMES.LIGHT}>
                <ExecutivePdfReport
                    company={mockCompany}
                    currentUser={mockUser}
                    config={mockConfig}
                    metrics={mockMetrics}
                    trends={[]}
                    breakdown={mockBreakdown}
                    reportHash="abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
                    generatedAt="2026-09-18T20:00:00Z"
                />
            </ThemeProvider>
        );

        const reportContainer = document.getElementById('executive-pdf-report');
        expect(reportContainer).toBeInTheDocument();
        expect(reportContainer.className).toContain('bg-white');
        expect(reportContainer.className).toContain('dark:bg-zinc-950');
        expect(reportContainer.className).toContain('border-zinc-200');
        expect(reportContainer.className).toContain('dark:border-zinc-800');
        expect(reportContainer.className).toContain('text-zinc-800');
        expect(reportContainer.className).toContain('dark:text-zinc-200');
        expect(reportContainer.className).toContain('print:bg-white');
        expect(reportContainer.className).toContain('print:text-black');

        unmount();

        render(
            <ThemeProvider defaultTheme={THEMES.DARK}>
                <ExecutivePdfReport
                    company={mockCompany}
                    currentUser={mockUser}
                    config={mockConfig}
                    metrics={mockMetrics}
                    trends={[]}
                    breakdown={mockBreakdown}
                    reportHash="abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
                    generatedAt="2026-09-18T20:00:00Z"
                />
            </ThemeProvider>
        );

        const darkReport = document.getElementById('executive-pdf-report');
        expect(darkReport.className).toContain('dark:bg-zinc-950');
    });

    it('embeds official NBP FX citation, watermark, and MSR 21 legal audit citation', () => {
        render(
            <ExecutivePdfReport
                company={mockCompany}
                currentUser={mockUser}
                config={mockConfig}
                metrics={mockMetrics}
                trends={[]}
                breakdown={mockBreakdown}
                reportHash="abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
                generatedAt="2026-09-18T20:00:00Z"
            />
        );

        // Watermark
        const watermark = screen.getByTestId('executive-report-watermark');
        expect(watermark).toBeInTheDocument();
        expect(watermark.textContent).toContain('CONSTANT FX AUDITED');

        // FX citation badge (base currency)
        const fxBadge = screen.getByTestId('fx-citation-badge');
        expect(fxBadge).toBeInTheDocument();
        expect(fxBadge.textContent).toContain('Waluta Bazowa (PLN)');

        // Legal audit citation in Section 6
        const legalCitation = screen.getByTestId('fx-audit-citation');
        expect(legalCitation).toBeInTheDocument();
        expect(legalCitation.textContent).toContain('MSR 21');
        expect(legalCitation.textContent).toContain('art. 30 ust. 2 Ustawy o rachunkowości (UoR)');
        expect(legalCitation.textContent).toContain('Constant FX');

        // Vector footer citation
        const footerCitation = screen.getByTestId('fx-footer-citation');
        expect(footerCitation).toBeInTheDocument();
        expect(footerCitation.textContent).toContain('walutę funkcjonalną PLN');
    });

    it('displays dynamic NBP Table A metadata and exchange rate when foreign currency is selected', () => {
        const ratesMetadata = {
            source: 'NBP',
            tableNo: '062/A/NBP/2026',
            effectiveDate: '2026-03-30',
            fetchedAt: '2026-03-30T10:30:00Z',
            cached: true,
            isFallback: false,
        };

        render(
            <ExecutivePdfReport
                company={mockCompany}
                currentUser={mockUser}
                config={{ ...mockConfig, currency: 'EUR' }}
                metrics={mockMetrics}
                trends={[]}
                breakdown={mockBreakdown}
                reportHash="abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
                generatedAt="2026-09-18T20:00:00Z"
                ratesMetadata={ratesMetadata}
            />
        );

        // Header FX citation badge with NBP Table number
        const fxBadge = screen.getByTestId('fx-citation-badge');
        expect(fxBadge).toBeInTheDocument();
        expect(fxBadge.textContent).toContain('Tabela NBP: 062/A/NBP/2026');

        // Section 6 legal citation with Table A and effective date
        const legalCitation = screen.getByTestId('fx-audit-citation');
        expect(legalCitation).toBeInTheDocument();
        expect(legalCitation.textContent).toContain('Tabeli A nr 062/A/NBP/2026');
        expect(legalCitation.textContent).toContain('2026-03-30');

        // Vector footer citation with NBP Table A details
        const footerCitation = screen.getByTestId('fx-footer-citation');
        expect(footerCitation).toBeInTheDocument();
        expect(footerCitation.textContent).toContain('oficjalną Tabelę A kursów średnich NBP nr 062/A/NBP/2026');
        expect(footerCitation.textContent).toContain('2026-03-30');
    });
});


