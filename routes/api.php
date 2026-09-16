<?php

use App\Presentation\Api\Controllers\AuthController;
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
    });
});
