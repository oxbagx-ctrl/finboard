import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImportView } from '../../views/ImportView';
import { CsvDropzone } from '../../components/import/CsvDropzone';
import { CsvPreviewTable } from '../../components/import/CsvPreviewTable';
import { ImportJobProgress } from '../../components/import/ImportJobProgress';
import { ImportHistoryTable } from '../../components/import/ImportHistoryTable';
import { NotificationProvider } from '../../context/NotificationContext';
import { AuthContext } from '../../context/AuthContext';
import apiClient from '../../api/client';

vi.mock('../../api/client', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
    },
}));

const mockCompany = {
    id: 'comp-acme-1',
    name: 'Acme Manufacturing S.A.',
    code: 'ACME',
};

const renderWithProviders = (ui) => {
    return render(
        <NotificationProvider>
            <AuthContext.Provider
                value={{
                    user: { id: 'u-1', name: 'Jan Dyrektor', role: 'admin' },
                    activeCompany: mockCompany,
                    isAdmin: true,
                    isSuperAdmin: false,
                    isAdvisor: false,
                }}
            >
                {ui}
            </AuthContext.Provider>
        </NotificationProvider>
    );
};

describe('ImportView - Accessible Tooltips and InfoTooltips Integration (Phase 56 Commit 276)', () => {
    const mockHistory = [
        {
            id: 'job-uuid-12345678-abcd',
            file_name: 'wyciag_lipiec_2026.csv',
            status: 'completed',
            total_rows: 50,
            imported_rows: 50,
            error_count: 0,
            created_at: '2026-07-01T10:00:00Z',
            completed_at: '2026-07-01T10:00:15Z',
        },
        {
            id: 'job-uuid-87654321-efgh',
            file_name: 'faktury_bledne.csv',
            status: 'failed',
            total_rows: 20,
            imported_rows: 5,
            error_count: 15,
            created_at: '2026-07-02T12:00:00Z',
            completed_at: '2026-07-02T12:00:05Z',
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        apiClient.get.mockImplementation((url) => {
            if (url === '/finance/imports/history') {
                return Promise.resolve({ data: { data: mockHistory } });
            }
            if (url.startsWith('/finance/imports/')) {
                return Promise.resolve({
                    data: {
                        data: {
                            id: 'job-uuid-active-999',
                            file_name: 'wyciag_biezacy.csv',
                            status: 'processing',
                            total_rows: 100,
                            imported_rows: 45,
                            error_count: 0,
                            created_at: '2026-07-03T14:00:00Z',
                        },
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });
    });

    it('renders header ribbon with active company badge, worker status, dry-run indicator, and module InfoTooltip', async () => {
        renderWithProviders(<ImportView />);

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/finance/imports/history');
        });

        // Module title and active company code badge
        expect(screen.getByText('Asynchroniczny Import Danych CSV')).toBeInTheDocument();
        expect(screen.getByText('ACME')).toBeInTheDocument();

        // Worker and Dry-Run status indicators
        expect(screen.getByText(/Worker: Aktywny/i)).toBeInTheDocument();
        expect(screen.getByText(/Walidacja Dry-Run/i)).toBeInTheDocument();

        // InfoTooltip button for Import module
        expect(screen.getByRole('button', { name: /Więcej informacji o module importu CSV/i })).toBeInTheDocument();
    });

    it('renders CsvDropzone with format InfoTooltip, template download button, and accessible dropzone trigger', () => {
        const onFileSelected = vi.fn();
        const onClearFile = vi.fn();
        const onDownloadTemplate = vi.fn();

        render(
            <CsvDropzone
                selectedFile={null}
                onFileSelected={onFileSelected}
                onClearFile={onClearFile}
                onDownloadTemplate={onDownloadTemplate}
                loading={false}
            />
        );

        // Format specification InfoTooltip
        expect(screen.getByRole('button', { name: /Więcej informacji o specyfikacji formatu CSV/i })).toBeInTheDocument();

        // Download Template button with accessible name
        const downloadBtn = screen.getByRole('button', { name: /Pobierz Szablon CSV/i });
        expect(downloadBtn).toBeInTheDocument();
        fireEvent.click(downloadBtn);
        expect(onDownloadTemplate).toHaveBeenCalledTimes(1);

        // Dropzone area button
        const dropzoneBtn = screen.getByRole('button', { name: /Przeciągnij i upuść plik CSV lub kliknij, aby wybrać z dysku/i });
        expect(dropzoneBtn).toBeInTheDocument();
    });

    it('renders CsvDropzone with selected file details and accessible change file button', () => {
        const fakeFile = {
            name: 'wyciag_bankowy_santander.csv',
            size: 45678,
            lastModified: 1774000000000,
        };
        const onClearFile = vi.fn();

        render(
            <CsvDropzone
                selectedFile={fakeFile}
                onFileSelected={vi.fn()}
                onClearFile={onClearFile}
                onDownloadTemplate={vi.fn()}
                loading={false}
            />
        );

        expect(screen.getByText('wyciag_bankowy_santander.csv')).toBeInTheDocument();
        expect(screen.getByText('44.6 KB')).toBeInTheDocument();
        expect(screen.getByText(/Ostatnia modyfikacja:/i)).toBeInTheDocument();

        // Change file button
        const clearBtn = screen.getByRole('button', { name: /Zmień wybrany plik CSV/i });
        expect(clearBtn).toBeInTheDocument();
        fireEvent.click(clearBtn);
        expect(onClearFile).toHaveBeenCalledTimes(1);
    });

    it('renders CsvPreviewTable with Dry-Run Pass, InfoTooltips, column headers, and action buttons', () => {
        const validPreview = {
            valid: true,
            total_rows: 30,
            valid_count: 30,
            error_count: 0,
            errors: [],
            sample_records: [
                {
                    record_date: '2026-07-01',
                    category_id: 'cat-sales',
                    description: 'Usługi doradcze IT',
                    currency: 'PLN',
                    amount: '75000.00',
                },
            ],
        };

        const handleConfirm = vi.fn();
        const handleCancel = vi.fn();

        render(
            <CsvPreviewTable
                previewData={validPreview}
                onConfirmImport={handleConfirm}
                onCancel={handleCancel}
                importing={false}
            />
        );

        // Dry-run pass banner and InfoTooltip
        expect(screen.getByText(/Weryfikacja Pliku Zakończona Sukcesem/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Więcej informacji o wyniku weryfikacji Dry-Run/i })).toBeInTheDocument();

        // Sample records header InfoTooltip
        expect(screen.getByRole('button', { name: /Więcej informacji o próbce wygenerowanych zapisów/i })).toBeInTheDocument();
        expect(screen.getByText('Źródło: csv_import')).toBeInTheDocument();

        // Table column headers
        expect(screen.getByText('Kategoria ID')).toBeInTheDocument();
        expect(screen.getByText('Tytuł / Opis')).toBeInTheDocument();

        // Buttons
        const cancelBtn = screen.getByRole('button', { name: /Anuluj/i });
        const importBtn = screen.getByRole('button', { name: /Rozpocznij Asynchroniczny Import/i });
        expect(cancelBtn).toBeInTheDocument();
        expect(importBtn).not.toBeDisabled();

        fireEvent.click(importBtn);
        expect(handleConfirm).toHaveBeenCalledTimes(1);
    });

    it('renders CsvPreviewTable with Dry-Run Failed and errors registry InfoTooltip', () => {
        const invalidPreview = {
            valid: false,
            total_rows: 5,
            valid_count: 2,
            error_count: 3,
            errors: [
                { line: 2, column: 'kategoria', message: 'Nieprawidłowa kategoria' },
            ],
            sample_records: [],
        };

        render(
            <CsvPreviewTable
                previewData={invalidPreview}
                onConfirmImport={vi.fn()}
                onCancel={vi.fn()}
                importing={false}
            />
        );

        expect(screen.getByText(/Wykryto Błędy w Pliku CSV/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Więcej informacji o rejestrze błędów walidacyjnych/i })).toBeInTheDocument();
        expect(screen.getByText('[Linia 2]:')).toBeInTheDocument();
        expect(screen.getByText(/Nieprawidłowa kategoria/i)).toBeInTheDocument();

        // Import button should be disabled
        const importBtn = screen.getByRole('button', { name: /Rozpocznij Asynchroniczny Import/i });
        expect(importBtn).toBeDisabled();
    });

    it('renders ImportJobProgress with status header, queue ID, progress InfoTooltip, and navigation actions', () => {
        const job = {
            id: 'job-progress-777',
            file_name: 'transakcje_q3.csv',
            status: 'completed',
            total_rows: 100,
            imported_rows: 100,
            error_count: 0,
        };

        const onReset = vi.fn();
        const onNavigate = vi.fn();

        render(
            <ImportJobProgress
                importJob={job}
                onComplete={vi.fn()}
                onReset={onReset}
                onNavigateRecords={onNavigate}
            />
        );

        // Header and queue ID
        expect(screen.getByText('Zadanie Importu:')).toBeInTheDocument();
        expect(screen.getByText('transakcje_q3.csv')).toBeInTheDocument();
        expect(screen.getByText(/ID KOLEJKI: job-progress-777/i)).toBeInTheDocument();
        expect(screen.getByText(/IMPORT ZAKOŃCZONY SUKCESEM/i)).toBeInTheDocument();

        // Progress InfoTooltip
        expect(screen.getByRole('button', { name: /Informacje o postępie importu/i })).toBeInTheDocument();
        expect(screen.getByText(/100 \/ 100 wierszy \(100%\)/i)).toBeInTheDocument();

        // Completion action buttons
        const resetBtn = screen.getByRole('button', { name: /Importuj Kolejny Plik/i });
        const navigateBtn = screen.getByRole('button', { name: /Przejdź do Księgi Operacji/i });

        expect(resetBtn).toBeInTheDocument();
        expect(navigateBtn).toBeInTheDocument();

        fireEvent.click(resetBtn);
        expect(onReset).toHaveBeenCalledTimes(1);

        fireEvent.click(navigateBtn);
        expect(onNavigate).toHaveBeenCalledTimes(1);
    });

    it('renders ImportHistoryTable with audit trail InfoTooltip, refresh button, table headers, and status badges', () => {
        const onRefresh = vi.fn();

        render(
            <ImportHistoryTable
                history={mockHistory}
                loading={false}
                onRefresh={onRefresh}
            />
        );

        // Header title and InfoTooltip
        expect(screen.getByText(/Dziennik Zadań Asynchronicznych/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Więcej informacji o dzienniku importów/i })).toBeInTheDocument();

        // Refresh button
        const refreshBtn = screen.getByRole('button', { name: /Odśwież Historię/i });
        expect(refreshBtn).toBeInTheDocument();
        fireEvent.click(refreshBtn);
        expect(onRefresh).toHaveBeenCalledTimes(1);

        // Table headers
        expect(screen.getByText('Data Utworzenia')).toBeInTheDocument();
        expect(screen.getByText('Nazwa Pliku CSV')).toBeInTheDocument();
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('Wiersze (Sukces/Razem)')).toBeInTheDocument();
        expect(screen.getByText('Błędy')).toBeInTheDocument();
        expect(screen.getByText('Zakończono')).toBeInTheDocument();

        // Table rows and badges
        expect(screen.getByText('wyciag_lipiec_2026.csv')).toBeInTheDocument();
        expect(screen.getByText('SUKCES')).toBeInTheDocument();
        expect(screen.getByText('50 / 50')).toBeInTheDocument();

        expect(screen.getByText('faktury_bledne.csv')).toBeInTheDocument();
        expect(screen.getByText('BŁĄD')).toBeInTheDocument();
        expect(screen.getByText('15')).toBeInTheDocument();
    });
});
