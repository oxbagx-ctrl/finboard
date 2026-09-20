<?php

declare(strict_types=1);

namespace App\Contexts\Finance\Domain\ValueObjects;

enum AuditAction: string
{
    case RECORD_CREATED = 'RECORD_CREATED';
    case RECORD_UPDATED = 'RECORD_UPDATED';
    case RECORD_DELETED = 'RECORD_DELETED';
    case RECORDS_BATCH_DELETED = 'RECORDS_BATCH_DELETED';
    case BENCHMARK_CONFIGURED = 'BENCHMARK_CONFIGURED';
    case BENCHMARK_RESET = 'BENCHMARK_RESET';
    case CSV_IMPORT_PROCESSED = 'CSV_IMPORT_PROCESSED';
    case CSV_IMPORT_FAILED = 'CSV_IMPORT_FAILED';
    case METRICS_EVALUATED = 'METRICS_EVALUATED';

    public function label(): string
    {
        return match ($this) {
            self::RECORD_CREATED => 'Utworzenie rekordu finansowego',
            self::RECORD_UPDATED => 'Modyfikacja rekordu finansowego',
            self::RECORD_DELETED => 'Usunięcie rekordu finansowego',
            self::RECORDS_BATCH_DELETED => 'Masowe usunięcie rekordów finansowych',
            self::BENCHMARK_CONFIGURED => 'Konfiguracja celu finansowego',
            self::BENCHMARK_RESET => 'Reset celów benchmarkowych',
            self::CSV_IMPORT_PROCESSED => 'Asynchroniczny import danych CSV',
            self::CSV_IMPORT_FAILED => 'Niepowodzenie importu CSV',
            self::METRICS_EVALUATED => 'Ewaluacja wskaźników KPI',
        };
    }

    public function color(): string
    {
        return match ($this) {
            self::RECORD_CREATED => 'emerald',
            self::RECORD_UPDATED => 'blue',
            self::RECORD_DELETED,
            self::RECORDS_BATCH_DELETED => 'rose',
            self::BENCHMARK_CONFIGURED => 'indigo',
            self::BENCHMARK_RESET => 'amber',
            self::CSV_IMPORT_PROCESSED => 'cyan',
            self::CSV_IMPORT_FAILED => 'red',
            self::METRICS_EVALUATED => 'violet',
        };
    }

    public function category(): string
    {
        return match ($this) {
            self::RECORD_CREATED,
            self::RECORD_UPDATED,
            self::RECORD_DELETED,
            self::RECORDS_BATCH_DELETED => 'financial_record',
            self::BENCHMARK_CONFIGURED,
            self::BENCHMARK_RESET => 'benchmark',
            self::CSV_IMPORT_PROCESSED,
            self::CSV_IMPORT_FAILED => 'import',
            self::METRICS_EVALUATED => 'analytics',
        };
    }

}
