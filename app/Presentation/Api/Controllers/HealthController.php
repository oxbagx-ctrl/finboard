<?php

declare(strict_types=1);

namespace App\Presentation\Api\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Storage;
use Throwable;

final class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $status = 'healthy';
        $services = [];

        // 1. Database Check
        $dbStart = microtime(true);
        try {
            DB::connection()->getPdo();
            DB::select('SELECT 1');
            $dbLatency = round((microtime(true) - $dbStart) * 1000, 2);
            $services['database'] = [
                'status' => 'ok',
                'latency_ms' => $dbLatency,
            ];
        } catch (Throwable $e) {
            $status = 'unhealthy';
            $services['database'] = [
                'status' => 'error',
                'message' => $e->getMessage(),
            ];
        }

        // 2. Redis Check
        try {
            Redis::ping();
            $services['redis'] = [
                'status' => 'ok',
            ];
        } catch (Throwable $e) {
            // In testing/mock environments Redis might not be configured as native
            $services['redis'] = [
                'status' => 'skipped_or_degraded',
                'message' => $e->getMessage(),
            ];
        }

        // 3. Storage Check
        try {
            $testFileName = 'health_check_' . uniqid() . '.tmp';
            Storage::disk('local')->put($testFileName, 'OK');
            Storage::disk('local')->delete($testFileName);
            $services['storage'] = [
                'status' => 'ok',
                'disk' => 'local',
            ];
        } catch (Throwable $e) {
            $status = 'unhealthy';
            $services['storage'] = [
                'status' => 'error',
                'message' => $e->getMessage(),
            ];
        }

        $httpCode = ($status === 'healthy') ? 200 : 503;

        return response()->json([
            'status' => $status,
            'timestamp' => now()->toIso8601String(),
            'platform' => 'FinBoard Enterprise Financial Platform',
            'environment' => config('app.env'),
            'php_version' => PHP_VERSION,
            'services' => $services,
            'memory_usage' => round(memory_get_usage(true) / 1024 / 1024, 2) . ' MB',
        ], $httpCode);
    }
}
