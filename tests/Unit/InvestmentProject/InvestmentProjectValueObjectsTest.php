<?php

declare(strict_types=1);

namespace Tests\Unit\InvestmentProject;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CapitalizationRate;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InterestMargin;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\LoanTenor;
use App\Contexts\InvestmentProject\Domain\ValueObjects\ProjectBudget;
use App\Contexts\InvestmentProject\Domain\ValueObjects\ValuationMultiple;
use App\Contexts\InvestmentProject\Domain\ValueObjects\VatRate;
use App\Contexts\InvestmentProject\Domain\ValueObjects\WorkingCapitalDays;
use InvalidArgumentException;
use Tests\TestCase;

final class InvestmentProjectValueObjectsTest extends TestCase
{
    public function test_investment_project_id_generation_and_validation(): void
    {
        $id = InvestmentProjectId::generate();
        $this->assertNotEmpty($id->value());
        $this->assertEquals($id->value(), (string) $id);

        $parsed = InvestmentProjectId::fromString($id->value());
        $this->assertTrue($id->equals($parsed));

        $this->expectException(InvalidArgumentException::class);
        InvestmentProjectId::fromString('invalid-uuid-string');
    }

    public function test_interest_margin_conversions_and_rate_calculations(): void
    {
        $margin = InterestMargin::fromPercentage(2.25);
        $this->assertEquals(2.25, $margin->percentage());
        $this->assertEquals(0.0225, $margin->toDecimal());
        $this->assertEquals(225, $margin->toBasisPoints());

        // Base rate = 5.85% (WIBOR 3M), combined = 8.10%
        $combined = $margin->combinedRate(5.85);
        $this->assertEquals(8.10, $combined);

        // Monthly nominal rate: 8.10% / 12 = 0.675% = 0.00675
        $monthly = $margin->monthlyRate(5.85);
        $this->assertEqualsWithDelta(0.00675, $monthly, 0.00001);

        $this->assertEquals('2,25%', $margin->format());

        // Basis points constructor
        $fromBps = InterestMargin::fromBasisPoints(225);
        $this->assertTrue($margin->equals($fromBps));

        // Negative margin throws
        $this->expectException(InvalidArgumentException::class);
        new InterestMargin(-1.0);
    }

    public function test_loan_tenor_and_grace_period_calculations(): void
    {
        // 120 months (10 years) with 12 months grace period
        $tenor = LoanTenor::fromMonths(120, 12);
        $this->assertEquals(120, $tenor->tenorMonths());
        $this->assertEquals(12, $tenor->gracePeriodMonths());
        $this->assertEquals(108, $tenor->repaymentMonths());
        $this->assertEquals(10.0, $tenor->tenorYears());
        $this->assertTrue($tenor->hasGracePeriod());

        $tenorYears = LoanTenor::fromYears(15, 0);
        $this->assertEquals(180, $tenorYears->tenorMonths());
        $this->assertFalse($tenorYears->hasGracePeriod());

        // Grace period >= tenor throws
        $this->expectException(InvalidArgumentException::class);
        new LoanTenor(24, 24);
    }

    public function test_vat_rate_presets_and_tax_calculations(): void
    {
        $standard = VatRate::standard();
        $this->assertEquals(23.0, $standard->percentage());
        $this->assertEquals(0.23, $standard->toDecimal());

        $net = Money::fromDecimal('1000000.00', Currency::PLN);
        $vat = $standard->calculateVat($net);
        $this->assertEquals(230000.0, $vat->toDecimal());

        $gross = $standard->calculateGross($net);
        $this->assertEquals(1230000.0, $gross->toDecimal());

        // Reverse extraction from gross
        $extractedNet = $standard->extractNet($gross);
        $this->assertEquals(1000000.0, $extractedNet->toDecimal());

        $extractedVat = $standard->extractVat($gross);
        $this->assertEquals(230000.0, $extractedVat->toDecimal());

        $zero = VatRate::zero();
        $this->assertEquals(0.0, $zero->calculateVat($net)->toDecimal());
    }

    public function test_working_capital_days_and_nwc_calculations(): void
    {
        // DSO = 45 days, DPO = 30 days, DIO = 15 days
        $wc = WorkingCapitalDays::fromParams(45, 30, 15);
        $this->assertEquals(45, $wc->dso());
        $this->assertEquals(30, $wc->dpo());
        $this->assertEquals(15, $wc->dio());

        // Cash Conversion Cycle: 15 + 45 - 30 = 30 days
        $this->assertEquals(30, $wc->cashConversionCycle());

        $annualRevenue = Money::fromDecimal('7300000.00', Currency::PLN); // 20,000 / day
        $annualOpex = Money::fromDecimal('3650000.00', Currency::PLN); // 10,000 / day
        $annualCogs = Money::fromDecimal('1825000.00', Currency::PLN); // 5,000 / day

        // Receivables: 7,300,000 * (45/365) = 900,000
        $receivables = $wc->calculateReceivables($annualRevenue);
        $this->assertEquals(900000.0, $receivables->toDecimal());

        // Payables: 3,650,000 * (30/365) = 300,000
        $payables = $wc->calculatePayables($annualOpex);
        $this->assertEquals(300000.0, $payables->toDecimal());

        // Inventory: 1,825,000 * (15/365) = 75,000
        $inventory = $wc->calculateInventory($annualCogs);
        $this->assertEquals(75000.0, $inventory->toDecimal());

        // NWC: 900,000 + 75,000 - 300,000 = 675,000
        $nwc = $wc->calculateNetWorkingCapital($annualRevenue, $annualOpex, $annualCogs);
        $this->assertEquals(675000.0, $nwc->toDecimal());
    }

    public function test_capitalization_rate_and_valuation_calculations(): void
    {
        $capRate = CapitalizationRate::fromPercentage(7.5);
        $this->assertEquals(7.5, $capRate->percentage());
        $this->assertEquals(0.075, $capRate->toDecimal());
        $this->assertEquals('7,50%', $capRate->format());

        // Net Operating Income (NOI) = 750,000 PLN -> Asset value = 750,000 / 0.075 = 10,000,000 PLN
        $noi = Money::fromDecimal('750000.00', Currency::PLN);
        $val = $capRate->capitalizedValue($noi);
        $this->assertEquals(10000000.0, $val->toDecimal());

        // Cap rate <= 0 throws
        $this->expectException(InvalidArgumentException::class);
        new CapitalizationRate(0.0);
    }

    public function test_valuation_multiple_and_enterprise_equity_value(): void
    {
        $multiple = ValuationMultiple::fromFloat(8.5);
        $this->assertEquals(8.5, $multiple->multiple());
        $this->assertEquals('8,5x', $multiple->format());

        $ebitda = Money::fromDecimal('2000000.00', Currency::PLN);
        $netDebt = Money::fromDecimal('5000000.00', Currency::PLN);

        // Enterprise Value = 2,000,000 * 8.5 = 17,000,000
        $ev = $multiple->enterpriseValue($ebitda);
        $this->assertEquals(17000000.0, $ev->toDecimal());

        // Equity Value = 17,000,000 - 5,000,000 = 12,000,000
        $equity = $multiple->equityValue($ebitda, $netDebt);
        $this->assertEquals(12000000.0, $equity->toDecimal());

        // Multiple <= 0 throws
        $this->expectException(InvalidArgumentException::class);
        new ValuationMultiple(0.0);
    }

    public function test_project_budget_montage_ratios_and_funding_gap(): void
    {
        $netCapex = Money::fromDecimal('10000000.00', Currency::PLN);
        $equity = Money::fromDecimal('2000000.00', Currency::PLN); // 20%
        $debt = Money::fromDecimal('5000000.00', Currency::PLN);   // 50%
        $grant = Money::fromDecimal('3000000.00', Currency::PLN);  // 30%
        $vatLoan = Money::fromDecimal('2300000.00', Currency::PLN);

        $budget = ProjectBudget::create($netCapex, $equity, $debt, $grant, $vatLoan);

        $this->assertEquals(10000000.0, $budget->totalFinancing()->toDecimal());
        $this->assertTrue($budget->isFullyFunded());
        $this->assertEquals(0.0, $budget->fundingGap()->toDecimal());

        $this->assertEquals(20.0, $budget->equityRatio());
        $this->assertEquals(50.0, $budget->leverageRatio());
        $this->assertEquals(30.0, $budget->grantRatio());

        $vatRate = VatRate::standard();
        $this->assertEquals(12300000.0, $budget->totalGrossCapex($vatRate)->toDecimal());
        $this->assertEquals(2300000.0, $budget->totalVatRequired($vatRate)->toDecimal());

        // Underfunded budget test
        $underfundedBudget = ProjectBudget::create(
            $netCapex,
            Money::fromDecimal('1000000.00', Currency::PLN),
            Money::fromDecimal('5000000.00', Currency::PLN)
        );
        $this->assertFalse($underfundedBudget->isFullyFunded());
        $this->assertEquals(4000000.0, $underfundedBudget->fundingGap()->toDecimal());
    }
}
