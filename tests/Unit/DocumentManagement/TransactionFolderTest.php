<?php

declare(strict_types=1);

namespace Tests\Unit\DocumentManagement;

use App\Contexts\DocumentManagement\Domain\Events\TransactionFolderCreated;
use App\Contexts\DocumentManagement\Domain\Events\TransactionFolderDeleted;
use App\Contexts\DocumentManagement\Domain\Events\TransactionFolderUpdated;
use App\Contexts\DocumentManagement\Domain\Model\TransactionFolder;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DeweyIndexCode;
use App\Contexts\DocumentManagement\Domain\ValueObjects\FolderId;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

final class TransactionFolderTest extends TestCase
{
    public function test_can_create_transaction_folder_and_emits_event(): void
    {
        $id = FolderId::generate();
        $code = DeweyIndexCode::fromString('01.00');

        $folder = TransactionFolder::create(
            id: $id,
            companyId: 'company-uuid-1',
            indexCode: $code,
            name: 'Informacje Korporacyjne',
            parentId: null,
            description: 'Dokumenty statutowe i rejestrowe',
            sortOrder: 10
        );

        $this->assertSame($id->value(), $folder->id());
        $this->assertSame($id->value(), $folder->folderId()->value());
        $this->assertSame('company-uuid-1', $folder->companyId());
        $this->assertSame('01.00', $folder->indexCode()->value());
        $this->assertSame('Informacje Korporacyjne', $folder->name());
        $this->assertSame('Dokumenty statutowe i rejestrowe', $folder->description());
        $this->assertSame(10, $folder->sortOrder());
        $this->assertNull($folder->parentId());

        $events = $folder->releaseEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(TransactionFolderCreated::class, $events[0]);
    }

    public function test_empty_name_throws_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);

        TransactionFolder::create(
            id: FolderId::generate(),
            companyId: 'company-uuid-1',
            indexCode: DeweyIndexCode::fromString('01.00'),
            name: '   '
        );
    }

    public function test_empty_company_id_throws_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);

        TransactionFolder::create(
            id: FolderId::generate(),
            companyId: '   ',
            indexCode: DeweyIndexCode::fromString('01.00'),
            name: 'Katalog'
        );
    }

    public function test_rename_and_updates_emit_events(): void
    {
        $folder = TransactionFolder::create(
            id: FolderId::generate(),
            companyId: 'company-1',
            indexCode: DeweyIndexCode::fromString('02.00'),
            name: 'Finanse'
        );
        $folder->releaseEvents();

        $folder->rename('Finanse i Podatki');
        $this->assertSame('Finanse i Podatki', $folder->name());

        $newCode = DeweyIndexCode::fromString('02.01');
        $folder->updateIndexCode($newCode);
        $this->assertSame('02.01', $folder->indexCode()->value());

        $newParent = FolderId::generate();
        $folder->moveToParent($newParent);
        $this->assertSame($newParent->value(), $folder->parentId()?->value());

        $events = $folder->releaseEvents();
        $this->assertCount(3, $events);
        $this->assertTrue(collect($events)->every(fn ($e) => $e instanceof TransactionFolderUpdated));
    }

    public function test_cannot_set_folder_as_its_own_parent(): void
    {
        $id = FolderId::generate();
        $folder = TransactionFolder::create(
            id: $id,
            companyId: 'company-1',
            indexCode: DeweyIndexCode::fromString('03.00'),
            name: 'Umowy'
        );

        $this->expectException(InvalidArgumentException::class);
        $folder->moveToParent($id);
    }

    public function test_mark_deleted_emits_deleted_event(): void
    {
        $folder = TransactionFolder::create(
            id: FolderId::generate(),
            companyId: 'company-1',
            indexCode: DeweyIndexCode::fromString('04.00'),
            name: 'Nieruchomości'
        );
        $folder->releaseEvents();

        $folder->markDeleted();
        $events = $folder->releaseEvents();

        $this->assertCount(1, $events);
        $this->assertInstanceOf(TransactionFolderDeleted::class, $events[0]);
    }
}
