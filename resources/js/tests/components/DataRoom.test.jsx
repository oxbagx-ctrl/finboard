import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DataRoomStats } from '../../components/dataroom/DataRoomStats';
import { DocumentTable } from '../../components/dataroom/DocumentTable';
import { DocumentUploadModal } from '../../components/dataroom/DocumentUploadModal';
import { DocumentEditModal } from '../../components/dataroom/DocumentEditModal';
import { NotificationProvider } from '../../context/NotificationContext';
import apiClient from '../../api/client';

vi.mock('../../api/client', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
    },
}));

const mockDocs = [
    {
        id: 'doc-1',
        title: 'Sprawozdanie Finansowe 2025',
        type: 'financial_report',
        type_label: 'Raport Finansowy',
        original_name: 'raport_2025.pdf',
        mime_type: 'application/pdf',
        size_bytes: 1572864, // 1.50 MB
        formatted_size: '1.50 MB',
        checksum_sha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef',
        download_count: 5,
        is_archived: false,
        created_at: '2026-02-15T10:00:00Z',
        uploader: { name: 'Jan Kowalski' },
        folder_id: 'folder-1',
        index_code: '01.01.01',
        folder: {
            id: 'folder-1',
            name: 'Umowy Spółki',
            index_code: '01.01',
        },
    },
    {
        id: 'doc-2',
        title: 'Umowa Kredytowa PKO BP',
        type: 'contract',
        type_label: 'Umowa / Aneks',
        original_name: 'umowa_kredyt.pdf',
        mime_type: 'application/pdf',
        size_bytes: 819200,
        formatted_size: '800.0 KB',
        checksum_sha256: 'f1e2d3c4b5a60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef',
        download_count: 12,
        is_archived: true,
        created_at: '2026-03-01T12:00:00Z',
        uploader: { name: 'Admin Helvest' },
    },
];

describe('DataRoomStats Component', () => {
    it('calculates and renders aggregates correctly', () => {
        render(<DataRoomStats documents={mockDocs} totalCount={2} />);

        expect(screen.getByText('Dokumenty VDR')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('Pobrania Audytowe')).toBeInTheDocument();
        expect(screen.getByText('17')).toBeInTheDocument(); // 5 + 12
        expect(screen.getByText('AES-256 GCM')).toBeInTheDocument();
        expect(screen.getByText('SUMY KONTROLNE SHA-256')).toBeInTheDocument();
    });
});

describe('DocumentTable Component', () => {
    it('renders document items with titles, categories, and downloads', () => {
        render(
            <DocumentTable
                documents={mockDocs}
                loading={false}
                onDownload={vi.fn()}
                onViewAudit={vi.fn()}
                onEdit={vi.fn()}
                onToggleArchive={vi.fn()}
                onDelete={vi.fn()}
            />
        );

        expect(screen.getByText('Sprawozdanie Finansowe 2025')).toBeInTheDocument();
        expect(screen.getByText('raport_2025.pdf')).toBeInTheDocument();
        expect(screen.getByText('Umowa Kredytowa PKO BP')).toBeInTheDocument();
        expect(screen.getByText('Archiwum')).toBeInTheDocument();
    });

    it('renders Dewey decimal index badges and folder associations', () => {
        render(
            <DocumentTable
                documents={mockDocs}
                loading={false}
                onDownload={vi.fn()}
                onViewAudit={vi.fn()}
                onEdit={vi.fn()}
                onToggleArchive={vi.fn()}
                onDelete={vi.fn()}
            />
        );

        expect(screen.getByText('01.01.01')).toBeInTheDocument();
        expect(screen.getByText(/01.01 Umowy Spółki/)).toBeInTheDocument();
    });

    it('renders empty state when no documents are provided', () => {
        render(
            <DocumentTable
                documents={[]}
                loading={false}
                onDownload={vi.fn()}
                onViewAudit={vi.fn()}
                onEdit={vi.fn()}
                onToggleArchive={vi.fn()}
                onDelete={vi.fn()}
            />
        );

        expect(screen.getByText('Brak dokumentów spełniających wybrane kryteria')).toBeInTheDocument();
    });

    it('triggers onDownload callback when download button is clicked', () => {
        const onDownload = vi.fn();
        render(
            <DocumentTable
                documents={mockDocs}
                loading={false}
                onDownload={onDownload}
                onViewAudit={vi.fn()}
                onEdit={vi.fn()}
                onToggleArchive={vi.fn()}
                onDelete={vi.fn()}
            />
        );

        const downloadButtons = screen.getAllByTitle(/Pobierz dokument/);
        fireEvent.click(downloadButtons[0]);

        expect(onDownload).toHaveBeenCalledWith(mockDocs[0]);
    });

    it('triggers onViewAudit callback when audit button is clicked', () => {
        const onViewAudit = vi.fn();
        render(
            <DocumentTable
                documents={mockDocs}
                loading={false}
                onDownload={vi.fn()}
                onViewAudit={onViewAudit}
                onEdit={vi.fn()}
                onToggleArchive={vi.fn()}
                onDelete={vi.fn()}
            />
        );

        const auditButtons = screen.getAllByTitle(/Przeglądaj wpisy ścieżki audytowej/);
        fireEvent.click(auditButtons[0]);

        expect(onViewAudit).toHaveBeenCalledWith(mockDocs[0]);
    });
});

describe('DocumentUploadModal Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not render when isOpen is false', () => {
        render(
            <NotificationProvider>
                <DocumentUploadModal isOpen={false} onClose={vi.fn()} onSuccess={vi.fn()} />
            </NotificationProvider>
        );

        expect(screen.queryByText('Deponowanie Dokumentu w VDR')).not.toBeInTheDocument();
    });

    it('validates required fields before submitting', async () => {
        render(
            <NotificationProvider>
                <DocumentUploadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />
            </NotificationProvider>
        );

        expect(screen.getByText('Deponowanie Dokumentu w VDR')).toBeInTheDocument();
        const submitBtn = screen.getByText('Zdeponuj w VDR');
        expect(submitBtn).toBeDisabled();
    });

    it('renders folder options and pre-fills Dewey index code on folder change', () => {
        const testFolders = [
            { id: 'f-1', index_code: '01.00', name: 'Korporacyjne', children: [
                { id: 'f-1-1', index_code: '01.01', name: 'Umowy', children: [] }
            ]}
        ];

        render(
            <NotificationProvider>
                <DocumentUploadModal
                    isOpen={true}
                    onClose={vi.fn()}
                    onSuccess={vi.fn()}
                    folders={testFolders}
                />
            </NotificationProvider>
        );

        expect(screen.getByText(/Folder M&A/)).toBeInTheDocument();
        const indexInput = screen.getByPlaceholderText(/01.01.01/);
        expect(indexInput).toBeInTheDocument();

        // Select folder f-1-1
        const folderSelect = screen.getAllByRole('combobox')[1];
        fireEvent.change(folderSelect, { target: { value: 'f-1-1' } });

        expect(indexInput.value).toBe('01.01.01');
    });
});

describe('DocumentEditModal Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('populates fields and submits updated title and category', async () => {
        apiClient.put.mockResolvedValueOnce({
            data: { data: { ...mockDocs[0], title: 'Zaktualizowany Tytuł' } },
        });

        const onSuccess = vi.fn();
        const onClose = vi.fn();

        render(
            <NotificationProvider>
                <DocumentEditModal
                    document={{ ...mockDocs[0], folder_id: null, index_code: null }}
                    isOpen={true}
                    onClose={onClose}
                    onSuccess={onSuccess}
                />
            </NotificationProvider>
        );

        expect(screen.getByText('Edycja Metadanych Dokumentu VDR')).toBeInTheDocument();
        const input = screen.getByDisplayValue('Sprawozdanie Finansowe 2025');

        fireEvent.change(input, { target: { value: 'Zaktualizowany Raport Finansowy' } });

        const submitBtn = screen.getByText('Zapisz Zmiany');
        fireEvent.submit(submitBtn.closest('form'));

        await waitFor(() => {
            expect(apiClient.put).toHaveBeenCalledWith('/documents/doc-1', {
                title: 'Zaktualizowany Raport Finansowy',
                type: 'financial_report',
            });
            expect(onSuccess).toHaveBeenCalled();
            expect(onClose).toHaveBeenCalled();
        });
    });

    it('reassigns folder and Dewey index code when submitted', async () => {
        apiClient.put.mockResolvedValueOnce({
            data: { data: { ...mockDocs[0], folder_id: 'new-f-2', index_code: '02.01.05' } },
        });

        const testFolders = [
            { id: 'new-f-2', index_code: '02.01', name: 'Audyty', children: [] }
        ];

        render(
            <NotificationProvider>
                <DocumentEditModal
                    document={mockDocs[0]}
                    isOpen={true}
                    folders={testFolders}
                    onClose={vi.fn()}
                    onSuccess={vi.fn()}
                />
            </NotificationProvider>
        );

        const folderSelect = screen.getAllByRole('combobox')[1];
        fireEvent.change(folderSelect, { target: { value: 'new-f-2' } });

        const indexInput = screen.getByPlaceholderText(/01.01.01/);
        fireEvent.change(indexInput, { target: { value: '02.01.05' } });

        const submitBtn = screen.getByText('Zapisz Zmiany');
        fireEvent.submit(submitBtn.closest('form'));

        await waitFor(() => {
            expect(apiClient.put).toHaveBeenCalledWith('/documents/doc-1', {
                title: 'Sprawozdanie Finansowe 2025',
                type: 'financial_report',
                folder_id: 'new-f-2',
                index_code: '02.01.05',
            });
        });
    });
});
