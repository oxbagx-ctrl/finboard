import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
    AuditActionBadge,
    getAuditBadgeColorClass,
    AUDIT_ACTION_CONFIG,
    AUDIT_CATEGORY_CONFIG,
} from '../../components/audit/AuditActionBadge';

describe('AuditActionBadge and Audit Palette Harmonization', () => {
    describe('getAuditBadgeColorClass helper', () => {
        it('returns expected Tailwind classes for all harmonized color tokens', () => {
            expect(getAuditBadgeColorClass('emerald')).toContain('bg-emerald-950/70');
            expect(getAuditBadgeColorClass('blue')).toContain('bg-blue-950/70');
            expect(getAuditBadgeColorClass('rose')).toContain('bg-rose-950/70');
            expect(getAuditBadgeColorClass('red')).toContain('bg-red-950/70');
            expect(getAuditBadgeColorClass('amber')).toContain('bg-amber-950/70');
            expect(getAuditBadgeColorClass('indigo')).toContain('bg-indigo-950/70');
            expect(getAuditBadgeColorClass('cyan')).toContain('bg-cyan-950/70');
            expect(getAuditBadgeColorClass('violet')).toContain('bg-violet-950/70');
            expect(getAuditBadgeColorClass('zinc')).toContain('bg-zinc-850');
            expect(getAuditBadgeColorClass('unknown-color')).toContain('bg-zinc-850');
        });
    });

    describe('AuditActionBadge Component Rendering', () => {
        it('renders Financial Record action badges with harmonized color and icon', () => {
            const { unmount } = render(
                <AuditActionBadge action="RECORD_CREATED" testId="badge-create" />
            );
            const createBadge = screen.getByTestId('badge-create');
            expect(createBadge).toHaveTextContent('Utworzenie rekordu finansowego');
            expect(createBadge.className).toContain('bg-emerald-950/70');
            expect(createBadge.querySelector('svg')).toBeInTheDocument();
            unmount();

            render(<AuditActionBadge action="RECORD_UPDATED" testId="badge-update" />);
            const updateBadge = screen.getByTestId('badge-update');
            expect(updateBadge).toHaveTextContent('Modyfikacja rekordu finansowego');
            expect(updateBadge.className).toContain('bg-blue-950/70');
            expect(updateBadge.querySelector('svg')).toBeInTheDocument();
        });

        it('renders single and batch deletion badges with rose palette and distinct icons', () => {
            const { unmount } = render(
                <AuditActionBadge action="RECORD_DELETED" testId="badge-del" />
            );
            const delBadge = screen.getByTestId('badge-del');
            expect(delBadge).toHaveTextContent('Usunięcie rekordu finansowego');
            expect(delBadge.className).toContain('bg-rose-950/70');
            expect(delBadge.querySelector('svg')).toBeInTheDocument();
            unmount();

            render(<AuditActionBadge action="RECORDS_BATCH_DELETED" testId="badge-batch-del" />);
            const batchBadge = screen.getByTestId('badge-batch-del');
            expect(batchBadge).toHaveTextContent('Masowe usunięcie rekordów finansowych');
            expect(batchBadge.className).toContain('bg-rose-950/70');
            expect(batchBadge.querySelector('svg')).toBeInTheDocument();
        });

        it('renders benchmark category badges with indigo and amber palettes', () => {
            const { unmount } = render(
                <AuditActionBadge action="BENCHMARK_CONFIGURED" testId="badge-bench-cfg" />
            );
            const cfgBadge = screen.getByTestId('badge-bench-cfg');
            expect(cfgBadge).toHaveTextContent('Konfiguracja celu finansowego');
            expect(cfgBadge.className).toContain('bg-indigo-950/70');
            unmount();

            render(<AuditActionBadge action="BENCHMARK_RESET" testId="badge-bench-rst" />);
            const rstBadge = screen.getByTestId('badge-bench-rst');
            expect(rstBadge).toHaveTextContent('Reset celów benchmarkowych');
            expect(rstBadge.className).toContain('bg-amber-950/70');
        });

        it('renders CSV import category badges for processed and failed states', () => {
            const { unmount } = render(
                <AuditActionBadge action="CSV_IMPORT_PROCESSED" testId="badge-imp-ok" />
            );
            const okBadge = screen.getByTestId('badge-imp-ok');
            expect(okBadge).toHaveTextContent('Asynchroniczny import danych CSV');
            expect(okBadge.className).toContain('bg-cyan-950/70');
            unmount();

            render(<AuditActionBadge action="CSV_IMPORT_FAILED" testId="badge-imp-fail" />);
            const failBadge = screen.getByTestId('badge-imp-fail');
            expect(failBadge).toHaveTextContent('Niepowodzenie importu CSV');
            expect(failBadge.className).toContain('bg-red-950/70');
        });

        it('renders analytics metrics evaluation badge with violet palette', () => {
            render(<AuditActionBadge action="METRICS_EVALUATED" testId="badge-metrics" />);
            const metricsBadge = screen.getByTestId('badge-metrics');
            expect(metricsBadge).toHaveTextContent('Ewaluacja wskaźników KPI');
            expect(metricsBadge.className).toContain('bg-violet-950/70');
        });

        it('renders VDR document actions with harmonized styling', () => {
            const { unmount: u1 } = render(<AuditActionBadge action="upload" testId="badge-vdr-up" />);
            expect(screen.getByTestId('badge-vdr-up')).toHaveTextContent('Upload');
            expect(screen.getByTestId('badge-vdr-up').className).toContain('bg-emerald-950/70');
            u1();

            const { unmount: u2 } = render(<AuditActionBadge action="download" testId="badge-vdr-dl" />);
            expect(screen.getByTestId('badge-vdr-dl')).toHaveTextContent('Pobranie');
            expect(screen.getByTestId('badge-vdr-dl').className).toContain('bg-blue-950/70');
            u2();

            const { unmount: u3 } = render(<AuditActionBadge action="archive" testId="badge-vdr-arch" />);
            expect(screen.getByTestId('badge-vdr-arch')).toHaveTextContent('Archiwizacja');
            expect(screen.getByTestId('badge-vdr-arch').className).toContain('bg-amber-950/70');
            u3();

            const { unmount: u4 } = render(<AuditActionBadge action="unarchive" testId="badge-vdr-unarch" />);
            expect(screen.getByTestId('badge-vdr-unarch')).toHaveTextContent('Przywrócenie');
            expect(screen.getByTestId('badge-vdr-unarch').className).toContain('bg-zinc-850');
            u4();

            const { unmount: u5 } = render(<AuditActionBadge action="update" testId="badge-vdr-upd" />);
            expect(screen.getByTestId('badge-vdr-upd')).toHaveTextContent('Modyfikacja');
            expect(screen.getByTestId('badge-vdr-upd').className).toContain('bg-blue-950/70');
            u5();

            render(<AuditActionBadge action="destroy" testId="badge-vdr-del" />);
            expect(screen.getByTestId('badge-vdr-del')).toHaveTextContent('Usunięcie');
            expect(screen.getByTestId('badge-vdr-del').className).toContain('bg-rose-950/70');
        });

        it('allows custom override of label, color, and hidden icon', () => {
            render(
                <AuditActionBadge
                    action="RECORD_UPDATED"
                    label="Własna Modyfikacja"
                    color="amber"
                    showIcon={false}
                    testId="badge-custom"
                />
            );
            const customBadge = screen.getByTestId('badge-custom');
            expect(customBadge).toHaveTextContent('Własna Modyfikacja');
            expect(customBadge.className).toContain('bg-amber-950/70');
            expect(customBadge.querySelector('svg')).toBeNull();
        });

        it('gracefully handles unknown action strings with fallback styling', () => {
            render(<AuditActionBadge action="UNKNOWN_CUSTOM_ACTION" testId="badge-unknown" />);
            const unknownBadge = screen.getByTestId('badge-unknown');
            expect(unknownBadge).toHaveTextContent('UNKNOWN_CUSTOM_ACTION');
            expect(unknownBadge.className).toContain('bg-zinc-850');
            expect(unknownBadge.querySelector('svg')).toBeInTheDocument();
        });
    });

    describe('Audit category definitions', () => {
        it('maps all primary action categories correctly', () => {
            expect(AUDIT_CATEGORY_CONFIG.financial_record.color).toBe('blue');
            expect(AUDIT_CATEGORY_CONFIG.benchmark.color).toBe('indigo');
            expect(AUDIT_CATEGORY_CONFIG.import.color).toBe('cyan');
            expect(AUDIT_CATEGORY_CONFIG.analytics.color).toBe('violet');
            expect(AUDIT_CATEGORY_CONFIG.document.color).toBe('emerald');
        });
    });
});
