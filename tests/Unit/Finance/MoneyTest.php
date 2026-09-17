<?php

declare(strict_types=1);

namespace Tests\Unit\Finance;

use App\Contexts\Finance\Domain\Exceptions\CurrencyMismatchException;
use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

final class MoneyTest extends TestCase
{
    public function test_money_can_be_created_from_decimal_and_cents(): void
    {
        $m1 = Money::fromDecimal('1250.5000', Currency::PLN);
        $this->assertSame('1250.5000', $m1->amount());
        $this->assertSame(1250.5, $m1->toDecimal());
        $this->assertSame(125050, $m1->toCents());
        $this->assertSame(Currency::PLN, $m1->currency());

        $m2 = Money::fromCents(125050, Currency::PLN);
        $this->assertTrue($m1->equals($m2));
    }

    public function test_addition_and_subtraction_using_bcmath(): void
    {
        $a = Money::fromDecimal('100.2550', Currency::PLN);
        $b = Money::fromDecimal('50.7450', Currency::PLN);

        $sum = $a->add($b);
        $this->assertSame('151.0000', $sum->amount());

        $diff = $a->subtract($b);
        $this->assertSame('49.5100', $diff->amount());
    }

    public function test_multiplication_and_division_precision(): void
    {
        $m = Money::fromDecimal('100.0000', Currency::PLN);

        $multiplied = $m->multiply('1.23'); // e.g. 23% VAT
        $this->assertSame('123.0000', $multiplied->amount());

        $divided = $m->divide('3', 4);
        $this->assertSame('33.3333', $divided->amount());
    }

    public function test_division_by_zero_throws_exception(): void
    {
        $m = Money::fromDecimal('100.0000', Currency::PLN);

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Division by zero');

        $m->divide('0');
    }

    public function test_currency_mismatch_throws_exception(): void
    {
        $pln = Money::fromDecimal('100.0000', Currency::PLN);
        $eur = Money::fromDecimal('100.0000', Currency::EUR);

        $this->expectException(CurrencyMismatchException::class);
        $this->expectExceptionMessage('Currency mismatch');

        $pln->add($eur);
    }

    public function test_comparisons_and_predicates(): void
    {
        $zero = Money::zero(Currency::PLN);
        $pos = Money::fromDecimal('10.0000', Currency::PLN);
        $neg = Money::fromDecimal('-5.0000', Currency::PLN);

        $this->assertTrue($zero->isZero());
        $this->assertFalse($zero->isPositive());
        $this->assertFalse($zero->isNegative());

        $this->assertTrue($pos->isPositive());
        $this->assertTrue($pos->greaterThan($zero));
        $this->assertTrue($pos->greaterThan($neg));

        $this->assertTrue($neg->isNegative());
        $this->assertTrue($neg->lessThan($zero));
        $this->assertTrue($neg->lessThan($pos));
    }

    public function test_format_output(): void
    {
        $m = Money::fromDecimal('1234567.8900', Currency::PLN);
        $this->assertSame('1 234 567,89 PLN', $m->format(2, ',', ' '));
    }
}
