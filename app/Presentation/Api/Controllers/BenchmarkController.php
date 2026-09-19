<?php

declare(strict_types=1);

namespace App\Presentation\Api\Controllers;

use App\Contexts\Finance\Domain\Model\FinancialBenchmark;
use App\Contexts\Finance\Domain\Repositories\FinancialBenchmarkRepositoryInterface;
use App\Contexts\Finance\Domain\ValueObjects\BenchmarkMetricType;
use App\Contexts\Finance\Domain\ValueObjects\FinancialBenchmarkId;
use App\Models\User;
use App\Presentation\Api\Requests\BatchUpdateBenchmarksRequest;
use App\Presentation\Api\Requests\UpdateBenchmarkRequest;
use App\Presentation\Api\Traits\ResolvesCompanyContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

final class BenchmarkController
{
    use ResolvesCompanyContext;

    public function __construct(
        private readonly FinancialBenchmarkRepositoryInterface $benchmarkRepository
    ) {
    }

    /**
     * List all benchmarks for the company (both custom and default fallback standards).
     */
    public function index(Request $request): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);
        $configured = $this->benchmarkRepository->findAllByCompanyId($companyId);

        $configuredByMetric = [];
        foreach ($configured as $benchmark) {
            $configuredByMetric[$benchmark->metricType()->value] = $benchmark;
        }

        $benchmarks = [];
        foreach (BenchmarkMetricType::cases() as $metricType) {
            $key = $metricType->value;
            if (isset($configuredByMetric[$key])) {
                $item = $configuredByMetric[$key]->toArray();
                $item['is_custom'] = true;
            } else {
                $defaultBenchmark = FinancialBenchmark::createDefaultForMetric(
                    id: FinancialBenchmarkId::generate(),
                    companyId: $companyId,
                    metricType: $metricType
                );
                $item = $defaultBenchmark->toArray();
                $item['is_custom'] = false;
            }
            $benchmarks[] = $item;
        }

        return new JsonResponse([
            'status' => 'success',
            'company_id' => $companyId,
            'data' => $benchmarks,
        ], Response::HTTP_OK);
    }

    /**
     * Show a single benchmark for a specific metric type.
     */
    public function show(Request $request, string $metricType): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);
        $type = BenchmarkMetricType::tryFrom(strtoupper($metricType));

        if ($type === null) {
            return new JsonResponse([
                'status' => 'error',
                'message' => "Nieznany typ wskaźnika benchmarku: {$metricType}.",
            ], Response::HTTP_NOT_FOUND);
        }

        $benchmark = $this->benchmarkRepository->findByCompanyAndMetric($companyId, $type);
        $isCustom = $benchmark !== null;

        if ($benchmark === null) {
            $benchmark = FinancialBenchmark::createDefaultForMetric(
                id: FinancialBenchmarkId::generate(),
                companyId: $companyId,
                metricType: $type
            );
        }

        $data = $benchmark->toArray();
        $data['is_custom'] = $isCustom;

        return new JsonResponse([
            'status' => 'success',
            'company_id' => $companyId,
            'data' => $data,
        ], Response::HTTP_OK);
    }

    /**
     * Update or create a benchmark threshold for a specific metric.
     */
    public function update(UpdateBenchmarkRequest $request, string $metricType): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if ($user->isClient()) {
            throw new AccessDeniedHttpException('Klienci nie mają uprawnień do modyfikacji celów finansowych.');
        }

        $companyId = $this->resolveCompanyId($request);
        $type = BenchmarkMetricType::tryFrom(strtoupper($metricType));

        if ($type === null) {
            return new JsonResponse([
                'status' => 'error',
                'message' => "Nieznany typ wskaźnika benchmarku: {$metricType}.",
            ], Response::HTTP_NOT_FOUND);
        }

        $target = (float) $request->input('target_value');
        $warning = (float) $request->input('warning_threshold');
        $critical = $request->input('critical_threshold') !== null
            ? (float) $request->input('critical_threshold')
            : null;
        $higherIsBetter = $request->has('higher_is_better')
            ? (bool) $request->input('higher_is_better')
            : $type->higherIsBetter();
        $description = $request->input('description');
        $userId = (string) $user->id;

        try {
            $benchmark = $this->benchmarkRepository->findByCompanyAndMetric($companyId, $type);

            if ($benchmark !== null) {
                $benchmark->updateThresholds(
                    targetValue: $target,
                    warningThreshold: $warning,
                    criticalThreshold: $critical,
                    description: $description,
                    updatedBy: $userId
                );
            } else {
                $benchmark = FinancialBenchmark::create(
                    id: FinancialBenchmarkId::generate(),
                    companyId: $companyId,
                    metricType: $type,
                    targetValue: $target,
                    warningThreshold: $warning,
                    criticalThreshold: $critical,
                    higherIsBetter: $higherIsBetter,
                    description: $description,
                    configuredBy: $userId
                );
            }

            $this->benchmarkRepository->save($benchmark);
        } catch (InvalidArgumentException $e) {
            return new JsonResponse([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $data = $benchmark->toArray();
        $data['is_custom'] = true;

        return new JsonResponse([
            'status' => 'success',
            'message' => "Zaktualizowano cel dla wskaźnika: {$type->label()}.",
            'company_id' => $companyId,
            'data' => $data,
        ], Response::HTTP_OK);
    }

    /**
     * Batch update multiple benchmarks at once.
     */
    public function batchUpdate(BatchUpdateBenchmarksRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if ($user->isClient()) {
            throw new AccessDeniedHttpException('Klienci nie mają uprawnień do modyfikacji celów finansowych.');
        }

        $companyId = $this->resolveCompanyId($request);
        $benchmarksInput = $request->input('benchmarks');
        $userId = (string) $user->id;

        $updatedBenchmarks = [];

        try {
            foreach ($benchmarksInput as $entry) {
                $metricRaw = (string) ($entry['metric_type'] ?? '');
                $type = BenchmarkMetricType::tryFrom(strtoupper($metricRaw));
                if ($type === null) {
                    throw new InvalidArgumentException("Nieznany typ wskaźnika benchmarku: {$metricRaw}.");
                }

                $target = (float) $entry['target_value'];
                $warning = (float) $entry['warning_threshold'];
                $critical = isset($entry['critical_threshold']) && $entry['critical_threshold'] !== null
                    ? (float) $entry['critical_threshold']
                    : null;
                $higherIsBetter = isset($entry['higher_is_better'])
                    ? (bool) $entry['higher_is_better']
                    : $type->higherIsBetter();
                $description = $entry['description'] ?? null;

                $benchmark = $this->benchmarkRepository->findByCompanyAndMetric($companyId, $type);

                if ($benchmark !== null) {
                    $benchmark->updateThresholds(
                        targetValue: $target,
                        warningThreshold: $warning,
                        criticalThreshold: $critical,
                        description: $description,
                        updatedBy: $userId
                    );
                } else {
                    $benchmark = FinancialBenchmark::create(
                        id: FinancialBenchmarkId::generate(),
                        companyId: $companyId,
                        metricType: $type,
                        targetValue: $target,
                        warningThreshold: $warning,
                        criticalThreshold: $critical,
                        higherIsBetter: $higherIsBetter,
                        description: $description,
                        configuredBy: $userId
                    );
                }

                $this->benchmarkRepository->save($benchmark);
                $data = $benchmark->toArray();
                $data['is_custom'] = true;
                $updatedBenchmarks[] = $data;
            }
        } catch (InvalidArgumentException $e) {
            return new JsonResponse([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        return new JsonResponse([
            'status' => 'success',
            'message' => 'Zaktualizowano cele finansowe spółki.',
            'company_id' => $companyId,
            'count' => count($updatedBenchmarks),
            'data' => $updatedBenchmarks,
        ], Response::HTTP_OK);
    }

    /**
     * Reset benchmark targets back to default market standards.
     */
    public function reset(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if ($user->isClient()) {
            throw new AccessDeniedHttpException('Klienci nie mają uprawnień do resetowania celów finansowych.');
        }

        $companyId = $this->resolveCompanyId($request);
        $metricRaw = $request->input('metric_type');

        if ($metricRaw !== null && trim((string) $metricRaw) !== '') {
            $type = BenchmarkMetricType::tryFrom(strtoupper((string) $metricRaw));
            if ($type === null) {
                return new JsonResponse([
                    'status' => 'error',
                    'message' => "Nieznany typ wskaźnika benchmarku: {$metricRaw}.",
                ], Response::HTTP_NOT_FOUND);
            }

            $benchmark = $this->benchmarkRepository->findByCompanyAndMetric($companyId, $type);
            if ($benchmark !== null) {
                $this->benchmarkRepository->delete(FinancialBenchmarkId::fromString($benchmark->id()));
            }

            return new JsonResponse([
                'status' => 'success',
                'message' => "Przywrócono domyślne progi rynkowe dla wskaźnika {$type->label()}.",
                'company_id' => $companyId,
            ], Response::HTTP_OK);
        }

        $deletedCount = $this->benchmarkRepository->deleteByCompanyId($companyId);

        return new JsonResponse([
            'status' => 'success',
            'message' => 'Przywrócono domyślne progi rynkowe dla wszystkich wskaźników spółki.',
            'company_id' => $companyId,
            'reset_count' => $deletedCount,
        ], Response::HTTP_OK);
    }
}
