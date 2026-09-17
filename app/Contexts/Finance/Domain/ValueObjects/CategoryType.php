<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\ValueObjects;

enum CategoryType: string
{
    // Rachunek Zysków i Strat (P&L)
    case REVENUE = 'revenue';
    case COGS = 'cogs'; // Koszt wytworzenia / sprzedanych towarów
    case OPEX = 'opex'; // Koszty operacyjne (administracja, marketing, sprzedaż)
    case DEPRECIATION = 'depreciation'; // Amortyzacja (kluczowa dla kalkulacji EBITDA)
    case FINANCIAL = 'financial'; // Odsetki i koszty finansowe
    case TAX = 'tax'; // Podatek dochodowy

    // Bilans – Aktywa (Balance Sheet Assets)
    case CASH = 'cash'; // Środki pieniężne (płynność bieżąca i szybka)
    case RECEIVABLES = 'receivables'; // Należności krótkoterminowe
    case INVENTORY = 'inventory'; // Zapasy (wyłączane ze wskaźnika płynności szybkiej)
    case OTHER_CURRENT_ASSETS = 'other_current_assets';
    case FIXED_ASSETS = 'fixed_assets'; // Aktywa trwałe

    // Bilans – Pasywa (Balance Sheet Liabilities)
    case CURRENT_LIABILITIES = 'current_liabilities'; // Zobowiązania krótkoterminowe
    case LONG_TERM_LIABILITIES = 'long_term_liabilities';
    case EQUITY = 'equity'; // Kapitał własny

    public function recordType(): RecordType
    {
        return match ($this) {
            self::REVENUE => RecordType::REVENUE,
            self::COGS, self::OPEX, self::DEPRECIATION, self::FINANCIAL, self::TAX => RecordType::EXPENSE,
            self::CASH, self::RECEIVABLES, self::INVENTORY, self::OTHER_CURRENT_ASSETS, self::FIXED_ASSETS => RecordType::ASSET,
            self::CURRENT_LIABILITIES, self::LONG_TERM_LIABILITIES, self::EQUITY => RecordType::LIABILITY,
        };
    }

    public function isCurrentAsset(): bool
    {
        return in_array($this, [
            self::CASH,
            self::RECEIVABLES,
            self::INVENTORY,
            self::OTHER_CURRENT_ASSETS,
        ], true);
    }

    public function isQuickAsset(): bool
    {
        // Aktywa wliczane do płynności szybkiej (Current Assets bez zapasów)
        return in_array($this, [
            self::CASH,
            self::RECEIVABLES,
            self::OTHER_CURRENT_ASSETS,
        ], true);
    }

    public function isCurrentLiability(): bool
    {
        return $this === self::CURRENT_LIABILITIES;
    }
}
