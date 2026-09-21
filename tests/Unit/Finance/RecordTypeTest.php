<?php

declare(strict_types=1);

namespace Tests\Unit\Finance;

use App\Contexts\Finance\Domain\ValueObjects\RecordType;
use PHPUnit\Framework\TestCase;
use ValueError;

final class RecordTypeTest extends TestCase
{
    public function test_enum_has_all_canonical_cases_and_values(): void
    {
        $cases = RecordType::cases();
        $this->assertCount(4, $cases);

        $this->assertSame('revenue', RecordType::REVENUE->value);
        $this->assertSame('expense', RecordType::EXPENSE->value);
        $this->assertSame('asset', RecordType::ASSET->value);
        $this->assertSame('liability', RecordType::LIABILITY->value);
    }

    public function test_labels_are_properly_localized_in_polish(): void
    {
        $this->assertSame('Przychód', RecordType::REVENUE->label());
        $this->assertSame('Koszt', RecordType::EXPENSE->label());
        $this->assertSame('Aktywa', RecordType::ASSET->label());
        $this->assertSame('Pasywa / Zobowiązania', RecordType::LIABILITY->label());
    }

    public function test_try_from_resolves_valid_canonical_values(): void
    {
        $this->assertSame(RecordType::REVENUE, RecordType::tryFrom('revenue'));
        $this->assertSame(RecordType::EXPENSE, RecordType::tryFrom('expense'));
        $this->assertSame(RecordType::ASSET, RecordType::tryFrom('asset'));
        $this->assertSame(RecordType::LIABILITY, RecordType::tryFrom('liability'));
    }

    public function test_try_from_returns_null_for_invalid_or_raw_legacy_strings(): void
    {
        $this->assertNull(RecordType::tryFrom('income'));
        $this->assertNull(RecordType::tryFrom('REVENUE'));
        $this->assertNull(RecordType::tryFrom('EXPENSE'));
        $this->assertNull(RecordType::tryFrom('unknown_type'));
        $this->assertNull(RecordType::tryFrom(''));
    }

    public function test_from_throws_value_error_for_invalid_value(): void
    {
        $this->expectException(ValueError::class);
        RecordType::from('invalid_value');
    }

    public function test_normalized_alias_mapping_resolves_to_canonical_record_type(): void
    {
        $normalizeType = function (string $input): ?RecordType {
            $raw = strtolower(trim($input));
            if ($raw === 'income') {
                $raw = RecordType::REVENUE->value;
            }
            return RecordType::tryFrom($raw);
        };

        $this->assertSame(RecordType::REVENUE, $normalizeType('INCOME'));
        $this->assertSame(RecordType::REVENUE, $normalizeType('income'));
        $this->assertSame(RecordType::REVENUE, $normalizeType('REVENUE'));
        $this->assertSame(RecordType::REVENUE, $normalizeType('revenue'));
        $this->assertSame(RecordType::EXPENSE, $normalizeType('EXPENSE'));
        $this->assertSame(RecordType::EXPENSE, $normalizeType('expense'));
        $this->assertSame(RecordType::ASSET, $normalizeType('asset'));
        $this->assertSame(RecordType::LIABILITY, $normalizeType('liability'));
        $this->assertNull($normalizeType('random_junk'));
    }
}
