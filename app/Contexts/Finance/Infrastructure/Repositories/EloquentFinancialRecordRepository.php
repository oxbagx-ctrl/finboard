<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Infrastructure\Repositories;

use App\Contexts\Finance\Domain\Entities\Category;
use App\Contexts\Finance\Domain\Model\FinancialRecord;
use App\Contexts\Finance\Domain\Repositories\FinancialRecordRepositoryInterface;
use App\Contexts\Finance\Domain\ValueObjects\CategoryType;
use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\DateRange;
use App\Contexts\Finance\Domain\ValueObjects\FinancialRecordId;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\Finance\Domain\ValueObjects\RecordType;
use App\Models\FinancialRecord as EloquentFinancialRecord;
use DateTimeImmutable;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Support\Facades\DB;

final class EloquentFinancialRecordRepository implements FinancialRecordRepositoryInterface
{
    public function __construct(
        private readonly Dispatcher $dispatcher
    ) {
    }

    public function findById(FinancialRecordId $id): ?FinancialRecord
    {
        /** @var EloquentFinancialRecord|null $eloquent */
        $eloquent = EloquentFinancialRecord::with('category')->find($id->value());

        if ($eloquent === null) {
            return null;
        }

        return $this->toDomain($eloquent);
    }

    /**
     * @param array<CategoryType> $categoryTypes
     * @return array<FinancialRecord>
     */
    public function findByCompanyId(
        string $companyId,
        ?DateRange $period = null,
        ?RecordType $recordType = null,
        array $categoryTypes = []
    ): array {
        $query = EloquentFinancialRecord::with('category')
            ->where('company_id', $companyId)
            ->orderBy('record_date', 'asc');

        if ($period !== null) {
            $query->whereBetween('record_date', [
                $period->startDate()->format('Y-m-d'),
                $period->endDate()->format('Y-m-d'),
            ]);
        }

        if ($recordType !== null) {
            $val = strtolower($recordType->value);
            $query->whereIn('record_type', [$val, strtoupper($val)]);
        }

        if (!empty($categoryTypes)) {
            $typeValues = array_map(fn (CategoryType $t) => $t->value, $categoryTypes);
            $query->whereHas('category', function ($q) use ($typeValues) {
                $q->whereIn('type', $typeValues);
            });
        }

        return $query->get()
            ->map(fn (EloquentFinancialRecord $record) => $this->toDomain($record))
            ->all();
    }

    /**
     * @return array<int> List of distinct fiscal years with financial records for company, sorted descending (e.g. [2026, 2025, 2024])
     */
    public function getAvailableFiscalYears(string $companyId): array
    {
        /** @var \Illuminate\Database\Eloquent\Builder $query */
        $query = EloquentFinancialRecord::query()
            ->where('company_id', $companyId);

        $driver = DB::connection()->getDriverName();
        if ($driver === 'sqlite') {
            $yearExpression = "cast(strftime('%Y', record_date) as integer)";
        } else {
            $yearExpression = 'EXTRACT(YEAR FROM record_date)::integer';
        }

        return $query
            ->selectRaw("DISTINCT {$yearExpression} AS fiscal_year")
            ->orderBy('fiscal_year', 'desc')
            ->pluck('fiscal_year')
            ->map(fn ($year) => (int) $year)
            ->values()
            ->all();
    }

    public function save(FinancialRecord $record): void
    {
        EloquentFinancialRecord::query()->updateOrCreate(
            ['id' => $record->id()],
            [
                'company_id' => $record->companyId(),
                'category_id' => $record->category()->id(),
                'record_type' => $record->recordType()->value,
                'amount' => $record->amount()->amount(),
                'currency' => $record->amount()->currency()->value,
                'record_date' => $record->recordDate()->format('Y-m-d'),
                'description' => $record->description(),
                'source' => $record->source(),
            ]
        );

        $this->dispatchDomainEvents($record);
    }

    /**
     * @param array<FinancialRecord> $records
     */
    public function saveMany(array $records): void
    {
        if (empty($records)) {
            return;
        }

        DB::transaction(function () use ($records) {
            foreach ($records as $record) {
                $this->save($record);
            }
        });
    }

    public function delete(FinancialRecordId $id): void
    {
        EloquentFinancialRecord::destroy($id->value());
    }

    public function deleteByCompanyId(string $companyId): int
    {
        return EloquentFinancialRecord::where('company_id', $companyId)->delete();
    }

    private function toDomain(EloquentFinancialRecord $eloquent): FinancialRecord
    {
        $eloquentCategory = $eloquent->category;

        $category = new Category(
            id: $eloquentCategory->id,
            name: $eloquentCategory->name,
            type: CategoryType::from($eloquentCategory->type),
            code: $eloquentCategory->code,
            description: $eloquentCategory->description
        );

        $recordDate = new DateTimeImmutable($eloquent->record_date->format('Y-m-d'));
        $createdAt = new DateTimeImmutable($eloquent->created_at?->format(DateTimeImmutable::ATOM) ?? 'now');
        $updatedAt = $eloquent->updated_at ? new DateTimeImmutable($eloquent->updated_at->format(DateTimeImmutable::ATOM)) : null;

        return new FinancialRecord(
            id: FinancialRecordId::fromString($eloquent->id),
            companyId: $eloquent->company_id,
            category: $category,
            amount: Money::fromDecimal($eloquent->amount, Currency::from($eloquent->currency)),
            recordDate: $recordDate,
            description: $eloquent->description,
            source: $eloquent->source,
            createdAt: $createdAt,
            updatedAt: $updatedAt
        );
    }

    private function dispatchDomainEvents(FinancialRecord $record): void
    {
        foreach ($record->releaseEvents() as $event) {
            $this->dispatcher->dispatch($event);
        }
    }
}
