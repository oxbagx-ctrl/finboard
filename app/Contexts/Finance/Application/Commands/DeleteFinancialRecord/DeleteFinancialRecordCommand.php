<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Commands\DeleteFinancialRecord;

final readonly class DeleteFinancialRecordCommand
{
    public function __construct(
        public string $recordId
    ) {
    }
}
