import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReinvestmentManager, DEFAULT_REINVESTMENT_PROGRAMS } from '../../components/investments/ReinvestmentManager';
import { InvestmentProjectContext } from '../../context/InvestmentProjectContext';
import { investmentProjectsApi } from '../../api/investmentProjects';

// Mock investmentProjectsApi
vi.mock('../../api/investmentProjects', () => ({
    investmentProjectsApi: {
        updateProject: vi.fn(),
    },
}));

describe('ReinvestmentManager Component (Phase 43 Commit 214)', () => {
    const mockLoadProjectDetails = vi.fn();
    const mockOnProgramsChange = vi.fn();

    const mockProject = {
        id: 'proj-solar-bess',
        name: 'Farma PV 50MW + BESS 20MWh',
        currency: 'PLN',
        operating_assumptions: {
            reinvestments_enabled: true,
            reinvestment_programs: [
                {
                    id: 'prog-a',
                    program_type: 'program_a',
                    name: 'Program A: Elektronika, SCADA i Falowniki',
                    description: 'Wymiana falowników i SCADA',
                    enabled: true,
                    net_amount: 1500000,
                    frequency_years: 5,
                    first_occurrence_year: 5,
                    kst_code: 'KST_IT',
                    kst_annual_rate: 30.0,
                },
                {
                    id: 'prog-b',
                    program_type: 'program_b',
                    name: 'Program B: Remont Kapitalny Maszyn i Ciągów',
                    description: 'Remonty średnie i generalne',
                    enabled: true,
                    net_amount: 4000000,
                    frequency_years: 7,
                    first_occurrence_year: 7,
                    kst_code: 'KST_4',
                    kst_annual_rate: 10.0,
                },
                {
                    id: 'prog-c',
                    program_type: 'program_c',
                    name: 'Program C: Tabor i Osprzęt Pomocniczy',
                    description: 'Wymiana osprzętu',
                    enabled: true,
                    net_amount: 2000000,
                    frequency_years: 5,
                    first_occurrence_year: 5,
                    kst_code: 'KST_7',
                    kst_annual_rate: 20.0,
                }
            ]
        }
    };

    const renderComponent = (props = {}, project = mockProject) => {
        const contextValue = {
            selectedProject: project,
            loadProjectDetails: mockLoadProjectDetails,
        };

        return render(
            <InvestmentProjectContext.Provider value={contextValue}>
                <ReinvestmentManager onProgramsChange={mockOnProgramsChange} {...props} />
            </InvestmentProjectContext.Provider>
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
        investmentProjectsApi.updateProject.mockResolvedValue({ success: true });
        mockLoadProjectDetails.mockResolvedValue({});
    });

    it('renders component headers, master controls, and program cards A, B, C', () => {
        renderComponent();

        expect(screen.getByText(/Harmonogram Nakładów Odtworzeniowych/i)).toBeInTheDocument();
        expect(screen.getByText(/KŚT \/ 15L/i)).toBeInTheDocument();
        expect(screen.getByText(/Włącz Reinvestment w Modelu/i)).toBeInTheDocument();

        // 3 Program badges
        expect(screen.getByText('NAKŁAD A')).toBeInTheDocument();
        expect(screen.getByText('NAKŁAD B')).toBeInTheDocument();
        expect(screen.getByText('NAKŁAD C')).toBeInTheDocument();

        // Check program titles
        expect(screen.getByText(/Program A: Elektronika, SCADA i Falowniki/i)).toBeInTheDocument();
        expect(screen.getByText(/Program B: Remont Kapitalny Maszyn i Ciągów/i)).toBeInTheDocument();
        expect(screen.getByText(/Program C: Tabor i Osprzęt Pomocniczy/i)).toBeInTheDocument();
    });

    it('displays summary KPI strip with 15-year total capex, event count, and CIT tax shield', () => {
        renderComponent();

        // Program A: Y5, Y10, Y15 (3 * 1.5M = 4.5M)
        // Program B: Y7, Y14 (2 * 4.0M = 8.0M)
        // Program C: Y5, Y10, Y15 (3 * 2.0M = 6.0M)
        // Total = 4.5 + 8.0 + 6.0 = 18.5M PLN, 8 events
        expect(screen.getByText(/Suma Reinvestmentu \(15L\)/i)).toBeInTheDocument();
        expect(screen.getByText(/18\s*500\s*000,00 PLN/i)).toBeInTheDocument();
        expect(screen.getByText(/8 cykli odtworzeniowych/i)).toBeInTheDocument();

        // Tax Shield 19% of 18.5M = 3.515M PLN
        expect(screen.getByText(/Tarcza Podatkowa \(CIT 19%\)/i)).toBeInTheDocument();
        expect(screen.getByText(/\+3\s*515\s*000,00 PLN/i)).toBeInTheDocument();
    });

    it('renders 15-Year Timeline Grid with occurrences for A, B, and C', () => {
        renderComponent();

        expect(screen.getByText(/Matryca Wdrożeń Reinvestmentu/i)).toBeInTheDocument();

        // Timeline columns Y1 to Y15
        for (let yr = 1; yr <= 15; yr++) {
            expect(screen.getByText(`Y${yr}`)).toBeInTheDocument();
        }

        // Check that badges A, B, C appear in the timeline
        const allABadges = screen.getAllByText('A');
        const allBBadges = screen.getAllByText('B');
        const allCBadges = screen.getAllByText('C');

        expect(allABadges.length).toBeGreaterThanOrEqual(3);
        expect(allBBadges.length).toBeGreaterThanOrEqual(2);
        expect(allCBadges.length).toBeGreaterThanOrEqual(3);
    });

    it('updates program net amount and recalculates summary KPIs and timeline', () => {
        renderComponent();

        const amountInputs = screen.getAllByRole('spinbutton');
        // First input is Program A net amount (1500000)
        expect(amountInputs[0].value).toBe('1500000');

        fireEvent.change(amountInputs[0], { target: { value: '2500000' } });
        expect(amountInputs[0].value).toBe('2500000');

        // Total should now be 18.5M + (3 * 1.0M) = 21.5M PLN
        expect(screen.getByText(/21\s*500\s*000,00 PLN/i)).toBeInTheDocument();
        expect(screen.getByText(/Niezapisane zmiany założeń/i)).toBeInTheDocument();
    });

    it('toggles a program off and recalculates total and timeline occurrences', () => {
        renderComponent();

        // Checkboxes: 1 master switch + 3 program toggles
        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes.length).toBe(4);

        // Toggle Program A off (checkbox at index 1)
        fireEvent.click(checkboxes[1]);

        // Program A (4.5M) disabled, total becomes 14.0M PLN (8.0M + 6.0M)
        expect(screen.getByText(/14\s*000\s*000,00 PLN/i)).toBeInTheDocument();
        expect(screen.getByText(/5 cykli odtworzeniowych/i)).toBeInTheDocument();
    });

    it('changes KŚT classification and automatically updates KŚT annual rate', () => {
        renderComponent();

        // Select KST dropdown for Program A (first combobox for KST is the 3rd select on page: freq, firstYr, KST)
        const selects = screen.getAllByRole('combobox');
        const kstSelectProgramA = selects[2]; // 0: freqA, 1: firstYrA, 2: kstA

        fireEvent.change(kstSelectProgramA, { target: { value: 'KST_5' } }); // 14% rate
        expect(kstSelectProgramA.value).toBe('KST_5');

        // Check if 14% rocznie is shown
        expect(screen.getByText(/14% rocznie/i)).toBeInTheDocument();
    });

    it('saves updated reinvestment assumptions to the backend API', async () => {
        renderComponent();

        // Change an input to mark unsaved changes
        const amountInputs = screen.getAllByRole('spinbutton');
        fireEvent.change(amountInputs[0], { target: { value: '1800000' } });

        const saveButton = screen.getByRole('button', { name: /Zapisz Założenia Reinvestmentu/i });
        expect(saveButton).not.toBeDisabled();

        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(investmentProjectsApi.updateProject).toHaveBeenCalledTimes(1);
            expect(investmentProjectsApi.updateProject).toHaveBeenCalledWith(
                'proj-solar-bess',
                expect.objectContaining({
                    operating_assumptions: expect.objectContaining({
                        reinvestments_enabled: true,
                        reinvestment_programs: expect.arrayContaining([
                            expect.objectContaining({
                                program_type: 'program_a',
                                net_amount: 1800000
                            })
                        ])
                    })
                })
            );
            expect(mockLoadProjectDetails).toHaveBeenCalledWith('proj-solar-bess');
            expect(screen.getByText(/Programy odtworzeniowe zostały pomyślnie zapisane/i)).toBeInTheDocument();
        });
    });

    it('resets to default programs on click of reset button', () => {
        renderComponent();

        const amountInputs = screen.getAllByRole('spinbutton');
        fireEvent.change(amountInputs[0], { target: { value: '9999999' } });

        const resetButton = screen.getByRole('button', { name: /Przywróć Domyślne A, B, C/i });
        fireEvent.click(resetButton);

        expect(amountInputs[0].value).toBe('1500000');
        expect(screen.getByText(/18\s*500\s*000,00 PLN/i)).toBeInTheDocument();
    });

    it('disables a program and preserves enabled: false state across saves and reloads (Commit 232)', async () => {
        const { rerender } = renderComponent();

        const checkboxes = screen.getAllByRole('checkbox');
        // checkboxes[0] = master switch, checkboxes[1] = Program A, checkboxes[2] = Program B, checkboxes[3] = Program C
        expect(checkboxes[2]).toBeChecked();

        // Uncheck Program B
        fireEvent.click(checkboxes[2]);
        expect(checkboxes[2]).not.toBeChecked();

        const saveButton = screen.getByRole('button', { name: /Zapisz Założenia Reinvestmentu/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(investmentProjectsApi.updateProject).toHaveBeenCalledWith(
                'proj-solar-bess',
                expect.objectContaining({
                    operating_assumptions: expect.objectContaining({
                        reinvestments_enabled: true,
                        reinvestment_programs: expect.arrayContaining([
                            expect.objectContaining({
                                program_type: 'program_b',
                                enabled: false,
                            })
                        ])
                    })
                })
            );
        });

        // Simulate reload with updated project returned from backend
        const updatedProject = {
            ...mockProject,
            operating_assumptions: {
                ...mockProject.operating_assumptions,
                reinvestment_programs: mockProject.operating_assumptions.reinvestment_programs.map(p =>
                    p.program_type === 'program_b' ? { ...p, enabled: false } : p
                )
            }
        };

        rerender(
            <InvestmentProjectContext.Provider value={{ selectedProject: updatedProject, loadProjectDetails: mockLoadProjectDetails }}>
                <ReinvestmentManager onProgramsChange={mockOnProgramsChange} />
            </InvestmentProjectContext.Provider>
        );

        const updatedCheckboxes = screen.getAllByRole('checkbox');
        expect(updatedCheckboxes[2]).not.toBeChecked();
    });

    it('allows editing program name and description, saves to backend, and persists upon reload (Commit 234)', async () => {
        const { rerender } = renderComponent();

        const nameInputA = screen.getByLabelText(/Nazwa Programu A/i);
        const descInputA = screen.getByLabelText(/Opis i Zakres Rzeczowy A/i);

        expect(nameInputA.value).toBe('Program A: Elektronika, SCADA i Falowniki');
        expect(descInputA.value).toBe('Wymiana falowników i SCADA');

        // Change name and description
        fireEvent.change(nameInputA, { target: { value: 'Program A: Wymiana Robotów Spawalniczych' } });
        fireEvent.change(descInputA, { target: { value: 'Modernizacja osprzętu robotów na linii nadwozi' } });

        expect(nameInputA.value).toBe('Program A: Wymiana Robotów Spawalniczych');
        expect(descInputA.value).toBe('Modernizacja osprzętu robotów na linii nadwozi');

        // Card header reflects new title immediately
        expect(screen.getByText('Program A: Wymiana Robotów Spawalniczych')).toBeInTheDocument();

        // Save
        const saveButton = screen.getByRole('button', { name: /Zapisz Założenia Reinvestmentu/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(investmentProjectsApi.updateProject).toHaveBeenCalledWith(
                'proj-solar-bess',
                expect.objectContaining({
                    operating_assumptions: expect.objectContaining({
                        reinvestment_programs: expect.arrayContaining([
                            expect.objectContaining({
                                program_type: 'program_a',
                                name: 'Program A: Wymiana Robotów Spawalniczych',
                                description: 'Modernizacja osprzętu robotów na linii nadwozi',
                            })
                        ])
                    })
                })
            );
        });

        // Simulate reload with updated project from API
        const updatedProject = {
            ...mockProject,
            operating_assumptions: {
                ...mockProject.operating_assumptions,
                reinvestment_programs: mockProject.operating_assumptions.reinvestment_programs.map(p =>
                    p.program_type === 'program_a'
                        ? { ...p, name: 'Program A: Wymiana Robotów Spawalniczych', description: 'Modernizacja osprzętu robotów na linii nadwozi' }
                        : p
                )
            }
        };

        rerender(
            <InvestmentProjectContext.Provider value={{ selectedProject: updatedProject, loadProjectDetails: mockLoadProjectDetails }}>
                <ReinvestmentManager onProgramsChange={mockOnProgramsChange} />
            </InvestmentProjectContext.Provider>
        );

        expect(screen.getByLabelText(/Nazwa Programu A/i).value).toBe('Program A: Wymiana Robotów Spawalniczych');
        expect(screen.getByLabelText(/Opis i Zakres Rzeczowy A/i).value).toBe('Modernizacja osprzętu robotów na linii nadwozi');
    });

    it('renders dynamic legend with reactive names and filters out disabled programs (Commit 235)', () => {
        renderComponent();

        const legend = screen.getByTestId('timeline-legend');

        // Initially all 3 programs are enabled with default names
        expect(legend).toHaveTextContent(/Nakład A \(Elektronika, SCADA i Falowniki\)/i);
        expect(legend).toHaveTextContent(/Nakład B \(Remont Kapitalny Maszyn i Ciągów\)/i);
        expect(legend).toHaveTextContent(/Nakład C \(Tabor i Osprzęt Pomocniczy\)/i);

        // Rename Program A to "Program A: Lorem" and Program B to "Program B: Ipsum"
        const nameInputA = screen.getByLabelText(/Nazwa Programu A/i);
        const nameInputB = screen.getByLabelText(/Nazwa Programu B/i);
        fireEvent.change(nameInputA, { target: { value: 'Program A: Lorem' } });
        fireEvent.change(nameInputB, { target: { value: 'Program B: Ipsum' } });

        expect(legend).toHaveTextContent('Nakład A (Lorem)');
        expect(legend).toHaveTextContent('Nakład B (Ipsum)');

        // Disable Program C
        const checkboxes = screen.getAllByRole('checkbox');
        // checkboxes[0] = master, checkboxes[1] = A, checkboxes[2] = B, checkboxes[3] = C
        fireEvent.click(checkboxes[3]);

        // Program C should now be absent from the legend
        expect(legend).not.toHaveTextContent(/Nakład C/i);
        expect(legend).toHaveTextContent('Nakład A (Lorem)');
        expect(legend).toHaveTextContent('Nakład B (Ipsum)');

        // Disable master reinvestments switch
        fireEvent.click(checkboxes[0]);
        expect(legend).toHaveTextContent(/Reinvestment wyłączony w modelu/i);
        expect(legend).not.toHaveTextContent(/Nakład A/i);
    });
});



