<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

enum TerminalValueMethod: string
{
    /**
     * Model Gordona-Shapiro (stały wzrost przepływów pieniężnych po horyzoncie w nieskończoność).
     * TV = FCFF_n * (1 + g) / (WACC - g)
     */
    case GORDON_GROWTH = 'gordon_growth';

    /**
     * Metoda mnożnikowa (mnożnik wyjścia EV/EBITDA w ostatnim roku prognozy).
     * TV = EBITDA_n * ExitMultiple
     */
    case EXIT_MULTIPLE = 'exit_multiple';

    /**
     * Wartość księgowa / likwidacyjna aktywów netto (Book Value).
     * TV = NetBookValue_n + NWC_n
     */
    case BOOK_VALUE = 'book_value';

    public function isGordonGrowth(): bool
    {
        return $this === self::GORDON_GROWTH;
    }

    public function isExitMultiple(): bool
    {
        return $this === self::EXIT_MULTIPLE;
    }

    public function isBookValue(): bool
    {
        return $this === self::BOOK_VALUE;
    }

    public function label(): string
    {
        return match ($this) {
            self::GORDON_GROWTH => 'Model Gordona-Shapiro (stały wzrost perpetuum)',
            self::EXIT_MULTIPLE => 'Mnożnik wyjścia EV/EBITDA',
            self::BOOK_VALUE => 'Wartość księgowa / likwidacyjna aktywów netto',
        };
    }
}
