<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\Services;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Domain\Model\InvestmentProject;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AnnualLiquiditySummary;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CashFlowStatement;
use App\Contexts\InvestmentProject\Domain\ValueObjects\LiquidityAlert;
use App\Contexts\InvestmentProject\Domain\ValueObjects\LiquidityPeriod;
use App\Contexts\InvestmentProject\Domain\ValueObjects\LiquiditySchedule;
use DateTimeImmutable;
use InvalidArgumentException;

final class LiquidityBalancingService
{
    public function __construct()
    {
    }

    /**
     * Balances cash liquidity over the multi-year horizon, simulating an operational credit facility.
     */
    public function balanceLiquidity(
        InvestmentProject $project,
        CashFlowStatement $cashFlowStatement,
        Money $revolvingCreditLimit,
        Money $minimumCashBuffer,
        float $annualInterestRate = 7.50
    ): LiquiditySchedule {
        return $this->balanceFromCashFlow(
            cashFlowStatement: $cashFlowStatement,
            revolvingCreditLimit: $revolvingCreditLimit,
            minimumCashBuffer: $minimumCashBuffer,
            annualInterestRate: $annualInterestRate,
            startDate: $project->startDate()
        );
    }

    /**
     * Balances cash liquidity directly from a CashFlowStatement and parameters.
     */
    public function balanceFromCashFlow(
        CashFlowStatement $cashFlowStatement,
        Money $revolvingCreditLimit,
        Money $minimumCashBuffer,
        float $annualInterestRate = 7.50,
        ?DateTimeImmutable $startDate = null
    ): LiquiditySchedule {
        $currency = $cashFlowStatement->currency();

        if ($revolvingCreditLimit->currency() !== $currency) {
            throw new InvalidArgumentException(
                sprintf(
                    'Revolving credit limit currency %s does not match statement currency %s.',
                    $revolvingCreditLimit->currency()->value,
                    $currency->value
                )
            );
        }

        if ($minimumCashBuffer->currency() !== $currency) {
            throw new InvalidArgumentException(
                sprintf(
                    'Minimum cash buffer currency %s does not match statement currency %s.',
                    $minimumCashBuffer->currency()->value,
                    $currency->value
                )
            );
        }

        if ($revolvingCreditLimit->isNegative()) {
            throw new InvalidArgumentException('Revolving credit limit cannot be negative.');
        }

        if ($minimumCashBuffer->isNegative()) {
            throw new InvalidArgumentException('Minimum cash buffer cannot be negative.');
        }

        if ($annualInterestRate < 0.0 || $annualInterestRate > 50.0) {
            throw new InvalidArgumentException(
                sprintf('Annual interest rate must be between 0.0%% and 50.0%%, %.2f%% given.', $annualInterestRate)
            );
        }

        $monthlyRate = ($annualInterestRate / 100.0) / 12.0;
        $monthlyPeriods = [];
        $alerts = [];

        $revolvingBalance = Money::zero($currency);
        $totalMonths = $cashFlowStatement->monthlyPeriodCount();
        $horizonYears = $cashFlowStatement->horizonYears();

        for ($m = 1; $m <= $totalMonths; $m++) {
            $cfPeriod = $cashFlowStatement->monthlyPeriod($m);
            if ($cfPeriod === null) {
                continue;
            }

            $year = $cfPeriod->year();
            $monthInYear = $cfPeriod->monthInYear();
            $periodDate = $cfPeriod->date();
            $cashBefore = $cfPeriod->closingCashBalance();

            $openingRevolving = $revolvingBalance;

            // 1. Deficit and Excess calculation against minimum cash buffer
            if ($cashBefore->lessThan($minimumCashBuffer)) {
                $deficit = $minimumCashBuffer->subtract($cashBefore);
                $excess = Money::zero($currency);
            } else {
                $deficit = Money::zero($currency);
                $excess = $cashBefore->subtract($minimumCashBuffer);
            }

            // 2. Revolving Drawdown or Repayment logic
            $drawdown = Money::zero($currency);
            $repayment = Money::zero($currency);
            $unfundedDeficit = Money::zero($currency);

            if ($deficit->isPositive()) {
                // Determine available capacity under credit limit
                $availableLimit = $revolvingCreditLimit->greaterThan($openingRevolving)
                    ? $revolvingCreditLimit->subtract($openingRevolving)
                    : Money::zero($currency);

                if ($availableLimit->greaterThanOrEqual($deficit)) {
                    $drawdown = $deficit;
                } else {
                    $drawdown = $availableLimit;
                    $unfundedDeficit = $deficit->subtract($availableLimit);
                }

                // Alert Generation
                if ($unfundedDeficit->isPositive()) {
                    $alerts[] = new LiquidityAlert(
                        periodNumber: $m,
                        year: $year,
                        date: $periodDate,
                        severity: LiquidityAlert::SEVERITY_CRITICAL,
                        code: 'UNFUNDED_CASH_DEFICIT',
                        message: sprintf(
                            'Luka gotówkowa w miesiącu %d (rok %d) wynosi %s i przekracza dostępny limit kredytowy o %s %s. Ryzyko utraty płynności!',
                            $m,
                            $year,
                            $deficit->amount(),
                            $unfundedDeficit->amount(),
                            $currency->value
                        ),
                        deficitAmount: $deficit,
                        facilityLimit: $revolvingCreditLimit,
                        facilityBalance: $revolvingCreditLimit
                    );
                } else {
                    $closingTemp = $openingRevolving->add($drawdown);
                    $limitAmount = (float) $revolvingCreditLimit->amount();
                    $utilizationPercent = $limitAmount > 0 ? ((float) $closingTemp->amount() / $limitAmount) * 100.0 : 0.0;

                    if ($utilizationPercent >= 85.0) {
                        $alerts[] = new LiquidityAlert(
                            periodNumber: $m,
                            year: $year,
                            date: $periodDate,
                            severity: LiquidityAlert::SEVERITY_WARNING,
                            code: 'HIGH_FACILITY_UTILIZATION',
                            message: sprintf(
                                'Wykorzystanie linii rewolwingowej w miesiącu %d wynosi %.1f%% (%s / %s %s).',
                                $m,
                                $utilizationPercent,
                                $closingTemp->amount(),
                                $revolvingCreditLimit->amount(),
                                $currency->value
                            ),
                            deficitAmount: $deficit,
                            facilityLimit: $revolvingCreditLimit,
                            facilityBalance: $closingTemp
                        );
                    } elseif ($drawdown->isPositive()) {
                        $alerts[] = new LiquidityAlert(
                            periodNumber: $m,
                            year: $year,
                            date: $periodDate,
                            severity: LiquidityAlert::SEVERITY_INFO,
                            code: 'DEFICIT_TRIGGERED_DRAWDOWN',
                            message: sprintf(
                                'Uruchomiono transzę linii obrotowej w kwocie %s %s na pokrycie luki płynnościowej w miesiącu %d.',
                                $drawdown->amount(),
                                $currency->value,
                                $m
                            ),
                            deficitAmount: $deficit,
                            facilityLimit: $revolvingCreditLimit,
                            facilityBalance: $closingTemp
                        );
                    }
                }
            } elseif ($excess->isPositive() && $openingRevolving->isPositive()) {
                // Excess cash pays down existing revolving credit
                $repayment = $excess->greaterThan($openingRevolving)
                    ? $openingRevolving
                    : $excess;
            }

            // 3. Interest calculation on opening revolving facility
            $interest = $monthlyRate > 0.0 && $openingRevolving->isPositive()
                ? $openingRevolving->multiply($monthlyRate)
                : Money::zero($currency);

            // 4. Closing Revolving Balance and Available Limit
            $closingRevolving = $openingRevolving->add($drawdown)->subtract($repayment);
            $availableCreditLimit = $revolvingCreditLimit->greaterThan($closingRevolving)
                ? $revolvingCreditLimit->subtract($closingRevolving)
                : Money::zero($currency);

            // 5. Balanced Cash Closing
            $balancedCash = $cashBefore->add($drawdown)->subtract($repayment)->subtract($interest);

            $monthlyPeriods[] = new LiquidityPeriod(
                periodNumber: $m,
                year: $year,
                monthInYear: $monthInYear,
                date: $periodDate,
                cashBeforeBalancing: $cashBefore,
                minimumCashBuffer: $minimumCashBuffer,
                cashDeficit: $deficit,
                excessCash: $excess,
                revolvingFacilityOpening: $openingRevolving,
                revolvingDrawdown: $drawdown,
                revolvingRepayment: $repayment,
                revolvingInterest: $interest,
                revolvingFacilityClosing: $closingRevolving,
                availableCreditLimit: $availableCreditLimit,
                unfundedDeficit: $unfundedDeficit,
                balancedCashClosing: $balancedCash
            );

            // Roll forward to next month
            $revolvingBalance = $closingRevolving;
        }

        $annualSummaries = $this->aggregateAnnualSummaries($monthlyPeriods, $horizonYears, $currency);

        return new LiquiditySchedule(
            currency: $currency,
            horizonYears: $horizonYears,
            facilityLimit: $revolvingCreditLimit,
            minimumCashBuffer: $minimumCashBuffer,
            annualInterestRate: $annualInterestRate,
            monthlyPeriods: $monthlyPeriods,
            annualSummaries: $annualSummaries,
            alerts: $alerts
        );
    }

    /**
     * @param array<LiquidityPeriod> $periods
     * @return array<int, AnnualLiquiditySummary>
     */
    private function aggregateAnnualSummaries(array $periods, int $horizonYears, Currency $currency): array
    {
        $annual = [];

        for ($year = 1; $year <= $horizonYears; $year++) {
            $startIdx = ($year - 1) * 12;
            $endIdx = min(count($periods) - 1, ($year * 12) - 1);

            if ($startIdx >= count($periods)) {
                break;
            }

            $minCashBefore = $periods[$startIdx]->cashBeforeBalancing();
            $maxDeficit = Money::zero($currency);
            $drawdowns = Money::zero($currency);
            $repayments = Money::zero($currency);
            $interest = Money::zero($currency);
            $maxUnfunded = Money::zero($currency);
            $deficitMonths = 0;

            for ($idx = $startIdx; $idx <= $endIdx; $idx++) {
                $p = $periods[$idx];

                if ($p->cashBeforeBalancing()->lessThan($minCashBefore)) {
                    $minCashBefore = $p->cashBeforeBalancing();
                }

                if ($p->cashDeficit()->greaterThan($maxDeficit)) {
                    $maxDeficit = $p->cashDeficit();
                }

                if ($p->unfundedDeficit()->greaterThan($maxUnfunded)) {
                    $maxUnfunded = $p->unfundedDeficit();
                }

                if ($p->hasDeficit()) {
                    $deficitMonths++;
                }

                $drawdowns = $drawdowns->add($p->revolvingDrawdown());
                $repayments = $repayments->add($p->revolvingRepayment());
                $interest = $interest->add($p->revolvingInterest());
            }

            $endPeriod = $periods[$endIdx];

            $annual[$year] = new AnnualLiquiditySummary(
                year: $year,
                minCashBalanceBeforeBalancing: $minCashBefore,
                maxCashDeficit: $maxDeficit,
                totalRevolvingDrawdowns: $drawdowns,
                totalRevolvingRepayments: $repayments,
                totalRevolvingInterest: $interest,
                closingRevolvingFacilityBalance: $endPeriod->revolvingFacilityClosing(),
                closingBalancedCash: $endPeriod->balancedCashClosing(),
                maxUnfundedDeficit: $maxUnfunded,
                deficitMonthsCount: $deficitMonths,
                hasUnfundedDeficit: $maxUnfunded->isPositive()
            );
        }

        return $annual;
    }
}
