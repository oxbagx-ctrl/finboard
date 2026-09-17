<?php

declare(strict_types=1);

namespace Tests\Unit\Finance;

use App\Contexts\Finance\Application\Services\CsvFinancialDataParser;
use App\Contexts\Finance\Domain\Repositories\CategoryRepositoryInterface;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

final class CsvFinancialDataParserTest extends TestCase
{
    use DatabaseTransactions;

    private CsvFinancialDataParser $parser;

    protected function setUp(): void
    {
        parent::setUp();
        $this->parser = new CsvFinancialDataParser($this->app->make(CategoryRepositoryInterface::class));
    }

    public function test_parses_valid_csv_with_comma_delimiter(): void
    {
        $csv = <<<CSV
category,amount,date,description,currency
REV,125000.00,2026-04-15,Przychody ze sprzedaży oprogramowania,PLN
COGS,45000.50,2026-04-20,Wynagrodzenia podwykonawców B2B,PLN
OPEX,15200.00,2026-04-25,Koszty marketingu Google Ads,PLN
CSV;

        $result = $this->parser->parse($csv);

        $this->assertTrue($result->isValid());
        $this->assertSame(3, $result->totalRows);
        $this->assertSame(3, $result->successCount());
        $this->assertSame(0, $result->errorCount());

        $records = $result->validRecords;
        $this->assertSame('cat-revenue', $records[0]['category_id']);
        $this->assertSame('125000.0000', $records[0]['amount']);
        $this->assertSame('2026-04-15', $records[0]['record_date']);
        $this->assertSame('PLN', $records[0]['currency']);
        $this->assertSame('csv_import', $records[0]['source']);

        $this->assertSame('cat-cogs', $records[1]['category_id']);
        $this->assertSame('45000.5000', $records[1]['amount']);
    }

    public function test_parses_valid_csv_with_semicolon_and_polish_formats(): void
    {
        $csv = <<<CSV
Kategoria;Kwota;Data;Opis;Waluta
cat-cash;250 000,00;30.04.2026;Środki na koncie mBank;PLN
INV;45 200,55;30.04.2026;Wartość magazynu końcowa;PLN
CSV;

        $result = $this->parser->parse($csv);

        $this->assertTrue($result->isValid());
        $this->assertSame(2, $result->totalRows);
        $this->assertSame(2, $result->successCount());

        $this->assertSame('cat-cash', $result->validRecords[0]['category_id']);
        $this->assertSame('250000.0000', $result->validRecords[0]['amount']);
        $this->assertSame('2026-04-30', $result->validRecords[0]['record_date']);

        $this->assertSame('cat-inventory', $result->validRecords[1]['category_id']);
        $this->assertSame('45200.5500', $result->validRecords[1]['amount']);
    }

    public function test_empty_csv_returns_error(): void
    {
        $result = $this->parser->parse('');

        $this->assertFalse($result->isValid());
        $this->assertSame(0, $result->totalRows);
        $this->assertNotEmpty($result->errors);
        $this->assertStringContainsString('pusty', $result->errors[0]['message']);
    }

    public function test_missing_required_headers_returns_error(): void
    {
        $csv = <<<CSV
Kategoria,Kwota
REV,1000
CSV;

        $result = $this->parser->parse($csv);

        $this->assertFalse($result->isValid());
        $this->assertStringContainsString('Brak wymaganych kolumn', $result->errors[0]['message']);
    }

    public function test_captures_validation_errors_with_exact_line_numbers(): void
    {
        $csv = <<<CSV
category,amount,date,description
UNKNOWN_CODE,1000.00,2026-01-01,Wpis z bledna kategoria
REV,-500.00,2026-01-01,Ujemna kwota
REV,1500.00,invalid-date,Niepoprawna data
REV,2000.00,2026-01-01,
CSV;

        $result = $this->parser->parse($csv);

        $this->assertFalse($result->isValid());
        $this->assertSame(4, $result->totalRows);
        $this->assertSame(0, $result->successCount());
        $this->assertSame(4, $result->errorCount());

        // Line 2: Unknown category
        $this->assertSame(2, $result->errors[0]['line']);
        $this->assertSame('category', $result->errors[0]['column']);
        $this->assertStringContainsString('Nieznany kod', $result->errors[0]['message']);

        // Line 3: Negative amount
        $this->assertSame(3, $result->errors[1]['line']);
        $this->assertSame('amount', $result->errors[1]['column']);
        $this->assertStringContainsString('Niepoprawny format kwoty lub wartość ujemna', $result->errors[1]['message']);

        // Line 4: Invalid date
        $this->assertSame(4, $result->errors[2]['line']);
        $this->assertSame('date', $result->errors[2]['column']);
        $this->assertStringContainsString('Niepoprawny format daty', $result->errors[2]['message']);

        // Line 5: Empty description
        $this->assertSame(5, $result->errors[3]['line']);
        $this->assertSame('description', $result->errors[3]['column']);
        $this->assertStringContainsString('Opis transakcji nie może być pusty', $result->errors[3]['message']);
    }
}
