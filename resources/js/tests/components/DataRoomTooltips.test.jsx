import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DataRoomView } from '../../views/DataRoomView';
import { DataRoomStats } from '../../components/dataroom/DataRoomStats';
import { DocumentTable } from '../../components/dataroom/DocumentTable';
import { DocumentAuditModal } from '../../components/dataroom/DocumentAuditModal';
import { DocumentPreviewModal } from '../../components/dataroom/DocumentPreviewModal';
import { DocumentUploadModal } from '../../components/dataroom/DocumentUploadModal';
import { DocumentEditModal } from '../../components/dataroom/DocumentEditModal';
import { CreateFolderModal } from '../../components/dataroom/CreateFolderModal';
import { DeleteDocumentModal } from '../../components/dataroom/DeleteDocumentModal';
import { NotificationProvider } from '../../context/NotificationContext';
import { AuthContext } from '../../context/AuthContext';
import apiClient from '../../api/client';

vi.mock('../../api/client', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    },
}));

const mockCompany = {
    id: 'comp-vdr-1',
    name: 'Horizon Biotech S.A.',
    code: 'HBIOTECH',
};

const renderWithProviders = (ui, authOverrides = {}) => {
    return render(
        <NotificationProvider>
            <AuthContext.Provider
                value={{
                    user: { id: 'usr-1', name: 'Marek Audytor', role: 'admin' },
                    activeCompany: mockCompany,
                    isAdmin: true,
                    isSuperAdmin: false,
                    isAdvisor: false,
                    ...authOverrides,
                }}
            >
                {ui}
            </AuthContext.Provider>
        </NotificationProvider>
    );
};

describe('DataRoom - Accessible Tooltips and InfoTooltips Integration (Phase 56 Commit 277)', () => {
    const mockDocuments = [
        {
            id: 'doc-uuid-1',
            title: 'Audyt Finansowy Q3 2026',
            original_name: 'audyt_q3_2026.pdf',
            type: 'financial_report',
            checksum_sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            file_size: 1548576,
            formatted_size: '1.48 MB',
            downloads_count: 7,
            is_archived: false,
            watermark_required: true,
            folder_id: 'folder-1',
            folder: {
                id: 'folder-1',
                name: 'Finanse i Księgowość',
                index_code: '01.00',
            },
            index_code: '01.00.01',
            created_at: '2026-08-01T10:00:00Z',
            uploader: {
                name: 'Piotr Analityk',
            },
        },
    ];

    const mockFolders = [
        {
            id: 'folder-1',
            name: 'Finanse i Księgowość',
            index_code: '01.00',
            parent_id: null,
            children: [],
        },
    ];

    const mockStats = {
        total_documents: 14,
        total_size: 52428800,
        formatted_total_size: '50.00 MB',
        total_downloads: 42,
        categories_count: 5,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        apiClient.get.mockImplementation((url) => {
            if (url === '/documents') {
                return Promise.resolve({
                    data: {
                        data: mockDocuments,
                        meta: { current_page: 1, last_page: 1, total: 1 },
                    },
                });
            }
            if (url === '/documents/stats') {
                return Promise.resolve({ data: { data: mockStats } });
            }
            if (url === '/documents/folders') {
                return Promise.resolve({ data: { data: mockFolders } });
            }
            if (url.includes('/audit-logs')) {
                return Promise.resolve({
                    data: {
                        data: [
                            {
                                id: 'log-1',
                                action: 'downloaded',
                                user: { name: 'Marek Audytor', email: 'marek@audyt.pl', role: 'admin' },
                                ip_address: '192.168.1.100',
                                user_agent: 'Mozilla/5.0 Chrome/126.0',
                                created_at: '2026-08-02T12:00:00Z',
                            },
                        ],
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });
    });

    it('renders DataRoomView header with title InfoTooltip, company badge, and accessible action buttons', async () => {
        renderWithProviders(<DataRoomView />);

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/documents', expect.any(Object));
        });

        // Module title and InfoTooltip button
        expect(screen.getByText('Virtual Data Room (VDR) – Dokumentacja Transakcyjna')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Więcej informacji o module Virtual Data Room/i })).toBeInTheDocument();

        // Company badge
        expect(screen.getByText('HBIOTECH')).toBeInTheDocument();

        // Header action buttons
        expect(screen.getByRole('button', { name: /Ukryj boczny panel taksonomii folderów M&A/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Odśwież repozytorium VDR/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Otwórz konfigurację matrycy uprawnień VDR/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Zdeponuj nowy dokument transakcyjny/i })).toBeInTheDocument();

        // Category filter buttons
        expect(screen.getByRole('button', { name: /Filtruj: Wszystkie dokumenty transakcyjne/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Filtruj kategorię: Raporty Finansowe/i })).toBeInTheDocument();

        // Search input
        expect(screen.getByRole('searchbox', { name: /Wyszukaj dokumenty w pokoju danych/i })).toBeInTheDocument();
    });

    it('renders DataRoomStats with 4 KPI cards having InfoTooltips and compliance banner', () => {
        render(<DataRoomStats stats={mockStats} loading={false} />);

        // Metric cards InfoTooltips
        expect(screen.getByRole('button', { name: /Więcej informacji o dokumentach VDR/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Więcej informacji o wolumenie danych/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Więcej informacji o pobraniach audytowych/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Więcej informacji o kategoriach Due Diligence/i })).toBeInTheDocument();

        // Security compliance badges
        expect(screen.getByText(/AES-256 GCM/i)).toBeInTheDocument();
        expect(screen.getByText(/SUMY KONTROLNE SHA-256/i)).toBeInTheDocument();
        expect(screen.getByText(/IMMUTABLE AUDIT TRAIL LOGGED/i)).toBeInTheDocument();
    });

    it('renders DocumentTable with accessible column headers, file metadata, and row actions', () => {
        const handlePreview = vi.fn();
        const handleDownload = vi.fn();
        const handleAudit = vi.fn();
        const handleEdit = vi.fn();
        const handleToggleArchive = vi.fn();
        const handleDelete = vi.fn();

        render(
            <DocumentTable
                documents={mockDocuments}
                loading={false}
                onPreview={handlePreview}
                onDownload={handleDownload}
                onAudit={handleAudit}
                onEdit={handleEdit}
                onToggleArchive={handleToggleArchive}
                onDelete={handleDelete}
            />
        );

        // Column headers
        expect(screen.getByText('Tytuł i Plik Źródłowy')).toBeInTheDocument();
        expect(screen.getByText('Kategoria VDR')).toBeInTheDocument();
        expect(screen.getByText('Suma SHA-256')).toBeInTheDocument();
        expect(screen.getByText('Rozmiar')).toBeInTheDocument();
        expect(screen.getByText('Wgrał / Data')).toBeInTheDocument();
        expect(screen.getByText('Pobrania')).toBeInTheDocument();
        expect(screen.getByText('Akcje')).toBeInTheDocument();

        // Document row details
        expect(screen.getByText('Audyt Finansowy Q3 2026')).toBeInTheDocument();
        expect(screen.getByText('audyt_q3_2026.pdf')).toBeInTheDocument();
        expect(screen.getByText('01.00.01')).toBeInTheDocument();
        expect(screen.getByText('1.48 MB')).toBeInTheDocument();
        expect(screen.getByText('Piotr Analityk')).toBeInTheDocument();

        // Action buttons
        const previewBtn = screen.getByRole('button', { name: 'Podgląd dokumentu' });
        const downloadBtn = screen.getByRole('button', { name: 'Pobierz dokument' });
        const auditBtn = screen.getByRole('button', { name: 'Ścieżka audytowa' });
        const editBtn = screen.getByRole('button', { name: 'Edytuj dokument' });
        const archiveBtn = screen.getByRole('button', { name: 'Przenieś do archiwum' });
        const deleteBtn = screen.getByRole('button', { name: 'Usuń dokument' });

        expect(previewBtn).toBeInTheDocument();
        expect(downloadBtn).toBeInTheDocument();
        expect(auditBtn).toBeInTheDocument();
        expect(editBtn).toBeInTheDocument();
        expect(archiveBtn).toBeInTheDocument();
        expect(deleteBtn).toBeInTheDocument();

        fireEvent.click(previewBtn);
        expect(handlePreview).toHaveBeenCalledWith(mockDocuments[0]);

        fireEvent.click(downloadBtn);
        expect(handleDownload).toHaveBeenCalledWith(mockDocuments[0]);
    });

    it('renders DocumentAuditModal with WORM InfoTooltip, close and refresh buttons', async () => {
        const onClose = vi.fn();

        render(
            <DocumentAuditModal
                isOpen={true}
                document={mockDocuments[0]}
                onClose={onClose}
            />
        );

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/documents/doc-uuid-1/audit-logs');
        });

        // Header title and WORM InfoTooltip
        expect(screen.getByText('Rejestr Ścieżki Audytowej Dokumentu')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Więcej informacji o rejestrze audytowym/i })).toBeInTheDocument();

        // Refresh and close buttons
        expect(screen.getByRole('button', { name: 'Odśwież wpisy' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Zamknij rejestr audytowy' })).toBeInTheDocument();

        // Audit entry details
        await waitFor(() => {
            expect(screen.getByText(/Marek Audytor/i)).toBeInTheDocument();
            expect(screen.getByText(/192.168.1.100/i)).toBeInTheDocument();
        });
    });

    it('renders DocumentPreviewModal with watermark InfoTooltip and download/close actions', () => {
        const onClose = vi.fn();
        const onDownload = vi.fn();

        render(
            <DocumentPreviewModal
                isOpen={true}
                document={mockDocuments[0]}
                previewUrl="blob:http://localhost/test-preview"
                onClose={onClose}
                onDownload={onDownload}
                canDownload={true}
            />
        );

        // Watermark InfoTooltip
        expect(screen.getByRole('button', { name: /Informacje o dynamicznym znaku wodnym/i })).toBeInTheDocument();
        expect(screen.getByText(/POUFNY PODGLĄD VDR/i)).toBeInTheDocument();

        // Download and Close buttons
        const downloadBtn = screen.getByRole('button', { name: 'Pobierz plik dokumentu' });
        const closeBtn = screen.getByRole('button', { name: 'Zamknij podgląd' });

        expect(downloadBtn).toBeInTheDocument();
        expect(closeBtn).toBeInTheDocument();

        fireEvent.click(downloadBtn);
        expect(onDownload).toHaveBeenCalledWith(mockDocuments[0]);

        fireEvent.click(closeBtn);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('renders DocumentUploadModal with field InfoTooltips and accessible dropzone trigger', () => {
        renderWithProviders(
            <DocumentUploadModal
                isOpen={true}
                onClose={vi.fn()}
                onSuccess={vi.fn()}
                folders={mockFolders}
                defaultFolderId="folder-1"
            />
        );

        expect(screen.getByText('Deponowanie Dokumentu w VDR')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Informacje o pliku źródłowym/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Informacje o tytule biznesowym/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Informacje o kategorii Due Diligence/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Informacje o folderze M&A/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Informacje o kodzie Dewey/i })).toBeInTheDocument();

        // Submit button should initially be disabled until file is selected
        const submitBtn = screen.getByRole('button', { name: /Zdeponuj w VDR/i });
        expect(submitBtn).toBeDisabled();
    });

    it('renders CreateFolderModal with Dewey InfoTooltip and parent folder select', () => {
        renderWithProviders(
            <CreateFolderModal
                isOpen={true}
                onClose={vi.fn()}
                onSuccess={vi.fn()}
                folders={mockFolders}
            />
        );

        expect(screen.getByText('Nowy Folder Transakcyjny (Dewey)')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Informacje o folderze nadrzędnym/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Informacje o kodzie Dewey/i })).toBeInTheDocument();

        const submitBtn = screen.getByRole('button', { name: /Utwórz Folder/i });
        expect(submitBtn).toBeInTheDocument();
    });

    it('renders DeleteDocumentModal with warning tooltip and confirm button', () => {
        const onDelete = vi.fn();
        const onClose = vi.fn();

        renderWithProviders(
            <DeleteDocumentModal
                isOpen={true}
                document={mockDocuments[0]}
                onClose={onClose}
                onSuccess={onDelete}
            />
        );

        expect(screen.getByText('Potwierdzenie Usunięcia Dokumentu')).toBeInTheDocument();
        expect(screen.getByText(/Audyt Finansowy Q3 2026/i)).toBeInTheDocument();

        const cancelBtn = screen.getByRole('button', { name: /Anuluj/i });
        const deleteBtn = screen.getByRole('button', { name: /Usuń Dokument/i });

        expect(cancelBtn).toBeInTheDocument();
        expect(deleteBtn).toBeInTheDocument();

        fireEvent.click(cancelBtn);
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
