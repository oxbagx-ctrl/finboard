import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateFolderModal } from '../../components/dataroom/CreateFolderModal';
import { NotificationProvider } from '../../context/NotificationContext';
import apiClient from '../../api/client';

vi.mock('../../api/client', () => ({
    default: {
        post: vi.fn(),
    },
}));

const mockFolders = [
    {
        id: 'f-1',
        index_code: '01.00',
        name: 'Informacje Korporacyjne',
        children: [
            {
                id: 'f-1-1',
                index_code: '01.01',
                name: 'Umowy Spółki',
                children: [],
            },
        ],
    },
    {
        id: 'f-2',
        index_code: '02.00',
        name: 'Finanse',
        children: [],
    },
];

const renderComponent = (props = {}) => {
    return render(
        <NotificationProvider>
            <CreateFolderModal
                isOpen={true}
                onClose={vi.fn()}
                onSuccess={vi.fn()}
                folders={mockFolders}
                {...props}
            />
        </NotificationProvider>
    );
};

describe('CreateFolderModal Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not render when isOpen is false', () => {
        render(
            <NotificationProvider>
                <CreateFolderModal isOpen={false} onClose={vi.fn()} onSuccess={vi.fn()} />
            </NotificationProvider>
        );

        expect(screen.queryByText('Nowy Folder Transakcyjny (Dewey)')).not.toBeInTheDocument();
    });

    it('renders form elements and parent folder choices', () => {
        renderComponent();

        expect(screen.getByText('Nowy Folder Transakcyjny (Dewey)')).toBeInTheDocument();
        expect(screen.getByText('Folder Nadrzędny (Katalog)')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('np. 01.00 lub 01.01.02')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('np. Umowy Finansowania i Kredyty')).toBeInTheDocument();

        // Check options
        expect(screen.getByText('— Kategoria Główna (Root) —')).toBeInTheDocument();
        expect(screen.getByText('[01.00] Informacje Korporacyjne')).toBeInTheDocument();
    });

    it('validates required fields and rejects invalid Dewey format', async () => {
        renderComponent();

        const form = screen.getByRole('button', { name: /Utwórz Folder/i }).closest('form');
        fireEvent.submit(form);

        expect(await screen.findByText('Nazwa folderu transakcyjnego jest wymagana.')).toBeInTheDocument();
        expect(await screen.findByText('Kod indeksu dziesiętnego Dewey jest wymagany.')).toBeInTheDocument();

        // Invalid regex format
        const indexInput = screen.getByPlaceholderText('np. 01.00 lub 01.01.02');
        const nameInput = screen.getByPlaceholderText('np. Umowy Finansowania i Kredyty');
        fireEvent.change(nameInput, { target: { value: 'Poprawna nazwa' } });
        fireEvent.change(indexInput, { target: { value: 'invalid_code!' } });
        fireEvent.submit(form);

        expect(await screen.findByText('Niepoprawny format kodu Dewey (dozwolone np. 01.00 lub 01.01.02).')).toBeInTheDocument();
    });

    it('submits valid folder data and triggers onSuccess callback', async () => {
        const handleSuccess = vi.fn();
        const handleClose = vi.fn();

        apiClient.post.mockResolvedValueOnce({
            data: {
                data: {
                    id: 'new-f-1',
                    name: 'Nieruchomości i Środki Trwałe',
                    index_code: '04.00',
                },
            },
        });

        renderComponent({ onSuccess: handleSuccess, onClose: handleClose });

        fireEvent.change(screen.getByPlaceholderText('np. 01.00 lub 01.01.02'), {
            target: { value: '04.00' },
        });
        fireEvent.change(screen.getByPlaceholderText('np. Umowy Finansowania i Kredyty'), {
            target: { value: 'Nieruchomości i Środki Trwałe' },
        });

        const submitBtn = screen.getByRole('button', { name: /Utwórz Folder/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(apiClient.post).toHaveBeenCalledWith('/documents/folders', {
                name: 'Nieruchomości i Środki Trwałe',
                index_code: '04.00',
                parent_id: null,
                description: null,
                sort_order: 10,
            });
        });

        await waitFor(() => {
            expect(handleSuccess).toHaveBeenCalled();
            expect(handleClose).toHaveBeenCalled();
        });
    });

    it('suggests index code prefix when choosing parent folder', () => {
        renderComponent();

        const parentSelect = screen.getByRole('combobox');
        fireEvent.change(parentSelect, { target: { value: 'f-1-1' } }); // Umowy Spółki 01.01

        const indexInput = screen.getByPlaceholderText('np. 01.00 lub 01.01.02');
        expect(indexInput.value).toBe('01.01.');
    });
});
