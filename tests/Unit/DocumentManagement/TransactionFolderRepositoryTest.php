<?php

declare(strict_types=1);

namespace Tests\Unit\DocumentManagement;

use App\Contexts\DocumentManagement\Domain\Model\TransactionFolder;
use App\Contexts\DocumentManagement\Domain\Repositories\TransactionFolderRepositoryInterface;
use App\Contexts\DocumentManagement\Domain\Services\DeweyMnaStructureGenerator;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DeweyIndexCode;
use App\Contexts\DocumentManagement\Domain\ValueObjects\FolderId;
use App\Models\Company;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

final class TransactionFolderRepositoryTest extends TestCase
{
    use DatabaseTransactions;

    private Company $company;
    private TransactionFolderRepositoryInterface $repository;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'M&A Deal Target Sp. z o.o.',
            'code' => 'TARGET_' . uniqid(),
            'tax_id' => 'PL' . mt_rand(1000000000, 9999999999),
        ]);

        $this->repository = app(TransactionFolderRepositoryInterface::class);
    }

    public function test_save_and_retrieve_transaction_folder_by_id(): void
    {
        $id = FolderId::generate();
        $folder = TransactionFolder::create(
            id: $id,
            companyId: $this->company->id,
            indexCode: DeweyIndexCode::fromString('01.00'),
            name: 'Korporacyjne',
            parentId: null,
            description: 'Opis folderu korporacyjnego',
            sortOrder: 10
        );

        $this->repository->save($folder);

        $retrieved = $this->repository->findById($id);

        $this->assertSame($id->value(), $retrieved->id());
        $this->assertSame($id->value(), $retrieved->folderId()->value());
        $this->assertSame('01.00', $retrieved->indexCode()->value());
        $this->assertSame('Korporacyjne', $retrieved->name());
        $this->assertSame('Opis folderu korporacyjnego', $retrieved->description());
        $this->assertSame(10, $retrieved->sortOrder());
    }

    public function test_find_by_index_code(): void
    {
        $folder = TransactionFolder::create(
            id: FolderId::generate(),
            companyId: $this->company->id,
            indexCode: DeweyIndexCode::fromString('02.00'),
            name: 'Finanse'
        );
        $this->repository->save($folder);

        $found = $this->repository->findByIndexCode($this->company->id, DeweyIndexCode::fromString('02.00'));
        $this->assertNotNull($found);
        $this->assertSame($folder->id(), $found->id());

        $notFound = $this->repository->findByIndexCode($this->company->id, DeweyIndexCode::fromString('99.99'));
        $this->assertNull($notFound);
    }

    public function test_find_by_company_id_returns_folders_sorted_by_dewey_index(): void
    {
        // Insert out of order
        $f3 = TransactionFolder::create(FolderId::generate(), $this->company->id, DeweyIndexCode::fromString('02.01'), 'Bilans');
        $f1 = TransactionFolder::create(FolderId::generate(), $this->company->id, DeweyIndexCode::fromString('01.00'), 'Korporacyjne');
        $f4 = TransactionFolder::create(FolderId::generate(), $this->company->id, DeweyIndexCode::fromString('02.01.01'), 'Kompensaty');
        $f2 = TransactionFolder::create(FolderId::generate(), $this->company->id, DeweyIndexCode::fromString('02.00'), 'Finanse');

        $this->repository->save($f3);
        $this->repository->save($f1);
        $this->repository->save($f4);
        $this->repository->save($f2);

        $folders = $this->repository->findByCompanyId($this->company->id);

        $this->assertCount(4, $folders);
        $this->assertSame('01.00', $folders[0]->indexCode()->value());
        $this->assertSame('02.00', $folders[1]->indexCode()->value());
        $this->assertSame('02.01', $folders[2]->indexCode()->value());
        $this->assertSame('02.01.01', $folders[3]->indexCode()->value());
    }

    public function test_delete_folder(): void
    {
        $id = FolderId::generate();
        $folder = TransactionFolder::create(
            id: $id,
            companyId: $this->company->id,
            indexCode: DeweyIndexCode::fromString('05.00'),
            name: 'HR'
        );
        $this->repository->save($folder);

        $this->assertNotNull($this->repository->findById($id));

        $this->repository->delete($id);

        $this->assertNull($this->repository->findById($id));
    }

    public function test_standard_mna_structure_generator(): void
    {
        $generator = new DeweyMnaStructureGenerator();
        $standardFolders = $generator->generateStandardFolders($this->company->id);

        // Standard taxonomy has 8 root categories + multiple subcategories
        $this->assertGreaterThan(25, count($standardFolders));

        foreach ($standardFolders as $folder) {
            $this->repository->save($folder);
        }

        $persisted = $this->repository->findByCompanyId($this->company->id);
        $this->assertSame(count($standardFolders), count($persisted));

        // Verify root categories
        $rootFolders = array_filter($persisted, fn (TransactionFolder $f) => $f->indexCode()->isRoot());
        $this->assertCount(8, $rootFolders);

        $rootCodes = array_map(fn (TransactionFolder $f) => $f->indexCode()->value(), array_values($rootFolders));
        $this->assertSame(['01.00', '02.00', '03.00', '04.00', '05.00', '06.00', '07.00', '08.00'], $rootCodes);
    }
}
