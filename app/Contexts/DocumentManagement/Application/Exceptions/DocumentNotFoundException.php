<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Exceptions;

use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class DocumentNotFoundException extends NotFoundHttpException
{
    public static function withId(string $id): self
    {
        return new self("Dokument [{$id}] nie został odnaleziony w wirtualnym pokoju danych.");
    }
}
