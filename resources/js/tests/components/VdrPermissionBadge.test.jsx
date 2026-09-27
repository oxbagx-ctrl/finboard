import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VdrPermissionBadge, WatermarkBadge } from '../../components/dataroom/VdrPermissionBadge';

describe('VdrPermissionBadge Component', () => {
    it('renders view level badge correctly', () => {
        render(<VdrPermissionBadge level="view" />);
        expect(screen.getByText('Tylko podgląd')).toBeInTheDocument();
    });

    it('renders download level badge correctly', () => {
        render(<VdrPermissionBadge level="download" />);
        expect(screen.getByText('Pobieranie')).toBeInTheDocument();
    });

    it('renders manage level badge correctly', () => {
        render(<VdrPermissionBadge level="manage" />);
        expect(screen.getByText('Zarządzanie')).toBeInTheDocument();
    });

    it('renders none level badge correctly', () => {
        render(<VdrPermissionBadge level="none" />);
        expect(screen.getByText('Brak dostępu')).toBeInTheDocument();
    });
});

describe('WatermarkBadge Component', () => {
    it('renders badge when required is true', () => {
        render(<WatermarkBadge required={true} />);
        expect(screen.getByText('ZNAK WODNY')).toBeInTheDocument();
    });

    it('returns null when required is false', () => {
        const { container } = render(<WatermarkBadge required={false} />);
        expect(container.firstChild).toBeNull();
    });
});
