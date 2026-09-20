import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FinancialAuditDetailModal } from '../../components/audit/FinancialAuditDetailModal';

describe('FinancialAuditDetailModal Component', () => {
    const mockUpdateLog = {
        id: 'aud-001-uuid-1234',
        company_id: 'comp-acme-1',
        action: 'RECORD_UPDATED',
        action_label: 'Modyfikacja rekordu finansowego',
        action_color: 'blue',
        action_category: 'financial_record',
        entity_type: 'financial_record',
        entity_id: 'rec-001',
        description: 'Zaktualizowano kwotę z 20 000 zł na 25 000 zł dla maszyn produkcyjnych',
        old_values: {
            amount: 20000,
            currency: 'PLN',
            category: 'Sprzedaż maszyn',
            record_date: '2026-03-01',
            description: 'Stara faktura za maszyny',
        },
        new_values: {
            amount: 25000,
            currency: 'PLN',
            category: 'Sprzedaż maszyn',
            record_date: '2026-03-01',
            description: 'Zaktualizowana faktura za maszyny',
        },
        user_id: 'u-1',
        user: {
            id: 'u-1',
            name: 'Jan Kowalski',
            email: 'jan.kowalski@acme.com',
            role: 'advisor',
        },
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0 (FinBoard Terminal Client)',
        created_at: '2026-09-20T14:30:00.000000Z',
    };

    it('renders null when isOpen is false or log is null', () => {
        const { container: container1 } = render(
            <FinancialAuditDetailModal isOpen={false} onClose={vi.fn()} log={mockUpdateLog} />
        );
        expect(container1.firstChild).toBeNull();

        const { container: container2 } = render(
            <FinancialAuditDetailModal isOpen={true} onClose={vi.fn()} log={null} />
        );
        expect(container2.firstChild).toBeNull();
    });

    it('renders full metadata, operator profile, and formatted JSON snapshots for record update', () => {
        const handleClose = vi.fn();

        render(
            <FinancialAuditDetailModal
                isOpen={true}
                onClose={handleClose}
                log={mockUpdateLog}
            />
        );

        // Modal container is rendered
        expect(screen.getByTestId('financial-audit-detail-modal')).toBeInTheDocument();

        // Header elements
        expect(screen.getByText('Inspekcja Wpisu Audytowego')).toBeInTheDocument();
        expect(screen.getByTestId('audit-modal-action-badge')).toHaveTextContent('Modyfikacja rekordu finansowego');
        expect(screen.getByText(/ID: aud-001-uuid-1234/)).toBeInTheDocument();

        // Description
        expect(screen.getByText(/Zaktualizowano kwotę z 20 000 zł na 25 000 zł/)).toBeInTheDocument();

        // Operator
        const operatorSection = screen.getByTestId('audit-modal-operator');
        expect(operatorSection).toHaveTextContent('Jan Kowalski');
        expect(operatorSection).toHaveTextContent('jan.kowalski@acme.com');
        expect(screen.getByText('advisor')).toBeInTheDocument();

        // Network and Entity
        expect(screen.getByTestId('audit-modal-ip')).toHaveTextContent('192.168.1.100');
        expect(screen.getByTestId('audit-modal-entity-id')).toHaveTextContent('rec-001');
        expect(screen.getByText('financial_record')).toBeInTheDocument();

        // JSON Snapshots
        const oldValContainer = screen.getByTestId('audit-modal-old-values');
        expect(oldValContainer).toHaveTextContent('"amount": 20000');
        expect(oldValContainer).toHaveTextContent('"description": "Stara faktura za maszyny"');

        const newValContainer = screen.getByTestId('audit-modal-new-values');
        expect(newValContainer).toHaveTextContent('"amount": 25000');
        expect(newValContainer).toHaveTextContent('"description": "Zaktualizowana faktura za maszyny"');

        // Not a deletion, so deletion summary banner is absent
        expect(screen.queryByTestId('audit-modal-deleted-summary')).toBeNull();
    });

    it('renders prominent deletion summary and handles null new_values for single RECORD_DELETED event', () => {
        const deleteLog = {
            id: 'aud-del-002',
            company_id: 'comp-acme-1',
            action: 'RECORD_DELETED',
            action_label: 'Usunięcie rekordu finansowego',
            action_color: 'rose',
            action_category: 'financial_record',
            entity_type: 'financial_record',
            entity_id: 'rec-del-88',
            description: 'Usunięto transakcję kosztową: Wynagrodzenia',
            old_values: {
                amount: 8500,
                currency: 'PLN',
                category: 'Wynagrodzenia',
                record_type: 'EXPENSE',
                record_date: '2026-03-05',
                description: 'Wynagrodzenie marzec',
            },
            new_values: null,
            user_id: 'u-2',
            user: {
                id: 'u-2',
                name: 'Anna Dyrektor',
                email: 'anna@acme.com',
                role: 'admin',
            },
            ip_address: '10.0.0.5',
            created_at: '2026-09-20T16:00:00.000000Z',
        };

        render(
            <FinancialAuditDetailModal
                isOpen={true}
                onClose={vi.fn()}
                log={deleteLog}
            />
        );

        // Deletion summary banner is present
        const summary = screen.getByTestId('audit-modal-deleted-summary');
        expect(summary).toBeInTheDocument();
        expect(summary).toHaveTextContent(/8[\s\u00A0]?500,00[\s\u00A0]?zł/);
        expect(summary).toHaveTextContent('2026-03-05');
        expect(summary).toHaveTextContent('Wynagrodzenia');

        // Old values contains JSON
        expect(screen.getByTestId('audit-modal-old-values')).toHaveTextContent('"amount": 8500');

        // New values has empty fallback state
        expect(screen.getByTestId('audit-modal-new-values')).toHaveTextContent(/Brak nowych wartości/);
    });

    it('renders batch deletion summary with count and aggregated amount for RECORDS_BATCH_DELETED event', () => {
        const batchDeleteLog = {
            id: 'aud-batch-del-003',
            company_id: 'comp-acme-1',
            action: 'RECORDS_BATCH_DELETED',
            action_label: 'Masowe usunięcie rekordów finansowych',
            action_color: 'rose',
            action_category: 'financial_record',
            entity_type: 'financial_record',
            entity_id: 'comp-acme-1',
            description: 'Masowo usunięto 4 operacji o łącznej kwocie 34 500,00 PLN',
            old_values: {
                count: 4,
                total_amount: 34500,
                record_ids: ['rec-1', 'rec-2', 'rec-3', 'rec-4'],
            },
            new_values: null,
            user: {
                id: 'u-1',
                name: 'Jan Kowalski',
                email: 'jan@acme.com',
                role: 'admin',
            },
            ip_address: '127.0.0.1',
            created_at: '2026-09-20T18:00:00.000000Z',
        };

        render(
            <FinancialAuditDetailModal
                isOpen={true}
                onClose={vi.fn()}
                log={batchDeleteLog}
            />
        );

        const summary = screen.getByTestId('audit-modal-deleted-summary');
        expect(summary).toBeInTheDocument();
        expect(summary).toHaveTextContent('4 rekordów');
        expect(summary).toHaveTextContent(/34[\s\u00A0]?500,00[\s\u00A0]?zł/);
    });

    it('handles empty/null old_values gracefully for initial RECORD_CREATED event', () => {
        const createLog = {
            id: 'aud-create-004',
            company_id: 'comp-acme-1',
            action: 'RECORD_CREATED',
            action_label: 'Utworzenie rekordu finansowego',
            action_color: 'emerald',
            action_category: 'financial_record',
            entity_type: 'financial_record',
            entity_id: 'rec-new-1',
            description: 'Utworzono nowy rekord przychodowy',
            old_values: null,
            new_values: {
                amount: 15000,
                currency: 'PLN',
                record_type: 'INCOME',
            },
            user: null,
            ip_address: null,
            created_at: '2026-09-20T19:00:00.000000Z',
        };

        render(
            <FinancialAuditDetailModal
                isOpen={true}
                onClose={vi.fn()}
                log={createLog}
            />
        );

        // Fallback for null old_values
        expect(screen.getByTestId('audit-modal-old-values')).toHaveTextContent(/Brak wartości początkowych/);

        // Populated new_values
        expect(screen.getByTestId('audit-modal-new-values')).toHaveTextContent('"amount": 15000');

        // Fallbacks for missing user and IP
        expect(screen.getByTestId('audit-modal-operator')).toHaveTextContent('System / Zadanie Automatyczne');
        expect(screen.getByTestId('audit-modal-ip')).toHaveTextContent('127.0.0.1 / Wewnętrzny');
    });

    it('handles closing via header close button, footer button, Escape key, and backdrop click', () => {
        const handleClose = vi.fn();

        const { rerender } = render(
            <FinancialAuditDetailModal
                isOpen={true}
                onClose={handleClose}
                log={mockUpdateLog}
            />
        );

        // 1. Header close button
        fireEvent.click(screen.getByTestId('audit-modal-close-btn'));
        expect(handleClose).toHaveBeenCalledTimes(1);

        // 2. Footer close button
        fireEvent.click(screen.getByTestId('audit-modal-footer-close-btn'));
        expect(handleClose).toHaveBeenCalledTimes(2);

        // 3. Escape key press
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(handleClose).toHaveBeenCalledTimes(3);

        // 4. Backdrop click
        const backdrop = screen.getByTestId('financial-audit-detail-modal');
        fireEvent.click(backdrop);
        expect(handleClose).toHaveBeenCalledTimes(4);

        // 5. Clicking inside modal container should NOT close (stopPropagation)
        const modalContent = screen.getByText('Inspekcja Wpisu Audytowego');
        fireEvent.click(modalContent);
        expect(handleClose).toHaveBeenCalledTimes(4);
    });
});
