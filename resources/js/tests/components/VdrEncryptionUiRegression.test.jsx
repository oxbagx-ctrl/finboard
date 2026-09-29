import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DocumentTable } from '../../components/dataroom/DocumentTable';
import { DataRoomStats } from '../../components/dataroom/DataRoomStats';
import { DocumentPreviewModal } from '../../components/dataroom/DocumentPreviewModal';

const mockDocuments = [
    {
        id: 'doc-enc-1',
        title: 'Sprawozdanie Finansowe 2026 Zaszyfrowane',
        type: 'financial_report',
        original_name: 'sprawozdanie_2026.pdf',
        mime_type: 'application/pdf',
        size_bytes: 1048576,
        formatted_size: '1.00 MB',
        checksum_sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        download_count: 4,
        is_archived: false,
        is_encrypted: true,
        encryption_algo: 'aes-256-gcm',
        key_id: 'vdr-key-1',
    },
    {
        id: 'doc-legacy-2',
        title: 'Umowa Spółki 2023 Jawna',
        type: 'contract',
        original_name: 'umowa_legacy.pdf',
        mime_type: 'application/pdf',
        size_bytes: 524288,
        formatted_size: '512.0 KB',
        checksum_sha256: 'ca978112ca1bbdcafac231b39a23dc4da7860814961409734a66fb32d39ecf77',
        download_count: 10,
        is_archived: false,
        is_encrypted: false,
        encryption_algo: null,
        key_id: null,
    },
];

describe('VDR Physical Encryption UI Indicators & Security Regression (Commit 325)', () => {
    describe('DocumentTable Component', () => {
        it('renders AES-256 badge for encrypted documents and Jawny for legacy plaintext', () => {
            render(
                <DocumentTable
                    documents={mockDocuments}
                    loading={false}
                    onDownload={vi.fn()}
                    onPreview={vi.fn()}
                    onViewAudit={vi.fn()}
                />
            );

            // Document 1 is encrypted
            const encryptedBadge = screen.getByTestId('encryption-badge-doc-enc-1');
            expect(encryptedBadge).toBeInTheDocument();
            expect(encryptedBadge).toHaveTextContent(/AES-256/i);

            // Document 2 is legacy plaintext
            const legacyBadge = screen.getByTestId('encryption-badge-doc-legacy-2');
            expect(legacyBadge).toBeInTheDocument();
            expect(legacyBadge).toHaveTextContent(/Jawny/i);
        });
    });

    describe('DataRoomStats Component', () => {
        it('calculates and displays correct encryption ratio and security banner', () => {
            render(
                <DataRoomStats
                    documents={mockDocuments}
                    totalCount={mockDocuments.length}
                />
            );

            const encryptedRatio = screen.getByTestId('stats-encrypted-count');
            expect(encryptedRatio).toBeInTheDocument();
            expect(encryptedRatio).toHaveTextContent('1'); // 1 out of 2 is encrypted

            // Compliance banner displays AES-256 GCM
            expect(screen.getByText(/SZYFROWANIE DANYCH SPOCZYNKOWYCH/i)).toBeInTheDocument();
            expect(screen.getByText(/AES-256 GCM/i)).toBeInTheDocument();
            expect(screen.getByText(/IMMUTABLE AUDIT TRAIL LOGGED/i)).toBeInTheDocument();
        });
    });

    describe('DocumentPreviewModal Component', () => {
        it('renders AES-256-GCM (RAM) indicator for encrypted document', () => {
            render(
                <DocumentPreviewModal
                    isOpen={true}
                    document={mockDocuments[0]}
                    previewUrl="/api/v1/documents/doc-enc-1/preview"
                    loading={false}
                    onClose={vi.fn()}
                    onDownload={vi.fn()}
                    canDownload={true}
                />
            );

            const previewBadge = screen.getByTestId('preview-encryption-badge');
            expect(previewBadge).toBeInTheDocument();
            expect(previewBadge).toHaveTextContent(/AES-256-GCM \(RAM\)/i);
        });

        it('renders Jawny (Legacy) indicator for unencrypted legacy document', () => {
            render(
                <DocumentPreviewModal
                    isOpen={true}
                    document={mockDocuments[1]}
                    previewUrl="/api/v1/documents/doc-legacy-2/preview"
                    loading={false}
                    onClose={vi.fn()}
                    onDownload={vi.fn()}
                    canDownload={true}
                />
            );

            const previewBadge = screen.getByTestId('preview-encryption-badge');
            expect(previewBadge).toBeInTheDocument();
            expect(previewBadge).toHaveTextContent(/Jawny \(Legacy\)/i);
        });
    });
});
