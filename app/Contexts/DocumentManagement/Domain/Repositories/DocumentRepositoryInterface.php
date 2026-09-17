<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Domain\Repositories;

use App\Contexts\DocumentManagement\Domain\Model\Document;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DocumentId;

interface DocumentRepositoryInterface
{
    public function findById(DocumentId $id): ?Document;

    /**
     * @return array<Document>
     */
    public function findByCompanyId(string $companyId, bool $includeArchived = false): array;

    public function save(Document $document): void;

    public function delete(DocumentId $id): void;

    public function logAccess(
        DocumentId $documentId,
        string $userId,
        string $action,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): void;
}
