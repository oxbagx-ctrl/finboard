<?php

declare(strict_types=1);

namespace Tests\Unit\InvestmentProject;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Domain\Entities\DebtFacility;
use App\Contexts\InvestmentProject\Domain\Services\DebtAmortizationService;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AmortizationType;
use App\Contexts\InvestmentProject\Domain\ValueObjects\DebtFacilityId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InterestMargin;
use App\Contexts\InvestmentProject\Domain\ValueObjects\LoanTenor;
use DateTimeImmutable;
use Tests\TestCase;

final class DebtAmortizationServiceTest extends TestCase
{
    private DebtAmortizationService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new DebtAmortizationService();
    }

    public function test_annuity_schedule_without_grace_period(): void
    {
        $principal = Money::fromDecimal('1200000.0000', Currency::PLN);
        $rate = 6.0; // 6% annual -> 0.5% monthly
        $tenor = LoanTenor::fromMonths(24, 0); // 24 months, no grace

        $schedule = $this->service->generateScheduleForParameters(
            principal: $principal,
            nominalAnnualRate: $rate,
            tenor: $tenor,
            amortizationType: AmortizationType::ANNUITY,
            upfrontFeeRate: 1.5
        );

        $this->assertEquals(24, $schedule->periodCount());
        $this->assertEquals('18000.0000', $schedule->upfrontFee()->amount());
        $this->assertEquals('1200000.0000', $schedule->totalPrincipalPaid()->amount());
        $this->assertTrue($schedule->outstandingBalanceAt(24)->isZero());

        // Check first period: opening balance 1,200,000, interest = 1,200,000 * 0.005 = 6,000
        $p1 = $schedule->period(1);
        $this->assertNotNull($p1);
        $this->assertEquals('1200000.0000', $p1->openingBalance()->amount());
        $this->assertEquals('6000.0000', $p1->interestPayment()->amount());
        $this->assertFalse($p1->isGracePeriod());

        // In annuity, installments across periods 1..23 are virtually identical
        $p2 = $schedule->period(2);
        $this->assertNotNull($p2);
        $diff = abs((float) $p1->totalPayment()->amount() - (float) $p2->totalPayment()->amount());
        $this->assertLessThan(0.02, $diff);

        // Principal paid increases each month in annuity
        $this->assertTrue($p2->principalPayment()->greaterThan($p1->principalPayment()));
    }

    public function test_annuity_schedule_with_grace_period(): void
    {
        $principal = Money::fromDecimal('1000000.0000', Currency::PLN);
        $rate = 12.0; // 12% annual -> 1.0% monthly
        $tenor = LoanTenor::fromMonths(36, 6); // 36 months, 6 months grace

        $schedule = $this->service->generateScheduleForParameters(
            principal: $principal,
            nominalAnnualRate: $rate,
            tenor: $tenor,
            amortizationType: AmortizationType::ANNUITY
        );

        $this->assertEquals(36, $schedule->periodCount());

        // Periods 1..6 (Grace period): principal payment = 0, interest = 10,000, balance remains 1,000,000
        for ($m = 1; $m <= 6; $m++) {
            $p = $schedule->period($m);
            $this->assertNotNull($p);
            $this->assertTrue($p->isGracePeriod());
            $this->assertEquals('0.0000', $p->principalPayment()->amount());
            $this->assertEquals('10000.0000', $p->interestPayment()->amount());
            $this->assertEquals('1000000.0000', $p->closingBalance()->amount());
        }

        // Period 7 (First repayment month): principal payment > 0
        $p7 = $schedule->period(7);
        $this->assertNotNull($p7);
        $this->assertFalse($p7->isGracePeriod());
        $this->assertTrue($p7->principalPayment()->greaterThan(Money::zero(Currency::PLN)));
        $this->assertTrue($p7->closingBalance()->lessThan(Money::fromDecimal('1000000.0000', Currency::PLN)));

        // Total principal paid across 36 months is exactly 1,000,000
        $this->assertEquals('1000000.0000', $schedule->totalPrincipalPaid()->amount());
        $this->assertTrue($schedule->outstandingBalanceAt(36)->isZero());
    }

    public function test_linear_schedule_has_constant_principal_and_decreasing_total(): void
    {
        $principal = Money::fromDecimal('600000.0000', Currency::PLN);
        $rate = 6.0;
        $tenor = LoanTenor::fromMonths(12, 0); // 12 months, no grace

        $schedule = $this->service->generateScheduleForParameters(
            principal: $principal,
            nominalAnnualRate: $rate,
            tenor: $tenor,
            amortizationType: AmortizationType::LINEAR
        );

        $this->assertEquals(12, $schedule->periodCount());
        $this->assertEquals('600000.0000', $schedule->totalPrincipalPaid()->amount());
        $this->assertTrue($schedule->outstandingBalanceAt(12)->isZero());

        // Linear principal per month = 600,000 / 12 = 50,000
        for ($m = 1; $m <= 12; $m++) {
            $p = $schedule->period($m);
            $this->assertNotNull($p);
            $this->assertEquals('50000.0000', $p->principalPayment()->amount());
        }

        // Total payment decreases each month as balance shrinks
        $p1 = $schedule->period(1);
        $p12 = $schedule->period(12);
        $this->assertNotNull($p1);
        $this->assertNotNull($p12);
        $this->assertTrue($p1->totalPayment()->greaterThan($p12->totalPayment()));
        $this->assertEquals('53000.0000', $p1->totalPayment()->amount()); // 50,000 + (600,000 * 0.005 = 3,000)
    }

    public function test_bullet_schedule_pays_principal_in_final_month(): void
    {
        $principal = Money::fromDecimal('500000.0000', Currency::PLN);
        $rate = 8.0; // 8% annual
        $tenor = LoanTenor::fromMonths(12, 0);

        $schedule = $this->service->generateScheduleForParameters(
            principal: $principal,
            nominalAnnualRate: $rate,
            tenor: $tenor,
            amortizationType: AmortizationType::BULLET
        );

        $this->assertEquals(12, $schedule->periodCount());

        // Months 1..11: only interest paid
        for ($m = 1; $m <= 11; $m++) {
            $p = $schedule->period($m);
            $this->assertNotNull($p);
            $this->assertEquals('0.0000', $p->principalPayment()->amount());
            $this->assertEquals('500000.0000', $p->closingBalance()->amount());
        }

        // Month 12: full 500,000 principal paid
        $p12 = $schedule->period(12);
        $this->assertNotNull($p12);
        $this->assertEquals('500000.0000', $p12->principalPayment()->amount());
        $this->assertEquals('0.0000', $p12->closingBalance()->amount());
        $this->assertEquals('500000.0000', $schedule->totalPrincipalPaid()->amount());
    }

    public function test_annual_summary_aggregation(): void
    {
        $principal = Money::fromDecimal('3600000.0000', Currency::PLN);
        $rate = 6.0;
        $tenor = LoanTenor::fromMonths(36, 0); // 3-year loan

        $schedule = $this->service->generateScheduleForParameters(
            principal: $principal,
            nominalAnnualRate: $rate,
            tenor: $tenor,
            amortizationType: AmortizationType::LINEAR
        );

        $annual = $schedule->annualSummaries();
        $this->assertCount(3, $annual);

        $y1 = $schedule->annualSummary(1);
        $this->assertNotNull($y1);
        $this->assertEquals(1, $y1->year());
        $this->assertEquals('3600000.0000', $y1->openingBalance()->amount());
        $this->assertEquals('1200000.0000', $y1->principalPaid()->amount()); // 12 * 100,000.0000
        $this->assertEquals('2400000.0000', $y1->closingBalance()->amount());

        $y3 = $schedule->annualSummary(3);
        $this->assertNotNull($y3);
        $this->assertEquals(3, $y3->year());
        $this->assertEquals('0.0000', $y3->closingBalance()->amount());

        $totalAnnualPrincipal = $y1->principalPaid()
            ->add($schedule->annualSummary(2)->principalPaid())
            ->add($y3->principalPaid());
        $this->assertEquals('3600000.0000', $totalAnnualPrincipal->amount());
    }

    public function test_generate_schedule_from_debt_facility_entity(): void
    {
        $facility = new DebtFacility(
            id: DebtFacilityId::generate(),
            name: 'Kredyt Bankowy OZE',
            committedAmount: Money::fromDecimal('15000000.0000', Currency::PLN),
            margin: InterestMargin::fromPercentage(2.25),
            baseRate: 5.85,
            tenor: LoanTenor::fromMonths(120, 12),
            amortizationType: AmortizationType::ANNUITY,
            upfrontFeeRate: 1.0,
            drawdownDate: new DateTimeImmutable('2026-04-01')
        );

        $schedule = $this->service->generateSchedule($facility);

        $this->assertEquals(120, $schedule->periodCount());
        $this->assertEquals(8.10, $schedule->nominalAnnualRate()); // 5.85 + 2.25
        $this->assertEquals('150000.0000', $schedule->upfrontFee()->amount()); // 1% of 15m
        $this->assertEquals('15000000.0000', $schedule->totalPrincipalPaid()->amount());
        $this->assertTrue($schedule->outstandingBalanceAt(120)->isZero());

        // 10 years of annual summaries
        $this->assertCount(10, $schedule->annualSummaries());
    }

    public function test_zero_principal_and_zero_rate_edge_cases(): void
    {
        $zeroSchedule = $this->service->generateScheduleForParameters(
            principal: Money::zero(Currency::PLN),
            nominalAnnualRate: 5.0,
            tenor: LoanTenor::fromMonths(12, 0),
            amortizationType: AmortizationType::ANNUITY
        );

        $this->assertEquals(0, $zeroSchedule->periodCount());
        $this->assertEquals('0.0000', $zeroSchedule->totalPrincipalPaid()->amount());

        // 0% interest loan
        $zeroRateSchedule = $this->service->generateScheduleForParameters(
            principal: Money::fromDecimal('12000.0000', Currency::PLN),
            nominalAnnualRate: 0.0,
            tenor: LoanTenor::fromMonths(12, 0),
            amortizationType: AmortizationType::ANNUITY
        );

        $this->assertEquals(12, $zeroRateSchedule->periodCount());
        $this->assertEquals('0.0000', $zeroRateSchedule->totalInterestPaid()->amount());
        $this->assertEquals('12000.0000', $zeroRateSchedule->totalPrincipalPaid()->amount());
        $this->assertEquals('1000.0000', $zeroRateSchedule->period(1)->principalPayment()->amount());
    }
}
