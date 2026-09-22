import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScenarioPresetSelector, SCENARIO_PRESETS } from '../../components/investments/ScenarioPresetSelector';

describe('ScenarioPresetSelector Component (Phase 43 Commit 215)', () => {
    const mockOnSelectScenario = vi.fn();
    const mockOnReset = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders all scenario preset buttons and reset action', () => {
        render(
            <ScenarioPresetSelector
                activeScenario="base"
                onSelectScenario={mockOnSelectScenario}
                onReset={mockOnReset}
            />
        );

        expect(screen.getByText(/SCENARIUSZ:/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Bazowy/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Optymistyczny/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Stres-Test Bankowy/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Stagflacja/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Presja Płacowa/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Przywróć Bazę/i })).toBeInTheDocument();
    });

    it('displays active scenario label and badge for base case', () => {
        render(
            <ScenarioPresetSelector
                activeScenario="base"
                onSelectScenario={mockOnSelectScenario}
                onReset={mockOnReset}
            />
        );

        expect(screen.getByText('Bazowy (Base Case)')).toBeInTheDocument();
        expect(screen.getByText('STANDARD')).toBeInTheDocument();
        expect(screen.getByText(/Wszystkie odchylenia = 0%/i)).toBeInTheDocument();
    });

    it('triggers onSelectScenario with optimistic deltas when Optymistyczny is clicked', () => {
        render(
            <ScenarioPresetSelector
                activeScenario="base"
                onSelectScenario={mockOnSelectScenario}
                onReset={mockOnReset}
            />
        );

        const optimisticBtn = screen.getByRole('button', { name: /Optymistyczny/i });
        fireEvent.click(optimisticBtn);

        expect(mockOnSelectScenario).toHaveBeenCalledTimes(1);
        expect(mockOnSelectScenario).toHaveBeenCalledWith('optimistic', expect.objectContaining({
            capexDelta: -5,
            revenueDelta: 15,
            varCostDelta: -5,
        }));
    });

    it('triggers onSelectScenario with pessimistic deltas when Stres-Test Bankowy is clicked', () => {
        render(
            <ScenarioPresetSelector
                activeScenario="base"
                onSelectScenario={mockOnSelectScenario}
                onReset={mockOnReset}
            />
        );

        const pessimisticBtn = screen.getByRole('button', { name: /Stres-Test Bankowy/i });
        fireEvent.click(pessimisticBtn);

        expect(mockOnSelectScenario).toHaveBeenCalledTimes(1);
        expect(mockOnSelectScenario).toHaveBeenCalledWith('pessimistic', expect.objectContaining({
            capexDelta: 20,
            revenueDelta: -15,
            varCostDelta: 10,
            fixedCostDelta: 10,
        }));
    });

    it('calculates waccOverride dynamically for stagflation scenario', () => {
        render(
            <ScenarioPresetSelector
                activeScenario="base"
                baseWacc={8.50}
                onSelectScenario={mockOnSelectScenario}
                onReset={mockOnReset}
            />
        );

        const stagflationBtn = screen.getByRole('button', { name: /Stagflacja/i });
        fireEvent.click(stagflationBtn);

        expect(mockOnSelectScenario).toHaveBeenCalledTimes(1);
        expect(mockOnSelectScenario).toHaveBeenCalledWith('stagflation', expect.objectContaining({
            revenueDelta: -10,
            varCostDelta: 20,
            waccOverride: 10.50, // 8.50 + 2.0
        }));
    });

    it('calls onReset when Przywróć Bazę button is clicked', () => {
        render(
            <ScenarioPresetSelector
                activeScenario="pessimistic"
                onSelectScenario={mockOnSelectScenario}
                onReset={mockOnReset}
            />
        );

        const resetBtn = screen.getByRole('button', { name: /Przywróć Bazę/i });
        fireEvent.click(resetBtn);

        expect(mockOnReset).toHaveBeenCalledTimes(1);
    });

    it('renders custom scenario state when activeScenario is custom', () => {
        render(
            <ScenarioPresetSelector
                activeScenario="custom"
                onSelectScenario={mockOnSelectScenario}
                onReset={mockOnReset}
            />
        );

        expect(screen.getByText(/Własny \(Manualny\)/i)).toBeInTheDocument();
        expect(screen.getByText('Scenariusz Własny (Custom What-If)')).toBeInTheDocument();
        expect(screen.getByText('CUSTOM')).toBeInTheDocument();
    });
});
