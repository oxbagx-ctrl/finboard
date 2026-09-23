import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OperatingAssumptionsForm } from "../../components/investments/OperatingAssumptionsForm";
import { InvestmentProjectContext } from "../../context/InvestmentProjectContext";
import { investmentProjectsApi } from "../../api/investmentProjects";

vi.mock("../../api/investmentProjects", () => ({
  investmentProjectsApi: {
    updateProject: vi.fn(),
  },
}));

describe("OperatingAssumptionsForm Component", () => {
  const mockLoadProjectDetails = vi.fn();

  const mockProject = {
    id: "proj-101",
    name: "Elektrownia Biometanowa 5MW",
    currency: "PLN",
    status: "draft",
    commercial_operation_date: "2027-01-01",
    operating_assumptions: {
      annual_revenue_base: 5000000,
      revenue_growth_rate_percent: 3.0,
      variable_cost_percent: 35.0,
      annual_fixed_costs_base: 400000,
      fixed_cost_growth_rate_percent: 2.5,
      annual_payroll_base: 390355,
      payroll_growth_rate_percent: 3.5,
      dso: 30,
      dpo: 30,
      dio: 10,
      cit_rate_percent: 19.0,
      tax_loss_carry_forward_enabled: true,
      tax_loss_offset_cap_percent: 50.0,
      revenue_lines: [
        {
          id: "rev-1",
          name: "Sprzedaż biometanu",
          unit: "m3",
          volume: 2000000,
          price: 2.5,
          total: 5000000,
        },
      ],
      headcountMatrix: [
        {
          id: "hc-1",
          role: "Kierownik Biogazowni",
          fte: 1,
          grossSalary: 12000,
          employerCostRate: 20.48,
          annualCost: 173491,
        },
        {
          id: "hc-2",
          role: "Operator Techniczny",
          fte: 2,
          grossSalary: 7500,
          employerCostRate: 20.48,
          annualCost: 216864,
        },
      ],
      capacity_ramp_up: { 1: 65, 2: 85, 3: 100 },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithContext = (selectedProject = mockProject) => {
    const contextValue = {
      selectedProject,
      loadProjectDetails: mockLoadProjectDetails,
    };

    return render(
      <InvestmentProjectContext.Provider value={contextValue}>
        <OperatingAssumptionsForm />
      </InvestmentProjectContext.Provider>,
    );
  };

  it("renders empty message when no project is selected", () => {
    renderWithContext(null);
    expect(
      screen.getByText(
        /Wybierz projekt inwestycyjny, aby skonfigurować założenia operacyjne/i,
      ),
    ).toBeInTheDocument();
  });

  it("renders initial operating metrics and sub-tabs", () => {
    renderWithContext(mockProject);

    expect(
      screen.getByText(/Założenia Operacyjne & Model P&L/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/COD: 2027-01-01/i)).toBeInTheDocument();

    // Check KPI metrics
    expect(
      screen.getAllByText(/5.*000.*000,00/i).length,
    ).toBeGreaterThanOrEqual(1);

    // Check sub-tabs
    expect(
      screen.getByRole("button", { name: /1\. Przychody & Ramp-Up/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /2\. Koszty OPEX/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /3\. Kapitał Obrotowy/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /4\. Matryca Etatów/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /5\. Podatki & CIT/i }),
    ).toBeInTheDocument();
  });

  it("allows adding a new revenue line and updates total base revenue", () => {
    renderWithContext(mockProject);

    const addBtn = screen.getByRole("button", { name: /Dodaj Strumień/i });
    fireEvent.click(addBtn);

    // Now we should have 2 revenue lines
    const streamInputs = screen.getAllByLabelText(/Nazwa Strumienia/i);
    expect(streamInputs.length).toBe(2);

    // Base revenue is 5 000 000 + 100 000 = 5 100 000
    expect(
      screen.getAllByText(/5.*100.*000,00/i).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("displays live projection for revenues factoring ramp-up and organic growth", () => {
    renderWithContext(mockProject);

    const revPanel = screen.getByTestId("revenue-projection-panel");
    expect(revPanel).toBeInTheDocument();
    expect(
      screen.getByText(/Szacowane Przychody Wieloletnie:/i),
    ).toBeInTheDocument();

    // Year 1 COD: 5 000 000 * 0.65 ramp-up = 3 250 000 PLN
    expect(screen.getByText(/R1 COD:\s*3\s*250\s*000/i)).toBeInTheDocument();
  });

  it("switches to OPEX sub-tab and updates variable cost percentage", () => {
    renderWithContext(mockProject);

    const opexTab = screen.getByRole("button", { name: /2\. Koszty OPEX/i });
    fireEvent.click(opexTab);

    expect(
      screen.getByText(/Koszty Zmienne \(% Przychodów\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Roczne Koszty Stałe Bazowe/i)).toBeInTheDocument();

    const fixedCostInput = screen.getByLabelText(/Roczne Koszty Stałe Bazowe/i);
    fireEvent.change(fixedCostInput, { target: { value: "450000" } });
    expect(fixedCostInput.value).toBe("450000");
  });

  it("displays multi-year live projection panel for fixed costs and reacts to inflation slider changes", () => {
    renderWithContext(mockProject);

    const opexTab = screen.getByRole("button", { name: /2\. Koszty OPEX/i });
    fireEvent.click(opexTab);

    const projectionPanel = screen.getByTestId("fixed-cost-projection-panel");
    expect(projectionPanel).toBeInTheDocument();
    expect(
      screen.getByText(/Projekcja Eskalacji Kosztów Stałych \(15 lat\):/i),
    ).toBeInTheDocument();

    // Base 400 000 PLN, 2.5% inflation:
    // (1 + 0.025)^14 - 1 = +41.3% in Year 15
    expect(screen.getByText(/\+41\.3% w R15/i)).toBeInTheDocument();
    // Year 5: 400 000 * (1.025)^4 = 441 525,16 PLN
    expect(screen.getByText(/Rok 5 \(\+10\.4%\)/i)).toBeInTheDocument();
    // Year 10: 400 000 * (1.025)^9 = 499 545,19 PLN
    expect(screen.getByText(/Rok 10 \(\+24\.9%\)/i)).toBeInTheDocument();

    // Check explanatory formula callout
    expect(screen.getByText(/Baza × \(1 \+ r\)\^\(t-1\)/i)).toBeInTheDocument();

    // Adjust inflation slider to 5.0%
    const sliders = screen.getAllByRole("slider");
    // The fixed cost slider is the second slider in OPEX tab (first is variable cost %)
    const fixedCostSlider = sliders[1];
    fireEvent.change(fixedCostSlider, { target: { value: "5.0" } });

    // (1 + 0.05)^14 - 1 = +98.0% in Year 15
    expect(screen.getByText(/\+98\.0% w R15/i)).toBeInTheDocument();
    expect(screen.getByText(/Rok 5 \(\+21\.6%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Rok 10 \(\+55\.1%\)/i)).toBeInTheDocument();
  });

  it("switches to NWC sub-tab and calculates cash conversion cycle", () => {
    renderWithContext(mockProject);

    const nwcTab = screen.getByRole("button", {
      name: /3\. Kapitał Obrotowy/i,
    });
    fireEvent.click(nwcTab);

    // DSO = 30, DPO = 30, DIO = 10 -> CCC = 10 + 30 - 30 = 10 dni
    expect(screen.getAllByText(/10 dni/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/DSO \(Należności\)/i)).toBeInTheDocument();
    expect(screen.getByText(/DPO \(Zobowiązania\)/i)).toBeInTheDocument();
    expect(screen.getByText(/DIO \(Zapasy\)/i)).toBeInTheDocument();
  });

  it("switches to Payroll sub-tab and adds a new headcount role", () => {
    renderWithContext(mockProject);

    const payrollTab = screen.getByRole("button", {
      name: /4\. Matryca Etatów/i,
    });
    fireEvent.click(payrollTab);

    expect(
      screen.getByText(/Matryca Etatów & Koszty Wynagrodzeń/i),
    ).toBeInTheDocument();

    const addRoleBtn = screen.getByRole("button", {
      name: /Dodaj Stanowisko/i,
    });
    fireEvent.click(addRoleBtn);

    const roleInputs = screen.getAllByLabelText(/Nazwa Stanowiska/i);
    expect(roleInputs.length).toBe(3); // 2 initial + 1 new
  });

  it("switches to Taxes sub-tab and allows changing CIT rate with tax shield synchronization", () => {
    renderWithContext(mockProject);

    const taxesTab = screen.getByRole("button", { name: /5\. Podatki & CIT/i });
    fireEvent.click(taxesTab);

    expect(screen.getByText(/Stawka Podatku CIT/i)).toBeInTheDocument();
    // Verify typo is fixed
    expect(
      screen.getByText(/Limit Rocznego Odliczenia Straty \(%\)/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Stranty/i)).toBeNull();

    // Verify initial WACC tax shield info for 19% CIT
    expect(screen.getByTestId("wacc-tax-shield-info")).toBeInTheDocument();
    expect(
      screen.getByText(/Kd × \(1 - 19%\) = Kd × 0\.81/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Tarcza: 19%/i)).toBeInTheDocument();

    const cit9Btn = screen.getByRole("button", { name: /9% Preferencyjny/i });
    fireEvent.click(cit9Btn);

    expect(cit9Btn).toHaveClass("border-emerald-500");
    // Synchronized shield reflects 9% CIT
    expect(
      screen.getByText(/Kd × \(1 - 9%\) = Kd × 0\.91/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Tarcza: 9%/i)).toBeInTheDocument();
  });

  it("submits updated operating assumptions to API when clicking Save button", async () => {
    investmentProjectsApi.updateProject.mockResolvedValueOnce({
      data: { status: "success", data: mockProject },
    });

    renderWithContext(mockProject);

    const saveBtn = screen.getByRole("button", {
      name: /Zapisz Założenia Operacyjne/i,
    });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(investmentProjectsApi.updateProject).toHaveBeenCalledTimes(1);
      expect(investmentProjectsApi.updateProject).toHaveBeenCalledWith(
        "proj-101",
        expect.objectContaining({
          operating_assumptions: expect.objectContaining({
            annual_revenue_base: 5000000,
            variable_cost_percent: 35,
            dso: 30,
            dpo: 30,
            dio: 10,
            cit_rate_percent: 19,
          }),
        }),
      );
      expect(mockLoadProjectDetails).toHaveBeenCalledWith("proj-101");
      expect(
        screen.getByText(/Założenia operacyjne zostały pomyślnie zapisane/i),
      ).toBeInTheDocument();
    });
  });

  it("renders clean empty state for a newly created project without operating assumptions", () => {
    const brandNewProject = {
      id: "proj-new-999",
      name: "Nowy Projekt Portfelowy",
      currency: "PLN",
      status: "draft",
      commercial_operation_date: null,
      operating_assumptions: null,
    };

    renderWithContext(brandNewProject);

    expect(
      screen.getByText(/Brak zdefiniowanych strumieni przychodowych/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Kliknij „Dodaj Strumień”, aby zdefiniować model sprzedaży projektu/i,
      ),
    ).toBeInTheDocument();

    // Base revenue is 0,00 PLN
    expect(screen.getAllByText(/0,00\s*zł/i).length).toBeGreaterThanOrEqual(1);

    // Check Payroll tab has empty state as well
    const payrollTab = screen.getByRole("button", {
      name: /4\. Matryca Etatów/i,
    });
    fireEvent.click(payrollTab);

    expect(
      screen.getByText(/Brak zdefiniowanych stanowisk operacyjnych/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/0 FTE/i).length).toBeGreaterThanOrEqual(1);
  });

  it("allows adding first revenue stream from empty state", () => {
    const brandNewProject = {
      id: "proj-new-999",
      name: "Nowy Projekt Portfelowy",
      currency: "PLN",
      operating_assumptions: {},
    };

    renderWithContext(brandNewProject);

    expect(
      screen.getByText(/Brak zdefiniowanych strumieni przychodowych/i),
    ).toBeInTheDocument();

    const addBtn = screen.getByRole("button", { name: /Dodaj Strumień/i });
    fireEvent.click(addBtn);

    expect(
      screen.queryByText(/Brak zdefiniowanych strumieni przychodowych/i),
    ).not.toBeInTheDocument();
    const streamInputs = screen.getAllByLabelText(/Nazwa Strumienia/i);
    expect(streamInputs.length).toBe(1);
  });

  it("resets state when switching from configured project to an unconfigured project", () => {
    const brandNewProject = {
      id: "proj-new-999",
      name: "Nowy Czysty Projekt",
      currency: "PLN",
      operating_assumptions: {},
    };

    const { rerender } = render(
      <InvestmentProjectContext.Provider
        value={{
          selectedProject: mockProject,
          loadProjectDetails: mockLoadProjectDetails,
        }}
      >
        <OperatingAssumptionsForm />
      </InvestmentProjectContext.Provider>,
    );

    // Initial project has 5 000 000 PLN revenue
    expect(
      screen.getAllByText(/5.*000.*000,00/i).length,
    ).toBeGreaterThanOrEqual(1);

    // Switch project to brandNewProject
    rerender(
      <InvestmentProjectContext.Provider
        value={{
          selectedProject: brandNewProject,
          loadProjectDetails: mockLoadProjectDetails,
        }}
      >
        <OperatingAssumptionsForm />
      </InvestmentProjectContext.Provider>,
    );

    // Should now show empty state and not retain 5 000 000 PLN
    expect(
      screen.getByText(/Brak zdefiniowanych strumieni przychodowych/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/5.*000.*000,00/i)).not.toBeInTheDocument();
  });
});
