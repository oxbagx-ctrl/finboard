<?php

use App\Presentation\Api\Controllers\AuthController;
use App\Presentation\Api\Controllers\DocumentController;
use App\Presentation\Api\Controllers\FinancialAnalyticsController;
use App\Presentation\Api\Controllers\FinancialCategoryController;
use App\Presentation\Api\Controllers\FinancialImportController;
use App\Presentation\Api\Controllers\FinancialRecordController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // Public Authentication Endpoints
    Route::post('/auth/login', [AuthController::class, 'login'])->name('api.auth.login');

    // Authenticated Endpoints (Sanctum)
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/auth/me', [AuthController::class, 'me'])->name('api.auth.me');
        Route::post('/auth/logout', [AuthController::class, 'logout'])->name('api.auth.logout');

        // RBAC Verification probe endpoints
        Route::get('/admin/probe', function () {
            return response()->json(['status' => 'ok', 'message' => 'Admin authorized access confirmed']);
        })->middleware('role:admin');

        Route::get('/client/probe', function () {
            return response()->json(['status' => 'ok', 'message' => 'Client authorized access confirmed']);
        })->middleware('role:client,admin');

        // Finance Module Endpoints
        Route::prefix('finance')->group(function () {
            // Categories
            Route::get('/categories', [FinancialCategoryController::class, 'index'])
                ->name('api.finance.categories.index');

            // Financial Records CRUD
            Route::get('/records', [FinancialRecordController::class, 'index'])
                ->name('api.finance.records.index');
            Route::post('/records', [FinancialRecordController::class, 'store'])
                ->name('api.finance.records.store');
            Route::get('/records/{id}', [FinancialRecordController::class, 'show'])
                ->name('api.finance.records.show');
            Route::put('/records/{id}', [FinancialRecordController::class, 'update'])
                ->name('api.finance.records.update');
            Route::delete('/records/{id}', [FinancialRecordController::class, 'destroy'])
                ->name('api.finance.records.destroy');

            // CSV Import
            Route::post('/import/csv', [FinancialImportController::class, 'store'])
                ->name('api.finance.import.store');
            Route::post('/import/preview', [FinancialImportController::class, 'preview'])
                ->name('api.finance.import.preview');
            Route::get('/import/history', [FinancialImportController::class, 'history'])
                ->name('api.finance.import.history');
            Route::get('/import/csv/{id}', [FinancialImportController::class, 'show'])
                ->name('api.finance.import.show');

            // Analytics, KPIs and Chart Data
            Route::prefix('analytics')->group(function () {
                Route::get('/metrics', [FinancialAnalyticsController::class, 'metrics'])
                    ->name('api.finance.analytics.metrics');
                Route::get('/trends', [FinancialAnalyticsController::class, 'trends'])
                    ->name('api.finance.analytics.trends');
                Route::get('/breakdown', [FinancialAnalyticsController::class, 'breakdown'])
                    ->name('api.finance.analytics.breakdown');
                Route::get('/liquidity', [FinancialAnalyticsController::class, 'liquidity'])
                    ->name('api.finance.analytics.liquidity');
            });
        });

        // Virtual Data Room (VDR) Endpoints
        Route::prefix('documents')->group(function () {
            Route::get('/audit-logs', [DocumentController::class, 'allAuditLogs'])
                ->name('api.documents.all-audit-logs');
            Route::get('/', [DocumentController::class, 'index'])
                ->name('api.documents.index');
            Route::post('/', [DocumentController::class, 'store'])
                ->name('api.documents.store');
            Route::get('/{id}', [DocumentController::class, 'show'])
                ->name('api.documents.show');
            Route::put('/{id}', [DocumentController::class, 'update'])
                ->name('api.documents.update');
            Route::delete('/{id}', [DocumentController::class, 'destroy'])
                ->name('api.documents.destroy');
            Route::get('/{id}/download', [DocumentController::class, 'download'])
                ->name('api.documents.download');
            Route::patch('/{id}/archive', [DocumentController::class, 'archive'])
                ->name('api.documents.archive');
            Route::get('/{id}/audit-logs', [DocumentController::class, 'auditLogs'])
                ->name('api.documents.audit-logs');
        });
    });
});
