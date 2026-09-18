<?php

declare(strict_types=1);

namespace App\Presentation\Api\Traits;

use App\Models\User;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

trait ResolvesCompanyContext
{
    /**
     * Resolve the targeted company ID ensuring proper multi-tenant access control.
     */
    protected function resolveCompanyId(Request $request): string
    {
        /** @var User $user */
        $user = $request->user();

        $requestedCompanyId = $request->input('company_id')
            ?? $request->query('company_id')
            ?? $request->header('X-Company-Id');

        if ($user->role === 'admin') {
            if ($requestedCompanyId !== null && trim((string) $requestedCompanyId) !== '') {
                return (string) $requestedCompanyId;
            }

            return (string) $user->company_id;
        }

        // For non-admin users, always enforce their assigned company_id
        if ($requestedCompanyId !== null && (string) $requestedCompanyId !== (string) $user->company_id) {
            throw new AccessDeniedHttpException('Brak uprawnień do przeglądania danych innej firmy.');
        }

        return (string) $user->company_id;
    }
}
