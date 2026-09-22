<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\Services;

use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Domain\Entities\DebtFacility;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AmortizationPeriod;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AmortizationSchedule;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AmortizationType;
use App\Contexts\InvestmentProject\Domain\ValueObjects\LoanTenor;
use DateTimeImmutable;

final class DebtAmortizationService
{
    /**
     * Generate complete amortization schedule for a given DebtFacility entity.
     */
    public function generateSchedule(DebtFacility $facility, ?DateTimeImmutable $startDate = null): AmortizationSchedule
    {
        return $this->generateScheduleForParameters(
            principal: $facility->committedAmount(),
            nominalAnnualRate: $facility->nominalAnnualRate(),
            tenor: $facility->tenor(),
            amortizationType: $facility->amortizationType(),
            upfrontFeeRate: $facility->upfrontFeeRate(),
            facilityId: $facility->id(),
            startDate: $startDate ?? $facility->drawdownDate()
        );
    }

    /**
     * Generate schedule for explicit financial parameters.
     */
    public function generateScheduleForParameters(
        Money $principal,
        float $nominalAnnualRate,
        LoanTenor $tenor,
        AmortizationType $amortizationType,
        float $upfrontFeeRate = 0.0,
        string $facilityId = '',
        ?DateTimeImmutable $startDate = null
    ): AmortizationSchedule {
        $currency = $principal->currency();
        $upfrontFee = $principal->multiply($upfrontFeeRate / 100.0);
        $totalMonths = $tenor->tenorMonths();
        $graceMonths = $tenor->gracePeriodMonths();
        $repaymentMonths = $tenor->repaymentMonths();

        if ($principal->isZero() || $totalMonths === 0) {
            return new AmortizationSchedule(
                facilityId: $facilityId,
                principal: $principal,
                upfrontFee: $upfrontFee,
                nominalAnnualRate: $nominalAnnualRate,
                amortizationType: $amortizationType,
                periods: []
            );
        }

        $date = $startDate ?? new DateTimeImmutable();
        $monthlyRate = ($nominalAnnualRate / 100.0) / 12.0;

        $fixedAnnuityPayment = null;
        if ($amortizationType->isAnnuity() && $repaymentMonths > 0) {
            $fixedAnnuityPayment = $this->calculateAnnuityInstallment($principal, $monthlyRate, $repaymentMonths);
        }

        $fixedLinearPrincipal = null;
        if ($amortizationType->isLinear() && $repaymentMonths > 0) {
            $fixedLinearPrincipal = $principal->divide($repaymentMonths);
        }

        $periods = [];
        $balance = $principal;

        for ($m = 1; $m <= $totalMonths; $m++) {
            $paymentDate = $date->modify(sprintf('+%d months', $m));
            $openingBalance = $balance;
            $isGrace = ($m <= $graceMonths);

            // 1. Calculate Interest for the period
            $interest = $monthlyRate > 0.0
                ? $openingBalance->multiply($monthlyRate)
                : Money::zero($currency);

            // 2. Calculate Principal payment
            if ($isGrace) {
                $principalPayment = Money::zero($currency);
            } elseif ($amortizationType->isBullet()) {
                $principalPayment = ($m === $totalMonths) ? $openingBalance : Money::zero($currency);
            } elseif ($amortizationType->isLinear()) {
                if ($m === $totalMonths) {
                    $principalPayment = $openingBalance;
                } else {
                    $principalPayment = $fixedLinearPrincipal->greaterThan($openingBalance)
                        ? $openingBalance
                        : $fixedLinearPrincipal;
                }
            } else {
                // ANNUITY (raty równe)
                if ($m === $totalMonths) {
                    $principalPayment = $openingBalance;
                } else {
                    $rawPrincipal = $fixedAnnuityPayment->subtract($interest);
                    if ($rawPrincipal->isNegative()) {
                        $principalPayment = Money::zero($currency);
                    } elseif ($rawPrincipal->greaterThan($openingBalance)) {
                        $principalPayment = $openingBalance;
                    } else {
                        $principalPayment = $rawPrincipal;
                    }
                }
            }

            // 3. Reconcile total payment and closing balance
            $totalPayment = $principalPayment->add($interest);
            $closingBalance = $openingBalance->subtract($principalPayment);
            if ($closingBalance->isNegative() || $m === $totalMonths) {
                $closingBalance = Money::zero($currency);
            }

            $periods[] = new AmortizationPeriod(
                periodNumber: $m,
                paymentDate: $paymentDate,
                openingBalance: $openingBalance,
                principalPayment: $principalPayment,
                interestPayment: $interest,
                totalPayment: $totalPayment,
                closingBalance: $closingBalance,
                nominalRate: $nominalAnnualRate,
                isGracePeriod: $isGrace
            );

            $balance = $closingBalance;
        }

        return new AmortizationSchedule(
            facilityId: $facilityId,
            principal: $principal,
            upfrontFee: $upfrontFee,
            nominalAnnualRate: $nominalAnnualRate,
            amortizationType: $amortizationType,
            periods: $periods
        );
    }

    /**
     * Calculate exact monthly annuity payment A = P * (r * (1 + r)^m) / ((1 + r)^m - 1)
     */
    public function calculateAnnuityInstallment(Money $principal, float $monthlyRate, int $months): Money
    {
        if ($months <= 0) {
            return Money::zero($principal->currency());
        }

        if ($monthlyRate <= 0.0) {
            return $principal->divide($months);
        }

        $q = 1.0 + $monthlyRate;
        $qm = pow($q, $months);
        $factor = ($monthlyRate * $qm) / ($qm - 1.0);

        return $principal->multiply($factor);
    }
}
