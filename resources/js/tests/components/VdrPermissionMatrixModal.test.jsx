import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VdrPermissionMatrixModal } from '../../components/dataroom/VdrPermissionMatrixModal';
import { NotificationProvider } from '../../context/NotificationContext';
import apiClient from '../../api/client';

vi.mock('../../api/client', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
    },
}));

vi.mock('../../context/AuthContext', () => ({
    useAuth: () => ({
        activeCompany: { id: 'comp-100', name: 'Acme Sp. z o.o.' },
        user: { id: 'user-admin', role: 'admin' },
    }),
}));

const mockFolders = [
    { id: 'folder-1', name: 'Finanse', index_code: '01.00' },
    { id: 'folder-2', name: 'Prawne', index_code: '02.00' },
];

const mockDocuments = [
    { id: 'doc-1', title: 'Bilans 2025', original_name: 'bilans.pdf' },
    { id: 'doc-2', title: 'Umowa Spółki', original_name: 'umowa.pdf' },
];

const mockMatrixData = {
    folder_permissions: [
        {
            id: 'grant-f-1',
            folder_id: 'folder-1',
            folder_name: 'Finanse',
            folder_index_code: '01.00',
            subject_type: 'role',
            subject_id: 'client',
            subject_label: 'Rola: Klient (client)',
            permission_level: 'view',
            watermark_required: true,
            created_at: '2026-03-01T12:00:00Z',
        },
    ],
    document_permissions: [
        {
            id: 'grant-d-1',
            document_id: 'doc-1',
            document_title: 'Bilans 2025',
            subject_type: 'user',
            subject_id: 'user-123',
            subject_label: 'Użytkownik: user-123',
            permission_level: 'download',
            watermark_required: false,
            created_at: '2026-03-02T14:00:00Z',
        },
    ],
    available_roles: ['client', 'advisor'],
    available_levels: ['none', 'view', 'download', 'manage'],
};

describe('VdrPermissionMatrixModal Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.confirm = vi.fn(() => true);
        apiClient.get.mockResolvedValue({
            data: { data: mockMatrixData },
        });
        apiClient.post.mockResolvedValue({
            data: { success: true },
        });
        apiClient.delete.mockResolvedValue({
            data: { success: true },
        });
    });

    it('does not render when isOpen is false', () => {
        render(
            <NotificationProvider>
                <VdrPermissionMatrixModal
                    isOpen={false}
                    onClose={vi.fn()}
                    companyId="comp-100"
                    folders={mockFolders}
                    documents={mockDocuments}
                />
            </NotificationProvider>
        );

        expect(screen.queryByText('Matryca Uprawnień VDR (Virtual Data Room)')).not.toBeInTheDocument();
    });

    it('renders matrix modal and fetches permissions on open', async () => {
        render(
            <NotificationProvider>
                <VdrPermissionMatrixModal
                    isOpen={true}
                    onClose={vi.fn()}
                    companyId="comp-100"
                    folders={mockFolders}
                    documents={mockDocuments}
                />
            </NotificationProvider>
        );

        expect(screen.getByText('Matryca Uprawnień VDR (Virtual Data Room)')).toBeInTheDocument();
        expect(apiClient.get).toHaveBeenCalledWith('/documents/permissions/matrix', {
            params: { company_id: 'comp-100' },
        });

        await waitFor(() => {
            expect(screen.getByText('Rola: Klient (client)')).toBeInTheDocument();
            expect(screen.getByText('ZNAK WODNY')).toBeInTheDocument();
        });
    });

    it('switches between Folders and Documents tabs', async () => {
        render(
            <NotificationProvider>
                <VdrPermissionMatrixModal
                    isOpen={true}
                    onClose={vi.fn()}
                    companyId="comp-100"
                    folders={mockFolders}
                    documents={mockDocuments}
                />
            </NotificationProvider>
        );

        await waitFor(() => {
            expect(screen.getByText('Rola: Klient (client)')).toBeInTheDocument();
        });

        // Click on Nadpisania Plików tab
        const docTab = screen.getByRole('button', { name: /Nadpisania Plików/i });
        fireEvent.click(docTab);

        await waitFor(() => {
            expect(screen.getByText('Użytkownik: user-123')).toBeInTheDocument();
        });
    });

    it('submits new folder permission grant', async () => {
        render(
            <NotificationProvider>
                <VdrPermissionMatrixModal
                    isOpen={true}
                    onClose={vi.fn()}
                    companyId="comp-100"
                    folders={mockFolders}
                    documents={mockDocuments}
                />
            </NotificationProvider>
        );

        await waitFor(() => {
            expect(screen.getByText('Rola: Klient (client)')).toBeInTheDocument();
        });

        const submitBtn = screen.getByRole('button', { name: /Zapisz Uprawnienie/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(apiClient.post).toHaveBeenCalledWith(
                '/documents/permissions/folders/folder-1',
                expect.objectContaining({
                    subject_type: 'role',
                    subject_id: 'client',
                    permission_level: 'view',
                    watermark_required: true,
                    company_id: 'comp-100',
                })
            );
        });
    });

    it('submits document override permission grant', async () => {
        render(
            <NotificationProvider>
                <VdrPermissionMatrixModal
                    isOpen={true}
                    onClose={vi.fn()}
                    companyId="comp-100"
                    folders={mockFolders}
                    documents={mockDocuments}
                />
            </NotificationProvider>
        );

        await waitFor(() => {
            expect(screen.getByText('Rola: Klient (client)')).toBeInTheDocument();
        });

        // Change Typ zasobu to document
        const resourceTypeSelect = screen.getByDisplayValue(/Folder transakcyjny/i);
        fireEvent.change(resourceTypeSelect, { target: { value: 'document' } });

        // Change permission level to download
        const levelSelect = screen.getByDisplayValue(/Tylko podgląd/i);
        fireEvent.change(levelSelect, { target: { value: 'download' } });

        const submitBtn = screen.getByRole('button', { name: /Zapisz Uprawnienie/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(apiClient.post).toHaveBeenCalledWith(
                '/documents/permissions/documents/doc-1',
                expect.objectContaining({
                    subject_type: 'role',
                    subject_id: 'client',
                    permission_level: 'download',
                    watermark_required: true,
                    company_id: 'comp-100',
                })
            );
        });
    });

    it('calls revoke permission when trash icon is clicked', async () => {
        render(
            <NotificationProvider>
                <VdrPermissionMatrixModal
                    isOpen={true}
                    onClose={vi.fn()}
                    companyId="comp-100"
                    folders={mockFolders}
                    documents={mockDocuments}
                />
            </NotificationProvider>
        );

        await waitFor(() => {
            expect(screen.getByText('Rola: Klient (client)')).toBeInTheDocument();
        });

        const trashBtn = screen.getByTitle('Odwołaj uprawnienie');
        fireEvent.click(trashBtn);

        expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Czy na pewno chcesz odwołać to uprawnienie VDR?'));

        await waitFor(() => {
            expect(apiClient.delete).toHaveBeenCalledWith('/documents/permissions/folder/grant-f-1', {
                params: { company_id: 'comp-100' },
            });
        });
    });

    it('calls onClose when close button is clicked', () => {
        const onClose = vi.fn();
        render(
            <NotificationProvider>
                <VdrPermissionMatrixModal
                    isOpen={true}
                    onClose={onClose}
                    companyId="comp-100"
                    folders={mockFolders}
                    documents={mockDocuments}
                />
            </NotificationProvider>
        );

        const closeBtn = screen.getByTitle('Zamknij');
        fireEvent.click(closeBtn);

        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
