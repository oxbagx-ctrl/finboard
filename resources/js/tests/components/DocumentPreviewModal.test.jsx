import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DocumentPreviewModal } from '../../components/dataroom/DocumentPreviewModal';

const mockDoc = {
    id: 'doc-101',
    title: 'Audyt Finansowy Q3 2026',
    original_name: 'audyt_q3_2026.pdf',
    index_code: '02.01.05',
    size_bytes: 2516582, // 2.4 MB
    formatted_size: '2.40 MB',
    checksum_sha256: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    mime_type: 'application/pdf',
};

describe('DocumentPreviewModal Component', () => {
    it('does not render when isOpen is false', () => {
        render(
            <DocumentPreviewModal
                isOpen={false}
                document={mockDoc}
                previewUrl="/api/v1/documents/doc-101/preview"
                loading={false}
                onClose={vi.fn()}
                onDownload={vi.fn()}
                canDownload={true}
            />
        );

        expect(screen.queryByText('Audyt Finansowy Q3 2026')).not.toBeInTheDocument();
    });

    it('renders document metadata, watermark banner, and iframe when isOpen is true', () => {
        render(
            <DocumentPreviewModal
                isOpen={true}
                document={mockDoc}
                previewUrl="/api/v1/documents/doc-101/preview"
                loading={false}
                onClose={vi.fn()}
                onDownload={vi.fn()}
                canDownload={true}
            />
        );

        expect(screen.getByText('Audyt Finansowy Q3 2026')).toBeInTheDocument();
        expect(screen.getByText('02.01.05')).toBeInTheDocument();
        expect(screen.getByText(/2.40 MB/)).toBeInTheDocument();
        expect(screen.getByText(/POUFNY PODGLĄD VDR/)).toBeInTheDocument();
        expect(screen.getByTitle('Podgląd PDF: Audyt Finansowy Q3 2026')).toHaveAttribute('src', '/api/v1/documents/doc-101/preview#toolbar=1&navpanes=0');
    });

    it('renders download button and triggers onDownload when canDownload is true', () => {
        const onDownload = vi.fn();
        render(
            <DocumentPreviewModal
                isOpen={true}
                document={mockDoc}
                previewUrl="/api/v1/documents/doc-101/preview"
                loading={false}
                onClose={vi.fn()}
                onDownload={onDownload}
                canDownload={true}
            />
        );

        const downloadBtn = screen.getByRole('button', { name: /Pobierz/i });
        expect(downloadBtn).toBeInTheDocument();
        fireEvent.click(downloadBtn);
        expect(onDownload).toHaveBeenCalledWith(mockDoc);
    });

    it('hides download button when canDownload is false', () => {
        render(
            <DocumentPreviewModal
                isOpen={true}
                document={mockDoc}
                previewUrl="/api/v1/documents/doc-101/preview"
                loading={false}
                onClose={vi.fn()}
                onDownload={vi.fn()}
                canDownload={false}
            />
        );

        expect(screen.queryByRole('button', { name: /Pobierz/i })).not.toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
        const onClose = vi.fn();
        render(
            <DocumentPreviewModal
                isOpen={true}
                document={mockDoc}
                previewUrl="/api/v1/documents/doc-101/preview"
                loading={false}
                onClose={onClose}
                onDownload={vi.fn()}
                canDownload={true}
            />
        );

        const closeBtn = screen.getByTitle('Zamknij podgląd');
        fireEvent.click(closeBtn);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows loading indicator when loading is true', () => {
        render(
            <DocumentPreviewModal
                isOpen={true}
                document={mockDoc}
                previewUrl={null}
                loading={true}
                onClose={vi.fn()}
                onDownload={vi.fn()}
                canDownload={true}
            />
        );

        expect(screen.getByText(/Generowanie zabezpieczonego podglądu z dynamicznym znakiem wodnym/i)).toBeInTheDocument();
    });
});
