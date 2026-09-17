<?php

declare(strict_types=1);

namespace Tests\Unit\Finance;

use App\Contexts\Finance\Domain\Entities\Category;
use App\Contexts\Finance\Domain\ValueObjects\CategoryType;
use App\Contexts\Finance\Domain\ValueObjects\RecordType;
use PHPUnit\Framework\TestCase;

final class CategoryTest extends TestCase
{
    public function test_standard_categories_mapping_and_types(): void
    {
        $rev = Category::revenue();
        $this->assertSame(CategoryType::REVENUE, $rev->type());
        $this->assertSame(RecordType::REVENUE, $rev->recordType());

        $cogs = Category::cogs();
        $this->assertSame(CategoryType::COGS, $cogs->type());
        $this->assertSame(RecordType::EXPENSE, $cogs->recordType());

        $dep = Category::depreciation();
        $this->assertSame(CategoryType::DEPRECIATION, $dep->type());
        $this->assertSame(RecordType::EXPENSE, $dep->recordType());

        $cash = Category::cash();
        $this->assertSame(CategoryType::CASH, $cash->type());
        $this->assertSame(RecordType::ASSET, $cash->recordType());
        $this->assertTrue($cash->type()->isCurrentAsset());
        $this->assertTrue($cash->type()->isQuickAsset());

        $cliab = Category::currentLiabilities();
        $this->assertSame(CategoryType::CURRENT_LIABILITIES, $cliab->type());
        $this->assertSame(RecordType::LIABILITY, $cliab->recordType());
        $this->assertTrue($cliab->type()->isCurrentLiability());
    }

    public function test_category_equality(): void
    {
        $cat1 = Category::revenue();
        $cat2 = Category::revenue();
        $cat3 = Category::cogs();

        $this->assertTrue($cat1->equals($cat2));
        $this->assertFalse($cat1->equals($cat3));
    }
}
