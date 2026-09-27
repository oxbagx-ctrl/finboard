import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FolderTreeNav } from '../../components/dataroom/FolderTreeNav';

const mockFolders = [
    {
        id: 'f-1',
        index_code: '01.00',
        name: 'Informacje Korporacyjne',
        documents_count: 5,
        children: [
            {
                id: 'f-1-1',
                index_code: '01.01',
                name: 'Umowy Spółki i Statuty',
                documents_count: 3,
                children: [],
            },
            {
                id: 'f-1-2',
                index_code: '01.02',
                name: 'Odpisy KRS i Rejestry',
                documents_count: 2,
                children: [],
            },
        ],
    },
    {
        id: 'f-2',
        index_code: '02.00',
        name: 'Finanse i Podatki',
        documents_count: 10,
        children: [
            {
                id: 'f-2-1',
                index_code: '02.01',
                name: 'Sprawozdania Finansowe',
                documents_count: 8,
                children: [],
            },
        ],
    },
];

describe('FolderTreeNav Component', () => {
    it('renders folder hierarchy with Dewey index codes and document counts', () => {
        render(
            <FolderTreeNav
                folders={mockFolders}
                selectedFolderId=""
                onSelectFolder={vi.fn()}
                onInitStandardFolders={vi.fn()}
                onOpenCreateFolder={vi.fn()}
                totalCount={15}
                unassignedCount={2}
            />
        );

        // Header and quick selectors
        expect(screen.getByText('Taksonomia M&A')).toBeInTheDocument();
        expect(screen.getByText('Wszystkie dokumenty')).toBeInTheDocument();
        expect(screen.getByText('Nieprzypisane do folderu')).toBeInTheDocument();
        expect(screen.getByText('15')).toBeInTheDocument();
        expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);

        // Dewey codes
        expect(screen.getByText('01.00')).toBeInTheDocument();
        expect(screen.getByText('Informacje Korporacyjne')).toBeInTheDocument();
        expect(screen.getByText('01.01')).toBeInTheDocument();
        expect(screen.getByText('Umowy Spółki i Statuty')).toBeInTheDocument();
        expect(screen.getByText('02.00')).toBeInTheDocument();
        expect(screen.getByText('Finanse i Podatki')).toBeInTheDocument();
    });

    it('triggers onSelectFolder callback when folders and filters are clicked', () => {
        const handleSelect = vi.fn();

        render(
            <FolderTreeNav
                folders={mockFolders}
                selectedFolderId="f-1"
                onSelectFolder={handleSelect}
                totalCount={15}
            />
        );

        // Click all documents
        fireEvent.click(screen.getByText('Wszystkie dokumenty'));
        expect(handleSelect).toHaveBeenCalledWith('');

        // Click unassigned
        fireEvent.click(screen.getByText('Nieprzypisane do folderu'));
        expect(handleSelect).toHaveBeenCalledWith('unassigned');

        // Click a subfolder
        fireEvent.click(screen.getByText('Umowy Spółki i Statuty'));
        expect(handleSelect).toHaveBeenCalledWith('f-1-1');
    });

    it('supports expanding and collapsing folder tree branches', () => {
        render(
            <FolderTreeNav
                folders={mockFolders}
                selectedFolderId=""
                onSelectFolder={vi.fn()}
            />
        );

        // Initially expanded
        expect(screen.getByText('Umowy Spółki i Statuty')).toBeInTheDocument();

        // Click collapse all
        fireEvent.click(screen.getByTitle('Zwiń wszystkie gałęzie'));
        expect(screen.queryByText('Umowy Spółki i Statuty')).not.toBeInTheDocument();

        // Click expand all
        fireEvent.click(screen.getByTitle('Rozwiń wszystkie gałęzie'));
        expect(screen.getByText('Umowy Spółki i Statuty')).toBeInTheDocument();
    });

    it('renders empty state CTA when no folders exist and triggers initialization', () => {
        const handleInit = vi.fn();

        render(
            <FolderTreeNav
                folders={[]}
                selectedFolderId=""
                onSelectFolder={vi.fn()}
                onInitStandardFolders={handleInit}
            />
        );

        expect(screen.getByText('Brak folderów transakcyjnych')).toBeInTheDocument();
        const initButton = screen.getByText('Inicjalizuj Taksonomię M&A');
        expect(initButton).toBeInTheDocument();

        fireEvent.click(initButton);
        expect(handleInit).toHaveBeenCalledTimes(1);
    });

    it('calls onOpenCreateFolder when + Nowy Folder Dewey button is clicked', () => {
        const handleOpenCreate = vi.fn();

        render(
            <FolderTreeNav
                folders={mockFolders}
                onSelectFolder={vi.fn()}
                onOpenCreateFolder={handleOpenCreate}
            />
        );

        const newFolderBtn = screen.getByText('+ Nowy Folder Dewey');
        expect(newFolderBtn).toBeInTheDocument();

        fireEvent.click(newFolderBtn);
        expect(handleOpenCreate).toHaveBeenCalledTimes(1);
    });
});
