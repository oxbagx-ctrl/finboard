import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BatchDeleteConfirmationModal } from '../../components/finance/BatchDeleteConfirmationModal';

describe('BatchDeleteConfirmationModal Component', () => {
    it('renders null when isOpen is false', () => {
        const { container } = render(
            <BatchDeleteConfirmationModal
                isOpen={false}
                onClose={vi.fn()}
                onConfirm={vi.fn()}
                selectedCount={5}
                totalAmount={1000}
            />
        );

        expect(container.firstChild).toBeNull();
    });

    it('renders summary and breakdown metrics without keyword requirement when count <= 10', () => {
        const handleConfirm = vi.fn();
        const handleClose = vi.fn();

        render(
            <BatchDeleteConfirmationModal
                isOpen={true}
                onClose={handleClose}
                onConfirm={handleConfirm}
                selectedCount={4}
                totalAmount={15450.5}
                incomeAmount={20000}
                expenseAmount={4549.5}
                currency="PLN"
            />
        );

        expect(screen.getByTestId('batch-delete-modal')).toBeInTheDocument();
        expect(screen.getByTestId('batch-modal-count')).toHaveTextContent('4');
        expect(screen.getByTestId('batch-modal-total')).toHaveTextContent(/15[\s\u00A0]?450,50[\s\u00A0]?zł/);
        expect(screen.getByTestId('batch-modal-income')).toHaveTextContent(/20[\s\u00A0]?000,00[\s\u00A0]?zł/);
        expect(screen.getByTestId('batch-modal-expense')).toHaveTextContent(/4[\s\u00A0]?549,50[\s\u00A0]?zł/);

        // Keyword confirmation is NOT required for count <= 10
        expect(screen.queryByTestId('batch-keyword-section')).toBeNull();

        const confirmBtn = screen.getByTestId('batch-confirm-delete-btn');
        expect(confirmBtn).not.toBeDisabled();

        fireEvent.click(confirmBtn);
        expect(handleConfirm).toHaveBeenCalledTimes(1);
    });

    it('requires typing "USUŃ" keyword when selectedCount > 10', () => {
        const handleConfirm = vi.fn();

        render(
            <BatchDeleteConfirmationModal
                isOpen={true}
                onClose={vi.fn()}
                onConfirm={handleConfirm}
                selectedCount={12}
                totalAmount={50000}
                currency="PLN"
            />
        );

        expect(screen.getByTestId('batch-keyword-section')).toBeInTheDocument();
        const confirmBtn = screen.getByTestId('batch-confirm-delete-btn');
        expect(confirmBtn).toBeDisabled();

        const input = screen.getByTestId('batch-confirm-input');

        // Invalid keyword
        fireEvent.change(input, { target: { value: 'NIE' } });
        expect(confirmBtn).toBeDisabled();

        // Valid keyword (case-insensitive)
        fireEvent.change(input, { target: { value: 'usuń' } });
        expect(confirmBtn).not.toBeDisabled();

        fireEvent.click(confirmBtn);
        expect(handleConfirm).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when close or cancel buttons are clicked', () => {
        const handleClose = vi.fn();

        render(
            <BatchDeleteConfirmationModal
                isOpen={true}
                onClose={handleClose}
                onConfirm={vi.fn()}
                selectedCount={3}
                totalAmount={1000}
            />
        );

        fireEvent.click(screen.getByTestId('batch-modal-close-btn'));
        expect(handleClose).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByTestId('batch-modal-cancel-btn'));
        expect(handleClose).toHaveBeenCalledTimes(2);
    });

    it('disables controls and displays loading state when loading is true', () => {
        render(
            <BatchDeleteConfirmationModal
                isOpen={true}
                onClose={vi.fn()}
                onConfirm={vi.fn()}
                selectedCount={15}
                totalAmount={1000}
                loading={true}
            />
        );

        expect(screen.getByTestId('batch-modal-close-btn')).toBeDisabled();
        expect(screen.getByTestId('batch-modal-cancel-btn')).toBeDisabled();
        expect(screen.getByTestId('batch-confirm-input')).toBeDisabled();
        expect(screen.getByTestId('batch-confirm-delete-btn')).toBeDisabled();
        expect(screen.getByTestId('batch-confirm-delete-btn')).toHaveTextContent('Usuwanie...');
    });

    it('disables confirmation and displays limit exceeded alert when selectedCount exceeds 500', () => {
        const handleConfirm = vi.fn();

        render(
            <BatchDeleteConfirmationModal
                isOpen={true}
                onClose={vi.fn()}
                onConfirm={handleConfirm}
                selectedCount={501}
                totalAmount={999999}
            />
        );

        expect(screen.getByTestId('batch-limit-exceeded-alert')).toBeInTheDocument();
        expect(screen.getByTestId('batch-confirm-delete-btn')).toBeDisabled();
        // Keyword section should not be shown when exceeded
        expect(screen.queryByTestId('batch-keyword-section')).toBeNull();

        fireEvent.click(screen.getByTestId('batch-confirm-delete-btn'));
        expect(handleConfirm).not.toHaveBeenCalled();
    });
});
