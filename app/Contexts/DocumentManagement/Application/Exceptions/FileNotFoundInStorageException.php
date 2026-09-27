<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Exceptions;

use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class FileNotFoundInStorageException extends NotFoundHttpException
{
    public static function forPath(string $path): self
    {
        return new self("Plik dokumentu nie istnieje na dysku: {$path}");
    }

    public static function defaultMessage(): self
    {
        return new self('Plik dokumentu nie istnieje na dysku.');
    }
}
