<?php

declare(strict_types=1);

namespace Tests\Unit\InvestmentProject;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Domain\ValueObjects\TaxLossPool;
use App\Contexts\InvestmentProject\Domain\ValueObjects\TaxLossSettlementMode;
use App\Contexts\InvestmentProject\Domain\ValueObjects\TaxLossVintage;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

class TaxLossPoolTest extends TestCase
{
    private Currency $currency;

    protected function setUp(): void
    {
        parent::setUp();
        $this->currency = Currency::PLN;
    }

    public function test_vintage_creation_and_statutory_parameters(): void
    {
        $amount = new Money('1000000.0000', $this->currency);
        $vintage = TaxLossVintage::create(originYear: 1, amount: $amount);

        $this->assertSame(1, $vintage->originYear());
        $this->assertSame(6, $vintage->expiryYear()); // 1 + 5 years
        $this->assertTrue($vintage->initialAmount()->equals($amount));
        $this->assertTrue($vintage->remainingAmount()->equals($amount));
        $this->assertTrue($vintage->settledAmount()->isZero());
        $this->assertFalse($vintage->hasUsedOneOffDeduction());

        // In year 1 (origin year), loss is not available to offset year 1 income
        $this->assertFalse($vintage->isAvailable(1));
        $this->assertFalse($vintage->isExpired(1));

        // Available in years 2 through 6
        for ($y = 2; $y <= 6; $y++) {
            $this->assertTrue($vintage->isAvailable($y), "Should be available in year {$y}");
            $this->assertFalse($vintage->isExpired($y), "Should not be expired in year {$y}");
        }

        // In year 7, vintage is expired
        $this->assertFalse($vintage->isAvailable(7));
        $this->assertTrue($vintage->isExpired(7));
    }

    public function test_vintage_invalid_parameters_throw_exceptions(): void
    {
        $amount = new Money('1000000.0000', $this->currency);

        $this->expectException(InvalidArgumentException::class);
        new TaxLossVintage(
            originYear: 0,
            initialAmount: $amount,
            remainingAmount: $amount,
            settledAmount: Money::zero($this->currency),
            expiryYear: 5
        );
    }

    public function test_standard_loss_cap_limits_annual_deduction_to_fifty_percent_of_initial_loss(): void
    {
        // art. 7 ust. 5 pkt 1 ustawy o CIT
        $vintage = TaxLossVintage::create(1, new Money('1000000.0000', $this->currency));

        // Max deduction in year 2 is 50% of initial loss = 500,000 PLN
        $maxDeductible = $vintage->maxDeductibleInYear(2, TaxLossSettlementMode::STANDARD_LOSS_CAP, 50.0);
        $this->assertTrue($maxDeductible->equals(new Money('500000.0000', $this->currency)));

        // Settle 400,000 PLN in year 2
        $vintageAfterY2 = $vintage->settle(new Money('400000.0000', $this->currency));
        $this->assertTrue($vintageAfterY2->remainingAmount()->equals(new Money('600000.0000', $this->currency)));
        $this->assertTrue($vintageAfterY2->settledAmount()->equals(new Money('400000.0000', $this->currency)));

        // In year 3, remaining is 600,000 PLN, but max annual cap is still 50% of initial loss (500,000 PLN)
        $maxDeductibleY3 = $vintageAfterY2->maxDeductibleInYear(3, TaxLossSettlementMode::STANDARD_LOSS_CAP, 50.0);
        $this->assertTrue($maxDeductibleY3->equals(new Money('500000.0000', $this->currency)));

        // Settle 500,000 PLN in year 3
        $vintageAfterY3 = $vintageAfterY2->settle(new Money('500000.0000', $this->currency));
        $this->assertTrue($vintageAfterY3->remainingAmount()->equals(new Money('100000.0000', $this->currency)));

        // In year 4, remaining is 100,000 PLN, which is less than the 500,000 PLN cap
        $maxDeductibleY4 = $vintageAfterY3->maxDeductibleInYear(4, TaxLossSettlementMode::STANDARD_LOSS_CAP, 50.0);
        $this->assertTrue($maxDeductibleY4->equals(new Money('100000.0000', $this->currency)));
    }

    public function test_one_off_five_million_cap_allows_full_deduction_up_to_five_million(): void
    {
        // art. 7 ust. 5 pkt 2 ustawy o CIT: jednorazowo do 5 mln PLN
        // Case A: Loss <= 5M (e.g. 3,500,000 PLN)
        $vintage = TaxLossVintage::create(1, new Money('3500000.0000', $this->currency));
        $maxDeductible = $vintage->maxDeductibleInYear(2, TaxLossSettlementMode::ONE_OFF_5M);
        $this->assertTrue($maxDeductible->equals(new Money('3500000.0000', $this->currency)));

        // Case B: Loss > 5M (e.g. 8,000,000 PLN)
        $vintageLarge = TaxLossVintage::create(1, new Money('8000000.0000', $this->currency));
        $maxDeductibleLarge = $vintageLarge->maxDeductibleInYear(2, TaxLossSettlementMode::ONE_OFF_5M);
        $this->assertTrue($maxDeductibleLarge->equals(new Money('5000000.0000', $this->currency)));

        // Once 5M is settled using one-off, remaining 3M is subject to 50% cap of initial loss (4M)
        $vintageAfterOneOff = $vintageLarge->settle(new Money('5000000.0000', $this->currency), usedOneOff: true);
        $this->assertTrue($vintageAfterOneOff->hasUsedOneOffDeduction());
        $this->assertTrue($vintageAfterOneOff->remainingAmount()->equals(new Money('3000000.0000', $this->currency)));

        // In year 3: max is min(3M remaining, 50% * 8M = 4M) = 3M
        $maxDeductibleY3 = $vintageAfterOneOff->maxDeductibleInYear(3, TaxLossSettlementMode::ONE_OFF_5M);
        $this->assertTrue($maxDeductibleY3->equals(new Money('3000000.0000', $this->currency)));
    }

    public function test_fifo_settlement_across_multiple_vintages_in_tax_loss_pool(): void
    {
        $pool = TaxLossPool::empty($this->currency)
            ->addLoss(1, new Money('400000.0000', $this->currency))  // Vintage Y1: max 50% = 200k/yr
            ->addLoss(2, new Money('600000.0000', $this->currency)); // Vintage Y2: max 50% = 300k/yr

        $this->assertTrue($pool->openingBalance(3)->equals(new Money('1000000.0000', $this->currency)));

        // In Year 3, company generates 500,000 PLN taxable income
        $outcome = $pool->settle(
            currentYear: 3,
            taxableIncome: new Money('500000.0000', $this->currency),
            mode: TaxLossSettlementMode::STANDARD_LOSS_CAP
        );

        $result = $outcome['result'];
        $updatedPool = $outcome['pool'];

        // FIFO: First Year 1 is capped at 200k, then Year 2 is capped at 300k -> total deducted = 500k
        $this->assertTrue($result->lossDeducted()->equals(new Money('500000.0000', $this->currency)));
        $this->assertTrue($result->taxableIncomeAfterDeduction()->isZero());
        $this->assertTrue($result->lossExpired()->isZero());

        $details = $result->settlementDetails();
        $this->assertCount(2, $details);
        $this->assertSame(1, $details[0]['vintage_year']);
        $this->assertTrue($details[0]['deducted']->equals(new Money('200000.0000', $this->currency)));
        $this->assertSame(2, $details[1]['vintage_year']);
        $this->assertTrue($details[1]['deducted']->equals(new Money('300000.0000', $this->currency)));

        // Remaining in pool: Y1 has 200k, Y2 has 300k -> total closing = 500k
        $this->assertTrue($updatedPool->closingBalance(3)->equals(new Money('500000.0000', $this->currency)));
    }

    public function test_five_year_statutory_expiration_purges_unutilized_loss_at_year_seven(): void
    {
        // Loss incurred in Year 1 expires after Year 6 (1 + 5 = 6). In Year 7 it expires.
        $pool = TaxLossPool::empty($this->currency)
            ->addLoss(1, new Money('1000000.0000', $this->currency));

        // Year 2: Deduct 300,000 PLN
        $y2 = $pool->settle(2, new Money('300000.0000', $this->currency));
        $pool = $y2['pool'];
        $this->assertTrue($pool->closingBalance(2)->equals(new Money('700000.0000', $this->currency)));

        // Years 3, 4, 5, 6: No profit (0 PLN)
        for ($y = 3; $y <= 6; $y++) {
            $yOutcome = $pool->settle($y, Money::zero($this->currency));
            $pool = $yOutcome['pool'];
            $this->assertTrue($yOutcome['result']->lossExpired()->isZero(), "No expiry should occur in year {$y}");
            $this->assertTrue($pool->closingBalance($y)->equals(new Money('700000.0000', $this->currency)));
        }

        // In Year 7 (currentYear = 7 > expiryYear 6):
        // The remaining 700,000 PLN must expire permanently!
        $y7 = $pool->settle(7, new Money('500000.0000', $this->currency));
        $resultY7 = $y7['result'];
        $poolY7 = $y7['pool'];

        // Expired amount is 700,000 PLN
        $this->assertTrue($resultY7->lossExpired()->equals(new Money('700000.0000', $this->currency)));

        // Expired vintage cannot offset Year 7 profit!
        $this->assertTrue($resultY7->lossDeducted()->isZero());
        $this->assertTrue($resultY7->taxableIncomeAfterDeduction()->equals(new Money('500000.0000', $this->currency)));

        // Closing pool balance is now 0 PLN
        $this->assertTrue($poolY7->closingBalance(7)->isZero());

        // Check expired details
        $expiredDetails = $resultY7->expiredDetails();
        $this->assertCount(1, $expiredDetails);
        $this->assertSame(1, $expiredDetails[0]['vintage_year']);
        $this->assertTrue($expiredDetails[0]['expired_amount']->equals(new Money('700000.0000', $this->currency)));
    }

    public function test_ebt_cap_legacy_mode_limits_deduction_to_fifty_percent_of_ebt(): void
    {
        $pool = TaxLossPool::empty($this->currency)
            ->addLoss(1, new Money('1000000.0000', $this->currency));

        // In Year 2, taxable profit is 400,000 PLN
        // Under EBT_CAP, max deduction is 50% of EBT = 200,000 PLN
        $outcome = $pool->settle(
            currentYear: 2,
            taxableIncome: new Money('400000.0000', $this->currency),
            mode: TaxLossSettlementMode::EBT_CAP,
            annualCapPercent: 50.0
        );

        $result = $outcome['result'];
        $this->assertTrue($result->lossDeducted()->equals(new Money('200000.0000', $this->currency)));
        $this->assertTrue($result->taxableIncomeAfterDeduction()->equals(new Money('200000.0000', $this->currency)));
        $this->assertTrue($outcome['pool']->closingBalance(2)->equals(new Money('800000.0000', $this->currency)));
    }

    public function test_pool_serialization_and_equality(): void
    {
        $pool1 = TaxLossPool::empty($this->currency)
            ->addLoss(1, new Money('500000.0000', $this->currency))
            ->addLoss(2, new Money('300000.0000', $this->currency));

        $pool2 = TaxLossPool::empty($this->currency)
            ->addLoss(1, new Money('500000.0000', $this->currency))
            ->addLoss(2, new Money('300000.0000', $this->currency));

        $this->assertTrue($pool1->equals($pool2));

        $array = $pool1->toArray();
        $this->assertSame('PLN', $array['currency']);
        $this->assertSame('800000.0000', $array['total_loss_incurred']);
        $this->assertSame('0.0000', $array['total_loss_settled']);
        $this->assertCount(2, $array['vintages']);
    }
}
