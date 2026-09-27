import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DealProvider, useDeal } from '../../context/DealContext';
import { NotificationProvider, useNotification } from '../../context/NotificationContext';
import { ReportConfigurator } from '../../components/reports/ReportConfigurator';
import { ExecutivePdfReport } from '../../components/reports/ExecutivePdfReport';
import { DocumentTable } from '../../components/dataroom/DocumentTable';

// Mock test component integrating Deal Advisory workflow
const DealAdvisoryWorkspace = ({ mockDocuments, mockMetrics }) => {
    const { currency, setCurrency, dealMetadata } = useDeal();
    const { info, success } = useNotification();
    const [reportConfig, setReportConfig] = React.useState({
        title: 'MEMORANDUM TRANSAKCYJNE M&A',
        periodPreset: 'l12m',
        confidentiality: dealMetadata.accessLevel,
        currency: currency,
        commentary: 'Rekomendacja pozytywna dla komitetu inwestycyjnego.',
        signatoryAdvisor: 'Marek Wiśniewski, Partner Helvest Advisory',
        signatoryCfo: 'Jan Kowalski, CFO Acme Manufacturing',
        sections: {
            kpi: true,
            pnl: true,
            liquidity: true,
            opex: true,
            audit: true,
        },
    });

    return (
        <div>
            {/* Top Advisory Bar */}
            <div data-testid="deal-bar">
                <span data-testid="current-currency">{currency}</span>
                <span data-testid="current-confidentiality">{dealMetadata.accessLevel}</span>
                <button
                    onClick={() => {
                        setCurrency('EUR');
                        info('Waluta przeliczona na EUR');
                    }}
                >
                    Zmień na EUR
                </button>
            </div>

            {/* Report Configuration & Generator */}
            <ReportConfigurator
                config={reportConfig}
                onChange={(newCfg) => setReportConfig(newCfg)}
                onPrint={() => success('Raport wygenerowany do druku')}
            />

            <ExecutivePdfReport
                config={reportConfig}
                metrics={mockMetrics}
                currentUser={{ name: 'Marek Wiśniewski' }}
                company={{ name: 'Acme Manufacturing S.A.', code: 'ACME', tax_id: 'PL7010101010' }}
            />

            {/* Virtual Data Room */}
            <DocumentTable
                documents={mockDocuments}
                loading={false}
                onDownload={(doc) => success(`Pobrano dokument: ${doc.title}`)}
                onEdit={() => {}}
                onToggleArchive={() => {}}
                onDelete={() => {}}
                onViewAudit={() => {}}
            />
        </div>
    );
};

describe('E2E Deal Advisory & Collaboration Workflow Integration', () => {
    const mockDocuments = [
        {
            id: 'doc-1',
            title: 'Raport z Audytu Finansowego 2025',
            type: 'audit_report',
            original_name: 'audit_2025.pdf',
            size_bytes: 2048576,
            mime_type: 'application/pdf',
            checksum_sha256: 'a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890',
            download_count: 5,
            is_archived: false,
            created_at: '2026-02-15T10:00:00Z',
        },
        {
            id: 'doc-2',
            title: 'Umowa Spółki Acme i Statut',
            type: 'contract',
            original_name: 'statut_acme.pdf',
            size_bytes: 1048576,
            mime_type: 'application/pdf',
            checksum_sha256: 'fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
            download_count: 2,
            is_archived: false,
            created_at: '2026-02-18T14:30:00Z',
        },
    ];

    const mockMetrics = {
        period: { start: '2026-01-01', end: '2026-12-31', label: '2026-01-01 do 2026-12-31 (FY 2026)' },
        pnl: {
            revenue: { amount: 8500000.0, formatted: '8 500 000,00 PLN' },
            cogs: { amount: 4250000.0, formatted: '4 250 000,00 PLN' },
            gross_profit: { amount: 4250000.0, formatted: '4 250 000,00 PLN' },
            gross_margin_pct: 50.0,
            opex: { amount: 1500000.0, formatted: '1 500 000,00 PLN' },
            depreciation: { amount: 300000.0, formatted: '300 000,00 PLN' },
            ebit: { amount: 2450000.0, formatted: '2 450 000,00 PLN' },
            operating_margin_pct: 28.82,
            ebitda: { amount: 2750000.0, formatted: '2 750 000,00 PLN' },
            ebitda_margin_pct: 32.35,
            financial_costs: { amount: 100000.0, formatted: '100 000,00 PLN' },
            tax: { amount: 446500.0, formatted: '446 500,00 PLN' },
            net_profit: { amount: 1903500.0, formatted: '1 903 500,00 PLN' },
            net_margin_pct: 22.39,
        },
        balance_sheet: {
            current_assets: { amount: 7200000.0, formatted: '7 200 000,00 PLN' },
            inventory: { amount: 1800000.0, formatted: '1 800 000,00 PLN' },
            quick_assets: { amount: 5400000.0, formatted: '5 400 000,00 PLN' },
            current_liabilities: { amount: 2100000.0, formatted: '2 100 000,00 PLN' },
        },
        ratios: {
            current_ratio: 3.43,
            quick_ratio: 2.57,
        },
    };

    it('executes full deal advisory workspace lifecycle: FX switch, VDR download, and PDF integrity check', async () => {
        render(
            <NotificationProvider>
                <DealProvider>
                    <DealAdvisoryWorkspace mockDocuments={mockDocuments} mockMetrics={mockMetrics} />
                </DealProvider>
            </NotificationProvider>
        );

        // 1. Initial State Verification
        expect(screen.getByTestId('current-currency').textContent).toBe('PLN');
        expect(screen.getByTestId('current-confidentiality').textContent).toBe('STRICTLY CONFIDENTIAL');

        // 2. Deal Currency Switching
        const fxBtn = screen.getByText('Zmień na EUR');
        fireEvent.click(fxBtn);
        expect(screen.getByTestId('current-currency').textContent).toBe('EUR');

        // 3. Virtual Data Room Document Verification
        expect(screen.getByText('Raport z Audytu Finansowego 2025')).toBeInTheDocument();
        expect(screen.getByText('Umowa Spółki Acme i Statut')).toBeInTheDocument();

        // 4. Download Trigger in Data Room
        const downloadButtons = screen.getAllByRole('button', { name: /Pobierz dokument/i });
        expect(downloadButtons.length).toBeGreaterThanOrEqual(2);
        fireEvent.click(downloadButtons[0]);

        // 5. Executive PDF Report Integrity & Financial Validation
        expect(screen.getByText(/Raport Zarządczy Due Diligence/i)).toBeInTheDocument();
        const companyMatches = screen.getAllByText('Acme Manufacturing S.A.');
        expect(companyMatches.length).toBeGreaterThanOrEqual(1);

        // Verify KPI values rendered correctly in the report
        const pnlMatches = screen.getAllByText((content, element) => {
            return element?.textContent?.includes('8') && element?.textContent?.includes('500') && element?.textContent?.includes('000');
        });
        expect(pnlMatches.length).toBeGreaterThanOrEqual(1);

        // Verify SHA-256 Integrity Seal exists
        const seal = screen.getByText(/CERTYFIKAT INTEGRALNOŚCI DANYCH/i);
        expect(seal).toBeInTheDocument();

        // Verify Partner signatory block
        const advisorMatches = screen.getAllByText(/Marek Wiśniewski/i);
        expect(advisorMatches.length).toBeGreaterThanOrEqual(1);
    });

    it('allows changing report parameters and recalculating memorandum notes', async () => {
        render(
            <NotificationProvider>
                <DealProvider>
                    <DealAdvisoryWorkspace mockDocuments={mockDocuments} mockMetrics={mockMetrics} />
                </DealProvider>
            </NotificationProvider>
        );

        // Find notes textarea in configurator
        const notesInput = screen.getByDisplayValue(/Rekomendacja pozytywna dla komitetu inwestycyjnego/i);
        fireEvent.change(notesInput, { target: { value: 'Zaktualizowana adnotacja analityczna Due Diligence.' } });

        // Verify dynamic update in ExecutivePdfReport
        const updatedElements = screen.getAllByText('Zaktualizowana adnotacja analityczna Due Diligence.');
        expect(updatedElements.length).toBeGreaterThanOrEqual(1);
    });
});
