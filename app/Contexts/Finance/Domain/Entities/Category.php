<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\Entities;

use App\Contexts\Finance\Domain\ValueObjects\CategoryType;
use App\Contexts\Finance\Domain\ValueObjects\RecordType;
use App\Shared\Domain\Entity;

final class Category extends Entity
{
    public function __construct(
        private readonly string $id,
        private readonly string $name,
        private readonly CategoryType $type,
        private readonly string $code,
        private readonly ?string $description = null
    ) {
    }

    public static function revenue(): self
    {
        return new self('cat-revenue', 'Przychody ze sprzedaży', CategoryType::REVENUE, 'REV', 'Główne przychody operacyjne ze sprzedaży towarów i usług');
    }

    public static function cogs(): self
    {
        return new self('cat-cogs', 'Koszty bezpośrednie (COGS)', CategoryType::COGS, 'COGS', 'Koszt własny sprzedaży i wytworzenia towarów');
    }

    public static function opex(): self
    {
        return new self('cat-opex', 'Koszty operacyjne (OPEX)', CategoryType::OPEX, 'OPEX', 'Koszty ogólnego zarządu, sprzedaży i marketingu');
    }

    public static function depreciation(): self
    {
        return new self('cat-depreciation', 'Amortyzacja', CategoryType::DEPRECIATION, 'DEP', 'Odpisy amortyzacyjne środków trwałych i wartości niematerialnych');
    }

    public static function financialCost(): self
    {
        return new self('cat-financial', 'Koszty finansowe', CategoryType::FINANCIAL, 'FIN', 'Odsetki bankowe, prowizje i ujemne różnice kursowe');
    }

    public static function tax(): self
    {
        return new self('cat-tax', 'Podatek dochodowy', CategoryType::TAX, 'TAX', 'Obciążenia podatkowe od zysku');
    }

    public static function cash(): self
    {
        return new self('cat-cash', 'Środki pieniężne', CategoryType::CASH, 'CASH', 'Środki na rachunkach bankowych i w kasie');
    }

    public static function receivables(): self
    {
        return new self('cat-receivables', 'Należności krótkoterminowe', CategoryType::RECEIVABLES, 'REC', 'Należności handlowe z terminem spłaty do 12 miesięcy');
    }

    public static function inventory(): self
    {
        return new self('cat-inventory', 'Zapasy', CategoryType::INVENTORY, 'INV', 'Towary, materiały i produkty w toku');
    }

    public static function fixedAssets(): self
    {
        return new self('cat-fixed-assets', 'Aktywa trwałe', CategoryType::FIXED_ASSETS, 'FIX', 'Rzeczowe aktywa trwałe i wartości niematerialne');
    }

    public static function currentLiabilities(): self
    {
        return new self('cat-cur-liab', 'Zobowiązania krótkoterminowe', CategoryType::CURRENT_LIABILITIES, 'CLIAB', 'Zobowiązania wobec dostawców i banków płatne w ciągu roku');
    }

    public static function longTermLiabilities(): self
    {
        return new self('cat-lt-liab', 'Zobowiązania długoterminowe', CategoryType::LONG_TERM_LIABILITIES, 'LTLIAB', 'Kredyty i pożyczki długoterminowe powyżej 1 roku');
    }

    public function id(): string
    {
        return $this->id;
    }

    public function name(): string
    {
        return $this->name;
    }

    public function type(): CategoryType
    {
        return $this->type;
    }

    public function code(): string
    {
        return $this->code;
    }

    public function description(): ?string
    {
        return $this->description;
    }

    public function recordType(): RecordType
    {
        return $this->type->recordType();
    }
}
