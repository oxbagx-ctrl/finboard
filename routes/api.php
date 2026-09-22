<?php

use App\Presentation\Api\Controllers\AdminMailController;
use App\Presentation\Api\Controllers\AdvisorManagementController;
use App\Presentation\Api\Controllers\AuditLogController;
use App\Presentation\Api\Controllers\AuthController;
use App\Presentation\Api\Controllers\BenchmarkController;
use App\Presentation\Api\Controllers\DocumentController;
use App\Presentation\Api\Controllers\FinancialAnalyticsController;
use App\Presentation\Api\Controllers\FinancialCategoryController;
use App\Presentation\Api\Controllers\FinancialImportController;
use App\Presentation\Api\Controllers\FinancialRecordController;
use App\Presentation\Api\Controllers\HealthController;
use App\Presentation\Api\Controllers\InvestmentProject\InvestmentAppraisalController;
use App\Presentation\Api\Controllers\InvestmentProject\InvestmentCapexStageController;
use App\Presentation\Api\Controllers\InvestmentProject\InvestmentProjectController;
use App\Presentation\Api\Controllers\InvestmentProject\InvestmentStatementController;
use App\Presentation\Api\Controllers\InvitationController;
use App\Presentation\Api\Controllers\KpiController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // System Health & Liveness Probe
    Route::get('/health', HealthController::class)->name('api.health');

    // Public Authentication & Activation Endpoints
    Route::post('/auth/login', [AuthController::class, 'login'])->name('api.auth.login');
    Route::get('/invitations/verify', [InvitationController::class, 'verify'])->name('api.invitations.verify');
    Route::get('/invitations/tokens/{token}', [InvitationController::class, 'verify'])->name('api.invitations.tokens.verify');
    Route::post('/invitations/accept', [InvitationController::class, 'accept'])->name('api.invitations.accept');

    // Authenticated Endpoints (Sanctum)
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/auth/me', [AuthController::class, 'me'])->name('api.auth.me');
        Route::put('/auth/profile', [AuthController::class, 'updateProfile'])->name('api.auth.profile');
        Route::post('/auth/logout', [AuthController::class, 'logout'])->name('api.auth.logout');

        // RBAC Verification probe endpoints
        Route::get('/admin/probe', function () {
            return response()->json(['status' => 'ok', 'message' => 'Admin authorized access confirmed']);
        })->middleware('role:admin,super_admin');

        Route::get('/client/probe', function () {
            return response()->json(['status' => 'ok', 'message' => 'Client authorized access confirmed']);
        })->middleware('role:client,admin,super_admin');

        // SuperAdmin / Admin Advisor & Company Management Endpoints
        Route::middleware('role:super_admin,admin')->prefix('admin')->group(function () {
            Route::get('/advisors', [AdvisorManagementController::class, 'index'])->name('api.admin.advisors.index');
            Route::get('/advisors/{id}', [AdvisorManagementController::class, 'show'])->name('api.admin.advisors.show');
            Route::post('/advisors/{id}/companies', [AdvisorManagementController::class, 'assignCompany'])->name('api.admin.advisors.assign-company');
            Route::delete('/advisors/{id}/companies/{companyId}', [AdvisorManagementController::class, 'revokeCompany'])->name('api.admin.advisors.revoke-company');
            Route::put('/advisors/{id}/companies', [AdvisorManagementController::class, 'syncCompanies'])->name('api.admin.advisors.sync-companies');
            Route::patch('/advisors/{id}/toggle-status', [AdvisorManagementController::class, 'toggleStatus'])->name('api.admin.advisors.toggle-status');
            Route::get('/companies', [AdvisorManagementController::class, 'companies'])->name('api.admin.companies.index');
            Route::post('/companies', [AdvisorManagementController::class, 'storeCompany'])->name('api.admin.companies.store');

            // Mail Diagnostics & Testing Endpoints
            Route::get('/mail/status', [AdminMailController::class, 'status'])->name('api.admin.mail.status');
            Route::post('/mail/test', [AdminMailController::class, 'test'])->name('api.admin.mail.test');
            Route::post('/mail/test-connection', [AdminMailController::class, 'test'])->name('api.admin.mail.test-connection');
        });

        // Invitation Management Endpoints
        Route::prefix('invitations')->group(function () {
            Route::get('/', [InvitationController::class, 'index'])->name('api.invitations.index');
            Route::post('/', [InvitationController::class, 'store'])->name('api.invitations.store');
            Route::post('/{id}/resend', [InvitationController::class, 'resend'])->name('api.invitations.resend');
            Route::delete('/{id}', [InvitationController::class, 'destroy'])->name('api.invitations.destroy');
        });

        // Finance Module Endpoints
        Route::prefix('finance')->group(function () {
            // Categories
            Route::get('/categories', [FinancialCategoryController::class, 'index']
                )->name('api.finance.categories.index');

            // Financial Records CRUD
            Route::get('/records', [FinancialRecordController::class, 'index']
                )->name('api.finance.records.index');
            Route::post('/records', [FinancialRecordController::class, 'store']
                )->name('api.finance.records.store');
            Route::delete('/records/batch', [FinancialRecordController::class, 'batchDestroy']
                )->name('api.finance.records.batch-destroy');
            Route::get('/records/{id}', [FinancialRecordController::class, 'show']
                )->name('api.finance.records.show');
            Route::put('/records/{id}', [FinancialRecordController::class, 'update']
                )->name('api.finance.records.update');
            Route::delete('/records/{id}', [FinancialRecordController::class, 'destroy']
                )->name('api.finance.records.destroy');


            // Financial Benchmarks & Targets Management
            Route::prefix('benchmarks')->group(function () {
                Route::get('/', [BenchmarkController::class, 'index'])->name('api.finance.benchmarks.index');
                Route::put('/', [BenchmarkController::class, 'batchUpdate'])->name('api.finance.benchmarks.batch-update');
                Route::post('/reset', [BenchmarkController::class, 'reset'])->name('api.finance.benchmarks.reset');
                Route::get('/{metricType}', [BenchmarkController::class, 'show'])->name('api.finance.benchmarks.show');
                Route::put('/{metricType}', [BenchmarkController::class, 'update'])->name('api.finance.benchmarks.update');
            });

            // Financial Audit Trail Endpoints
            Route::prefix('audit-logs')->group(function () {
                Route::get('/', [AuditLogController::class, 'index'])->name('api.finance.audit-logs.index');
                Route::get('/stats', [AuditLogController::class, 'stats'])->name('api.finance.audit-logs.stats');
                Route::get('/{id}', [AuditLogController::class, 'show'])->name('api.finance.audit-logs.show');
            });

            // CSV Import (canonical and plural REST routes)
            Route::post('/import/csv', [FinancialImportController::class, 'store']
                )->name('api.finance.import.store');
            Route::post('/imports', [FinancialImportController::class, 'store']
                )->name('api.finance.imports.store');

            Route::post('/import/preview', [FinancialImportController::class, 'preview']
                )->name('api.finance.import.preview');
            Route::post('/imports/preview', [FinancialImportController::class, 'preview']
                )->name('api.finance.imports.preview');

            Route::get('/import/history', [FinancialImportController::class, 'history']
                )->name('api.finance.import.history');
            Route::get('/imports/history', [FinancialImportController::class, 'history']
                )->name('api.finance.imports.history');

            Route::get('/import/csv/{id}', [FinancialImportController::class, 'show']
                )->name('api.finance.import.show');
            Route::get('/imports/{id}', [FinancialImportController::class, 'show']
                )->name('api.finance.imports.show');

            // Dedicated KPI Endpoint
            Route::get('/kpi', [KpiController::class, 'metrics']
                )->name('api.finance.kpi');

            // Analytics, KPIs and Chart Data
            Route::prefix('analytics')->group(function () {
                Route::get('/metrics', [KpiController::class, 'metrics']
                    )->name('api.finance.analytics.metrics');
                Route::get('/dynamics', [FinancialAnalyticsController::class, 'dynamics']
                    )->name('api.finance.analytics.dynamics');
                Route::get('/years', [FinancialAnalyticsController::class, 'years']
                    )->name('api.finance.analytics.years');
                Route::get('/trends', [FinancialAnalyticsController::class, 'trends']
                    )->name('api.finance.analytics.trends');
                Route::get('/breakdown', [FinancialAnalyticsController::class, 'breakdown']
                    )->name('api.finance.analytics.breakdown');
                Route::get('/liquidity', [FinancialAnalyticsController::class, 'liquidity']
                    )->name('api.finance.analytics.liquidity');
            });
        });

        // Top-level Financial Audit Trail Aliases
        Route::prefix('audit-logs')->group(function () {
            Route::get('/', [AuditLogController::class, 'index'])->name('api.audit-logs.index');
            Route::get('/stats', [AuditLogController::class, 'stats'])->name('api.audit-logs.stats');
            Route::get('/{id}', [AuditLogController::class, 'show'])->name('api.audit-logs.show');
        });

        // Virtual Data Room (VDR) Endpoints
        Route::prefix('documents')->group(function () {
            Route::get('/audit-logs', [DocumentController::class, 'allAuditLogs']
                )->name('api.documents.all-audit-logs');
            Route::get('/', [DocumentController::class, 'index']
                )->name('api.documents.index');
            Route::post('/', [DocumentController::class, 'store']
                )->name('api.documents.store');
            Route::get('/{id}', [DocumentController::class, 'show']
                )->name('api.documents.show');
            Route::put('/{id}', [DocumentController::class, 'update']
                )->name('api.documents.update');
            Route::delete('/{id}', [DocumentController::class, 'destroy']
                )->name('api.documents.destroy');
            Route::get('/{id}/download', [DocumentController::class, 'download']
                )->name('api.documents.download');
            Route::patch('/{id}/archive', [DocumentController::class, 'archive']
                )->name('api.documents.archive');
            Route::get('/{id}/audit-logs', [DocumentController::class, 'auditLogs']
                )->name('api.documents.audit-logs');
        });

        // Investment Projects & Valuation Module Endpoints
        Route::prefix('investment-projects')->group(function () {
            Route::get('/', [InvestmentProjectController::class, 'index'])->name('api.investment-projects.index');
            Route::post('/', [InvestmentProjectController::class, 'store'])->name('api.investment-projects.store');
            Route::get('/{id}', [InvestmentProjectController::class, 'show'])->name('api.investment-projects.show');
            Route::put('/{id}', [InvestmentProjectController::class, 'update'])->name('api.investment-projects.update');
            Route::delete('/{id}', [InvestmentProjectController::class, 'destroy'])->name('api.investment-projects.destroy');

            // CAPEX Stages Management
            Route::post('/{projectId}/capex-stages', [InvestmentCapexStageController::class, 'store'])->name('api.investment-projects.capex-stages.store');
            Route::put('/{projectId}/capex-stages/{stageId}', [InvestmentCapexStageController::class, 'update'])->name('api.investment-projects.capex-stages.update');
            Route::delete('/{projectId}/capex-stages/{stageId}', [InvestmentCapexStageController::class, 'destroy'])->name('api.investment-projects.capex-stages.destroy');

            // 15-Year Financial Statements (3-Statement & Depreciation)
            Route::get('/{id}/statements/three-statement', [InvestmentStatementController::class, 'threeStatement'])->name('api.investment-projects.statements.three-statement');
            Route::get('/{id}/statements/income-statement', [InvestmentStatementController::class, 'incomeStatement'])->name('api.investment-projects.statements.income-statement');
            Route::get('/{id}/statements/balance-sheet', [InvestmentStatementController::class, 'balanceSheet'])->name('api.investment-projects.statements.balance-sheet');
            Route::get('/{id}/statements/cash-flow', [InvestmentStatementController::class, 'cashFlow'])->name('api.investment-projects.statements.cash-flow');
            Route::get('/{id}/statements/depreciation', [InvestmentStatementController::class, 'depreciation'])->name('api.investment-projects.statements.depreciation');

            // Valuation & Equity Waterfall
            Route::get('/{id}/appraisal', [InvestmentAppraisalController::class, 'appraisal'])->name('api.investment-projects.appraisal');
            Route::post('/{id}/waterfall', [InvestmentAppraisalController::class, 'waterfall'])->name('api.investment-projects.waterfall');
        });
    });
});

