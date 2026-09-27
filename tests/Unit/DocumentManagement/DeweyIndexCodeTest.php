<?php

declare(strict_types=1);

namespace Tests\Unit\DocumentManagement;

use App\Contexts\DocumentManagement\Domain\ValueObjects\DeweyIndexCode;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

final class DeweyIndexCodeTest extends TestCase
{
    public function test_valid_dewey_index_codes_are_accepted_and_normalized(): void
    {
        $code1 = DeweyIndexCode::fromString('01.00');
        $this->assertSame('01.00', $code1->value());
        $this->assertTrue($code1->isRoot());
        $this->assertSame(1, $code1->level());

        // Single digit gets padded
        $code2 = DeweyIndexCode::fromString('1.0');
        $this->assertSame('01.00', $code2->value());

        // Subfolder level 2
        $code3 = DeweyIndexCode::fromString('02.01');
        $this->assertSame('02.01', $code3->value());
        $this->assertFalse($code3->isRoot());
        $this->assertSame(2, $code3->level());

        // Sub-subfolder level 3
        $code4 = DeweyIndexCode::fromString('02.01.03');
        $this->assertSame('02.01.03', $code4->value());
        $this->assertSame(3, $code4->level());
    }

    public function test_invalid_dewey_index_codes_throw_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);
        DeweyIndexCode::fromString('INVALID_CODE');
    }

    public function test_parent_code_calculation(): void
    {
        $root = DeweyIndexCode::fromString('02.00');
        $this->assertNull($root->parentCode());

        $level2 = DeweyIndexCode::fromString('02.01');
        $this->assertSame('02.00', $level2->parentCode()?->value());

        $level3 = DeweyIndexCode::fromString('02.01.03');
        $this->assertSame('02.01', $level3->parentCode()?->value());
    }

    public function test_child_code_generation(): void
    {
        $root = DeweyIndexCode::fromString('01.00');
        $child1 = $root->child(1);
        $this->assertSame('01.01', $child1->value());

        $child12 = $root->child(12);
        $this->assertSame('01.12', $child12->value());

        $sub = DeweyIndexCode::fromString('02.03');
        $subChild = $sub->child(4);
        $this->assertSame('02.03.04', $subChild->value());
    }

    public function test_ancestor_and_hierarchy_checks(): void
    {
        $root = DeweyIndexCode::fromString('02.00');
        $sub = DeweyIndexCode::fromString('02.01');
        $deep = DeweyIndexCode::fromString('02.01.05');
        $other = DeweyIndexCode::fromString('03.01');

        $this->assertTrue($root->isAncestorOf($sub));
        $this->assertTrue($root->isAncestorOf($deep));
        $this->assertFalse($root->isAncestorOf($other));

        $this->assertTrue($sub->isAncestorOf($deep));
        $this->assertFalse($sub->isAncestorOf($root));
    }

    public function test_compare_and_sorting(): void
    {
        $codes = [
            DeweyIndexCode::fromString('10.00'),
            DeweyIndexCode::fromString('02.01'),
            DeweyIndexCode::fromString('01.00'),
            DeweyIndexCode::fromString('02.01.02'),
            DeweyIndexCode::fromString('02.00'),
            DeweyIndexCode::fromString('02.01.01'),
            DeweyIndexCode::fromString('01.01'),
        ];

        usort($codes, fn (DeweyIndexCode $a, DeweyIndexCode $b) => $a->compare($b));

        $sortedStrings = array_map(fn ($c) => $c->value(), $codes);

        $expected = [
            '01.00',
            '01.01',
            '02.00',
            '02.01',
            '02.01.01',
            '02.01.02',
            '10.00',
        ];

        $this->assertSame($expected, $sortedStrings);
    }
}
