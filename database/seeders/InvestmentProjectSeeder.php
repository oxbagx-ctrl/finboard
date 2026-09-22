<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Company;
use App\Models\FinancialAuditLog;
use App\Models\InvestmentCapexStage;
use App\Models\InvestmentDebtFacility;
use App\Models\InvestmentFinancingStructure;
use App\Models\InvestmentGrantAllocation;
use App\Models\InvestmentProject;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Phase 46 Commit 227: InvestmentProjectSeeder
 * 
 * Seeds a comprehensive, institutionally balanced demo investment project
 * for portfolio company Acme Manufacturing S.A. (UUID: 22222222-2222-2222-2222-222222222222).
 * 
 * Project: "Rozbudowa Zautomatyzowanego Zakładu Produkcyjnego i Centrum R&D - ACME 2026"
 * Total Net CAPEX: 32 000 000,00 PLN
 * Financing Structure:
 *  - Equity (25%): 8 000 000,00 PLN (60% Sponsor / 40% Co-investor)
 *  - Senior Debt (Bank Loan): 14 000 000,00 PLN (12 years tenor, WIBOR 1M + 2.40% margin, annuity)
 *  - EU Grant (FENG SMART): 10 000 000,00 PLN (50% co-financing on 20M eligible costs)
 *  - VAT Bridge Loan: 5 500 000,00 PLN (revolving 60-day US tax reimbursement cycles)
 */
final class InvestmentProjectSeeder extends Seeder
{
    public const ACME_COMPANY_ID = '22222222-2222-2222-2222-222222222222';
    public const ADVISOR_USER_ID = '00000000-0000-0000-0000-000000000002';
    public const DEMO_PROJECT_ID = '33333333-3333-3333-3333-333333333333';

    public const PROJECT_NAME = 'Rozbudowa Zautomatyzowanego Zakładu Produkcyjnego i Centrum R&D - ACME 2026';

    public function run(): void
    {
        // 1. Verify that Acme Manufacturing company exists
        $company = Company::find(self::ACME_COMPANY_ID);
        if (!$company) {
            $company = Company::create([
                'id' => self::ACME_COMPANY_ID,
                'name' => 'Acme Manufacturing S.A.',
                'code' => 'ACME',
                'tax_id' => 'PL7010101010',
            ]);
        }

        // 2. Identify Creator (Advisor or fallback to first superadmin/user)
        $advisor = User::find(self::ADVISOR_USER_ID)
            ?? User::where('role', 'advisor')->first()
            ?? User::where('role', 'super_admin')->first()
            ?? User::first();

        $creatorId = $advisor?->id;

        DB::transaction(function () use ($creatorId) {
            // 3. Ensure idempotency: remove existing project if present
            $existingProject = InvestmentProject::where('id', self::DEMO_PROJECT_ID)
                ->orWhere(function ($query) {
                    $query->where('company_id', self::ACME_COMPANY_ID)
                        ->where('name', self::PROJECT_NAME);
                })
                ->first();

            if ($existingProject) {
                // Remove existing audit logs for this project to keep clean
                FinancialAuditLog::where('entity_type', 'InvestmentProject')
                    ->where('entity_id', $existingProject->id)
                    ->delete();

                // Cascade delete removes stages, financing structure, debt facilities, grant allocations
                $existingProject->delete();
            }

            // 4. Create Aggregate Root: InvestmentProject
            $project = InvestmentProject::create([
                'id' => self::DEMO_PROJECT_ID,
                'company_id' => self::ACME_COMPANY_ID,
                'name' => self::PROJECT_NAME,
                'description' => 'Kompleksowy program inwestycyjny obejmujący budowę nowoczesnej hali produkcyjno-magazynowej, wdrożenie zautomatyzowanych linii montażowych CNC oraz utworzenie zaawansowanego Centrum Badań i Rozwoju (R&D) dla komponentów przemysłowych nowej generacji.',
                'status' => 'approved',
                'currency' => 'PLN',
                'commercial_operation_date' => '2027-03-01',
                'created_by' => $creatorId,
                'operating_assumptions' => $this->buildOperatingAssumptions(),
            ]);

            // 5. Create 4 CAPEX Stages (Sum = 32 000 000,00 PLN)
            $capexStages = [
                [
                    'id' => (string) Str::uuid(),
                    'project_id' => $project->id,
                    'company_id' => self::ACME_COMPANY_ID,
                    'stage_name' => 'Nabycie gruntu inwestycyjnego pod rozbudowę',
                    'net_amount' => '4000000.00',
                    'currency' => 'PLN',
                    'vat_rate_percent' => '23.00',
                    'vat_rate_code' => 'PL_23',
                    'start_date' => '2026-01-01',
                    'completion_date' => '2026-02-28',
                    'kst_code' => 'KST_0',
                    'kst_annual_rate' => '0.00',
                    'eligible_for_grant' => false,
                    'order_index' => 1,
                ],
                [
                    'id' => (string) Str::uuid(),
                    'project_id' => $project->id,
                    'company_id' => self::ACME_COMPANY_ID,
                    'stage_name' => 'Roboty budowlano-konstrukcyjne hali produkcyjno-magazynowej',
                    'net_amount' => '12000000.00',
                    'currency' => 'PLN',
                    'vat_rate_percent' => '23.00',
                    'vat_rate_code' => 'PL_23',
                    'start_date' => '2026-03-01',
                    'completion_date' => '2026-10-31',
                    'kst_code' => 'KST_1',
                    'kst_annual_rate' => '2.50',
                    'eligible_for_grant' => true,
                    'order_index' => 2,
                ],
                [
                    'id' => (string) Str::uuid(),
                    'project_id' => $project->id,
                    'company_id' => self::ACME_COMPANY_ID,
                    'stage_name' => 'Zautomatyzowane linie montażowe i park maszynowy CNC',
                    'net_amount' => '11000000.00',
                    'currency' => 'PLN',
                    'vat_rate_percent' => '23.00',
                    'vat_rate_code' => 'PL_23',
                    'start_date' => '2026-06-01',
                    'completion_date' => '2026-12-31',
                    'kst_code' => 'KST_4',
                    'kst_annual_rate' => '10.00',
                    'eligible_for_grant' => true,
                    'order_index' => 3,
                ],
                [
                    'id' => (string) Str::uuid(),
                    'project_id' => $project->id,
                    'company_id' => self::ACME_COMPANY_ID,
                    'stage_name' => 'Oprogramowanie przemysłowe SCADA/MES oraz licencje R&D',
                    'net_amount' => '5000000.00',
                    'currency' => 'PLN',
                    'vat_rate_percent' => '23.00',
                    'vat_rate_code' => 'PL_23',
                    'start_date' => '2026-09-01',
                    'completion_date' => '2027-02-28',
                    'kst_code' => 'KST_IT',
                    'kst_annual_rate' => '20.00',
                    'eligible_for_grant' => true,
                    'order_index' => 4,
                ],
            ];

            foreach ($capexStages as $stageData) {
                InvestmentCapexStage::create($stageData);
            }

            // 6. Create Financing Structure (Montaż Finansowy)
            InvestmentFinancingStructure::create([
                'id' => (string) Str::uuid(),
                'project_id' => $project->id,
                'company_id' => self::ACME_COMPANY_ID,
                'equity_contribution' => '8000000.00',
                'bank_loan_amount' => '14000000.00',
                'grant_amount' => '10000000.00',
                'vat_bridge_loan' => '5500000.00',
                'currency' => 'PLN',
                'grant_disbursement_schedule' => [
                    [
                        'tranche_number' => 1,
                        'milestone' => 'Odbiór etapu 2 (Hala produkcyjno-magazynowa)',
                        'amount' => 4000000.00,
                        'disbursement_date' => '2026-11-15',
                        'status' => 'scheduled',
                    ],
                    [
                        'tranche_number' => 2,
                        'milestone' => 'Odbiór etapu 3 (Linie montażowe CNC)',
                        'amount' => 4000000.00,
                        'disbursement_date' => '2027-01-15',
                        'status' => 'scheduled',
                    ],
                    [
                        'tranche_number' => 3,
                        'milestone' => 'Rozliczenie końcowe etapu 4 (SCADA & Licencje R&D)',
                        'amount' => 2000000.00,
                        'disbursement_date' => '2027-03-31',
                        'status' => 'scheduled',
                    ],
                ],
            ]);

            // 7. Create Senior Debt Facility (Kredyt Inwestycyjny)
            InvestmentDebtFacility::create([
                'id' => (string) Str::uuid(),
                'project_id' => $project->id,
                'company_id' => self::ACME_COMPANY_ID,
                'facility_name' => 'Kredyt Inwestycyjny Konsorcjalny (Senior Debt)',
                'facility_type' => 'senior_term_loan',
                'principal_amount' => '14000000.00',
                'currency' => 'PLN',
                'base_rate_type' => 'WIBOR_1M',
                'base_rate_percent' => '5.85',
                'margin_percent' => '2.40',
                'tenor_months' => 144, // 12 lat
                'grace_period_months' => 14, // Karencja do COD (2027-03-01)
                'amortization_type' => 'ANNUITY',
                'upfront_fee_percent' => '1.50',
                'commitment_fee_percent' => '0.50',
                'interest_payment_frequency' => 'monthly',
                'principal_payment_frequency' => 'monthly',
            ]);

            // 8. Create Grant Allocation (Dotacja FENG SMART)
            InvestmentGrantAllocation::create([
                'id' => (string) Str::uuid(),
                'project_id' => $project->id,
                'company_id' => self::ACME_COMPANY_ID,
                'grant_program_name' => 'FENG - Ścieżka SMART (Innowacje w Przedsiębiorstwach)',
                'total_eligible_costs' => '20000000.00',
                'co_financing_rate_percent' => '50.00',
                'max_grant_amount' => '10000000.00',
                'advance_payment_amount' => '0.00',
                'currency' => 'PLN',
                'status' => 'approved',
                'disbursement_schedule' => [
                    [
                        'tranche_number' => 1,
                        'amount' => 4000000.00,
                        'expected_date' => '2026-11-15',
                        'condition' => 'Protokół odbioru robót budowlanych etapu 2',
                    ],
                    [
                        'tranche_number' => 2,
                        'amount' => 4000000.00,
                        'expected_date' => '2027-01-15',
                        'condition' => 'Odbiór technologiczny i uruchomienie maszyn CNC etapu 3',
                    ],
                    [
                        'tranche_number' => 3,
                        'amount' => 2000000.00,
                        'expected_date' => '2027-03-31',
                        'condition' => 'Wdrożenie produkcyjne SCADA/MES i raport końcowy R&D',
                    ],
                ],
                'notes' => 'Umowa o dofinansowanie w ramach programu FENG SMART. Koszty kwalifikowane 20 000 000 PLN, intensywność wsparcia 50%.',
            ]);

            // 9. Register Audit Trail Event (Ścieżka Audytowa)
            FinancialAuditLog::create([
                'id' => (string) Str::uuid(),
                'company_id' => self::ACME_COMPANY_ID,
                'user_id' => $creatorId,
                'action' => 'create',
                'entity_type' => 'InvestmentProject',
                'entity_id' => $project->id,
                'description' => 'Zainicjalizowano i zatwierdzono instytucjonalny projekt inwestycyjny: ' . self::PROJECT_NAME . ' (CAPEX 32 mln PLN, Kredyt Senior 14 mln PLN, Dotacja FENG 10 mln PLN, Wkład Własny 8 mln PLN).',
                'old_values' => null,
                'new_values' => [
                    'project_id' => $project->id,
                    'name' => self::PROJECT_NAME,
                    'total_capex' => 32000000.00,
                    'equity_contribution' => 8000000.00,
                    'bank_loan' => 14000000.00,
                    'grant_amount' => 10000000.00,
                    'vat_bridge_loan' => 5500000.00,
                    'commercial_operation_date' => '2027-03-01',
                    'status' => 'approved',
                ],
                'ip_address' => '127.0.0.1',
                'user_agent' => 'FinBoard Deal Advisory Seed Engine v2.0',
                'created_at' => Carbon::parse('2026-01-01 10:00:00'),
            ]);
        });
    }

    /**
     * Build rich, mathematically coherent 15-year operating assumptions,
     * working capital cycles, headcount matrix, reinvestments, and LMA criteria.
     *
     * @return array<string, mixed>
     */
    private function buildOperatingAssumptions(): array
    {
        return [
            // 1. Revenue streams & Growth
            'annual_revenue_base' => 32000000.00,
            'revenue_lines' => [
                [
                    'id' => 'rev-1',
                    'name' => 'Komponenty Przemysłowe Serii X',
                    'unit' => 'szt.',
                    'volume' => 50000,
                    'price' => 500.00,
                    'total' => 25000000.00,
                ],
                [
                    'id' => 'rev-2',
                    'name' => 'Usługi Precyzyjnej Obróbki CNC',
                    'unit' => 'r-godz.',
                    'volume' => 20000,
                    'price' => 350.00,
                    'total' => 7000000.00,
                ],
            ],
            'revenue_growth_rate_percent' => 3.5,
            'capacity_ramp_up' => [
                '1' => 40.0,
                '2' => 65.0,
                '3' => 85.0,
                '4' => 90.0,
                '5' => 100.0,
            ],

            // 2. OPEX & Production drivers
            'variable_cost_percent' => 24.0, // Surowce, stopy metali, energia technologiczna
            'annual_fixed_costs_base' => 2200000.00, // Utrzymanie hali, ubezpieczenia, media ogólne
            'fixed_cost_growth_rate_percent' => 2.5,

            // 3. Headcount Matrix & Payroll (20.48% Employer ZUS)
            'annual_payroll_base' => 2379721.00,
            'payroll_growth_rate_percent' => 3.0,
            'headcount_matrix' => [
                [
                    'id' => 'hc-1',
                    'role' => 'Dyrekcja Zakładu & Główny Inżynier R&D',
                    'fte' => 2,
                    'grossSalary' => 18000,
                    'employerCostRate' => 20.48,
                    'annualCost' => 520474,
                ],
                [
                    'id' => 'hc-2',
                    'role' => 'Inżynierowie Automatyki & Robotyki',
                    'fte' => 4,
                    'grossSalary' => 12500,
                    'employerCostRate' => 20.48,
                    'annualCost' => 722880,
                ],
                [
                    'id' => 'hc-3',
                    'role' => 'Operatorzy Maszyn CNC & Montażu Precyzyjnego',
                    'fte' => 8,
                    'grossSalary' => 7500,
                    'employerCostRate' => 20.48,
                    'annualCost' => 867456,
                ],
                [
                    'id' => 'hc-4',
                    'role' => 'Logistyka Wewnętrzna & Magazyn Wysokiego Składowania',
                    'fte' => 3,
                    'grossSalary' => 6200,
                    'employerCostRate' => 20.48,
                    'annualCost' => 268911,
                ],
            ],

            // 4. Net Working Capital (NWC Days)
            'dso' => 45, // Należności handlowe (45 dni)
            'dpo' => 30, // Zobowiązania handlowe (30 dni)
            'dio' => 20, // Zapasy materiałowe (20 dni)

            // 5. CIT Taxation & Tax Shield
            'cit_rate_percent' => 19.0,
            'tax_loss_carry_forward_enabled' => true,
            'tax_loss_offset_cap_percent' => 50.0,

            // 6. Cyclical Reinvestment Programs (Nakłady A i B)
            'reinvestments_enabled' => true,
            'reinvestment_programs' => [
                [
                    'id' => 'prog-a',
                    'program_type' => 'program_a',
                    'name' => 'Nakład A: Modernizacja parku maszyn CNC i automatyzacji',
                    'description' => 'Średnioterminowy remont i modernizacja precyzyjnych wrzecion CNC oraz modułów sterujących w roku 6',
                    'enabled' => true,
                    'net_amount' => 1500000.00,
                    'frequency_years' => 6,
                    'first_occurrence_year' => 6,
                    'kst_code' => 'KST_4',
                    'kst_annual_rate' => 10.0,
                    'color' => 'cyan',
                ],
                [
                    'id' => 'prog-b',
                    'program_type' => 'program_b',
                    'name' => 'Nakład B: Wymiana serwerów, sensorów IoT i licencji R&D',
                    'description' => 'Cykliczne odświeżenie infrastruktury obliczeniowej MES/SCADA, sieci sensorów IoT oraz stacji CAD/CAM w roku 10',
                    'enabled' => true,
                    'net_amount' => 600000.00,
                    'frequency_years' => 5,
                    'first_occurrence_year' => 10,
                    'kst_code' => 'KST_IT',
                    'kst_annual_rate' => 30.0,
                    'color' => 'emerald',
                ],
            ],

            // 7. WACC & Valuation Multiple
            'valuation_multiple' => [
                'multiple' => 7.5,
                'multiple_type' => 'ev_ebitda',
            ],
            'wacc_parameters' => [
                'risk_free_rate_percent' => 5.50,
                'equity_risk_premium_percent' => 5.50,
                'levered_beta' => 1.10,
                'cost_of_equity_percent' => 11.55,
                'target_debt_ratio_percent' => 45.0,
            ],

            // 8. Scenario Presets (Analiza Wrażliwości)
            'scenario_presets' => [
                'base' => [
                    'name' => 'Scenariusz Bazowy (Zatwierdzony LMA)',
                    'capexMultiplier' => 1.0,
                    'revenueMultiplier' => 1.0,
                    'variableCostMultiplier' => 1.0,
                    'fixedCostMultiplier' => 1.0,
                ],
                'pessimistic' => [
                    'name' => 'Scenariusz Pesymistyczny (Stress-Test)',
                    'capexMultiplier' => 1.10,
                    'revenueMultiplier' => 0.85,
                    'variableCostMultiplier' => 1.08,
                    'fixedCostMultiplier' => 1.05,
                ],
                'optimistic' => [
                    'name' => 'Scenariusz Optymistyczny (High Growth)',
                    'capexMultiplier' => 0.95,
                    'revenueMultiplier' => 1.15,
                    'variableCostMultiplier' => 0.95,
                    'fixedCostMultiplier' => 1.0,
                ],
            ],

            // 9. Exit Valuation & Equity Waterfall (Rok 7 / 2032)
            'exit_valuation' => [
                'exit_year' => 7,
                'exit_multiple' => 7.5,
                'target_irr_percent' => 20.0,
                'hurdle_rate_percent' => 8.0,
                'carried_interest_percent' => 80.0,
                'structure' => 'two_tier_hurdle',
            ],

            // 10. Investment Readiness Scorecard (Audyt Dojrzałości LMA)
            'readiness_scorecard' => [
                'criteria' => [
                    'leg_land_title' => 'passed',
                    'leg_permits' => 'passed',
                    'leg_grid_connection' => 'passed',
                    'leg_corporate' => 'passed',
                    'tech_engineering' => 'passed',
                    'tech_epc_contract' => 'passed',
                    'tech_om_warranty' => 'in_progress',
                    'tech_capex_breakdown' => 'passed',
                    'mkt_offtake_ppa' => 'passed',
                    'mkt_independent_dd' => 'passed',
                    'mkt_supply_contracts' => 'passed',
                    'mkt_rampup_plan' => 'passed',
                    'fin_equity_commitment' => 'passed',
                    'fin_bankability_dscr' => 'passed',
                    'fin_zero_variance' => 'passed',
                    'fin_reserve_accounts' => 'passed',
                ],
                'notes' => 'Projekt wykazuje dojrzałość inwestycyjną na poziomie A (88/100 pkt). Prawomocne PnB oraz zabezpieczone 65% wolumenu umowami warunkowymi i listami intencyjnymi (LOI).',
                'updated_at' => '2026-01-15T12:00:00Z',
            ],
        ];
    }
}
