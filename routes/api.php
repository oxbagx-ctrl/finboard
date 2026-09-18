<?php

use App\Presentation\Api\Controllers\AuthController;
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
        });
    });
});
