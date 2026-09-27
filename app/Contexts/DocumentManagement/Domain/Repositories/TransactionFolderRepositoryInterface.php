<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Domain\Repositories;

use App\Contexts\DocumentManagement\Domain\Model\TransactionFolder;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DeweyIndexCode;
use App\Contexts\DocumentManagement\Domain\ValueObjects\FolderId;

interface TransactionFolderRepositoryInterface
{
    public function findById(FolderId $id): ?TransactionFolder;

    /**
     * @return array<TransactionFolder>
     */
    public function findByCompanyId(string $companyId): array;

    public function findByIndexCode(string $companyId, DeweyIndexCode $code): ?TransactionFolder;

    public function save(TransactionFolder $folder): void;

    public function delete(FolderId $id): void;
}
