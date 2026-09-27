<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Application\Queries\GetDocumentById;

use App\Contexts\DocumentManagement\Application\Exceptions\DocumentNotFoundException;
use App\Models\Document as EloquentDocument;

final class GetDocumentByIdHandler
{
    public function handle(GetDocumentByIdQuery $query): EloquentDocument
    {
        $builder = EloquentDocument::query()->with(['uploader', 'folder']);

        if ($query->withTrash) {
            $builder->withTrashed();
        }

        /** @var EloquentDocument|null $document */
        $document = $builder->find($query->id);

        if ($document === null) {
            throw DocumentNotFoundException::withId($query->id);
        }

        return $document;
    }
}
