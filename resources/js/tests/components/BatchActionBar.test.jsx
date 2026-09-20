import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BatchActionBar } from '../../components/finance/BatchActionBar';

describe('BatchActionBar Component', () => {
    it('renders null when selectedCount is 0', () => {
        const { container } = render(
            <BatchActionBar
                selectedCount={0}
                totalAmount={0}
                currency="PLN"
                onClearSelection={vi.fn()}
                onOpenBatchDelete={vi.fn()}
            />
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders floating action bar with selected count and total amount', () => {
        render(
            <BatchActionBar
                selectedCount={4}
                totalAmount={15450.5}
                currency="PLN"
                onClearSelection={vi.fn()}
                onOpenBatchDelete={vi.fn()}
            />
        );

        expect(screen.getByTestId('batch-action-bar')).toBeInTheDocument();
        expect(screen.getByTestId('batch-selected-count')).toHaveTextContent('4');
        expect(screen.getByTestId('batch-total-amount')).toHaveTextContent('15 450,50 zł');
        expect(screen.getByTestId('batch-clear-btn')).toBeInTheDocument();
        expect(screen.getByTestId('batch-delete-btn')).toBeInTheDocument();
    });

    it('calls onClearSelection when clear button is clicked', () => {
        const handleClear = vi.fn();
        render(
            <BatchActionBar
                selectedCount={2}
                totalAmount={2000}
                currency="PLN"
                onClearSelection={handleClear}
                onOpenBatchDelete={vi.fn()}
            />
        );

        fireEvent.click(screen.getByTestId('batch-clear-btn'));
        expect(handleClear).toHaveBeenCalledTimes(1);
    });

    it('calls onOpenBatchDelete when delete button is clicked', () => {
        const handleDelete = vi.fn();
        render(
            <BatchActionBar
                selectedCount={2}
                totalAmount={2000}
                currency="PLN"
                onClearSelection={vi.fn()}
                onOpenBatchDelete={handleDelete}
            />
        );

        fireEvent.click(screen.getByTestId('batch-delete-btn'));
        expect(handleDelete).toHaveBeenCalledTimes(1);
    });

    it('displays income and expense breakdown when both are present', () => {
        render(
            <BatchActionBar
                selectedCount={5}
                totalAmount={8000}
                incomeAmount={10000}
                expenseAmount={2000}
                currency="EUR"
                onClearSelection={vi.fn()}
                onOpenBatchDelete={vi.fn()}
            />
        );

        expect(screen.getByText(/\+\s*10[\s\u00A0]?000,00[\s\u00A0]?€/)).toBeInTheDocument();
        expect(screen.getByText(/-\s*2[\s\u00A0]?000,00[\s\u00A0]?€/)).toBeInTheDocument();
    });
});
