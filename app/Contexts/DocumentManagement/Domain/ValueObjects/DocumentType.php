<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Domain\ValueObjects;

enum DocumentType: string
{
    case FINANCIAL_REPORT = 'financial_report';
    case CONTRACT = 'contract';
    case TAX_DECLARATION = 'tax_declaration';
    case AUDIT_REPORT = 'audit_report';
    case PRESENTATION = 'presentation';
    case OTHER = 'other';

    public function label(): string
    {
        return match ($this) {
            self::FINANCIAL_REPORT => 'Raport Finansowy',
            self::CONTRACT => 'Umowa / Aneks',
            self::TAX_DECLARATION => 'Deklaracja Podatkowa',
            self::AUDIT_REPORT => 'Raport z Audytu',
            self::PRESENTATION => 'Prezentacja Inwestorska',
            self::OTHER => 'Inny Dokument',
        };
    }
}
