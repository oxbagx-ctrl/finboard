<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\ValueObjects;

enum RecordType: string
{
    case REVENUE = 'revenue';
    case EXPENSE = 'expense';
    case ASSET = 'asset';
    case LIABILITY = 'liability';

    public function label(): string
    {
        return match ($this) {
            self::REVENUE => 'Przychód',
            self::EXPENSE => 'Koszt',
            self::ASSET => 'Aktywa',
            self::LIABILITY => 'Pasywa / Zobowiązania',
        };
    }
}
