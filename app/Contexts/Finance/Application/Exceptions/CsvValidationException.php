<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Application\Exceptions;

use RuntimeException;

final class CsvValidationException extends RuntimeException
{
    /**
     * @param array<int, array{line: int, column?: string, message: string}> $errors
     */
    public function __construct(
        string $message,
        private readonly array $errors = []
    ) {
        parent::__construct($message);
    }

    /**
     * @return array<int, array{line: int, column?: string, message: string}>
     */
    public function errors(): array
    {
        return $this->errors;
    }
}
