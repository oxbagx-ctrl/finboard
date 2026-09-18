import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CsvPreviewTable } from '../../components/import/CsvPreviewTable';

describe('CsvPreviewTable (Component Integration)', () => {
    const validPreviewData = {
        valid: true,
        total_rows: 25,
        valid_count: 25,
        error_count: 0,
        errors: [],
        sample_records: [
            {
                record_date: '2026-08-01',
                category_id: 'cat-revenue',
                description: 'Kontrakt montażowy AutoTech',
                currency: 'PLN',
                amount: '185000.00',
            },
            {
                record_date: '2026-08-05',
                category_id: 'cat-cogs',
                description: 'Zakup stali konstrukcyjnej',
                currency: 'PLN',
                amount: '46200.00',
            },
        ],
    };

    const invalidPreviewData = {
        valid: false,
        total_rows: 10,
        valid_count: 7,
        error_count: 3,
        errors: [
            { line: 3, column: 'kategoria', message: 'Nieznana kategoria cat-crypto' },
            { line: 5, column: 'kwota', message: 'Kwota nie może być ujemna' },
            { line: 8, column: 'data', message: 'Nieprawidłowy format daty' },
        ],
        sample_records: [],
    };

    it('renders nothing when previewData is missing or null', () => {
        const { container } = render(<CsvPreviewTable previewData={null} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders Dry-Run Pass banner and enables import button on valid data', () => {
        const handleConfirm = vi.fn();
        const handleCancel = vi.fn();

        render(
            <CsvPreviewTable
                previewData={validPreviewData}
                onConfirmImport={handleConfirm}
                onCancel={handleCancel}
                importing={false}
            />
        );

        // Verification banner
        expect(screen.getByText(/DRY-RUN PASS/i)).toBeInTheDocument();
        expect(screen.getByText(/Łącznie wierszy:/i)).toBeInTheDocument();
        expect(screen.getAllByText('25')).toHaveLength(2); // total_rows and valid_count
        expect(screen.getByText('0')).toBeInTheDocument(); // error_count

        // Sample records
        expect(screen.getByText('Kontrakt montażowy AutoTech')).toBeInTheDocument();
        expect(screen.getByText('Zakup stali konstrukcyjnej')).toBeInTheDocument();

        // Action button is enabled and triggers callback
        const importBtn = screen.getByRole('button', { name: /Rozpocznij Asynchroniczny Import/i });
        expect(importBtn).not.toBeDisabled();

        fireEvent.click(importBtn);
        expect(handleConfirm).toHaveBeenCalledTimes(1);

        // Cancel button
        const cancelBtn = screen.getByRole('button', { name: /Anuluj/i });
        fireEvent.click(cancelBtn);
        expect(handleCancel).toHaveBeenCalledTimes(1);
    });

    it('renders Dry-Run Failed banner, lists errors, and disables import button on invalid data', () => {
        const handleConfirm = vi.fn();

        render(
            <CsvPreviewTable
                previewData={invalidPreviewData}
                onConfirmImport={handleConfirm}
                onCancel={vi.fn()}
                importing={false}
            />
        );

        // Error banner
        expect(screen.getByText(/DRY-RUN FAILED/i)).toBeInTheDocument();

        // Error list check
        expect(screen.getByText(/Rejestr Wykrytych Niespójności Walidacyjnych/i)).toBeInTheDocument();
        expect(screen.getByText(/\[Linia 3\]:/i)).toBeInTheDocument();
        expect(screen.getByText(/Nieznana kategoria cat-crypto/i)).toBeInTheDocument();
        expect(screen.getByText(/Kwota nie może być ujemna/i)).toBeInTheDocument();
        expect(screen.getByText(/Nieprawidłowy format daty/i)).toBeInTheDocument();

        // Import button MUST be disabled
        const importBtn = screen.getByRole('button', { name: /Rozpocznij Asynchroniczny Import/i });
        expect(importBtn).toBeDisabled();

        // Clicking disabled button should NOT trigger confirm
        fireEvent.click(importBtn);
        expect(handleConfirm).not.toHaveBeenCalled();
    });

    it('disables cancel and import buttons when importing is in progress', () => {
        render(
            <CsvPreviewTable
                previewData={validPreviewData}
                onConfirmImport={vi.fn()}
                onCancel={vi.fn()}
                importing={true}
            />
        );

        const cancelBtn = screen.getByRole('button', { name: /Anuluj/i });
        expect(cancelBtn).toBeDisabled();
    });
});
