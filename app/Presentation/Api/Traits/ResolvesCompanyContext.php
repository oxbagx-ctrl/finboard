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

        if ($user->isAdmin()) {
            if ($requestedCompanyId !== null && trim((string) $requestedCompanyId) !== '') {
                return (string) $requestedCompanyId;
            }

            return (string) $user->company_id;
        }

        if ($user->isAdvisor()) {
            if ($requestedCompanyId !== null && trim((string) $requestedCompanyId) !== '') {
                if (!$user->canAccessCompany((string) $requestedCompanyId)) {
                    throw new AccessDeniedHttpException('Doradca nie jest przypisany do wskazanej firmy.');
                }

                return (string) $requestedCompanyId;
            }

            // Default to first assigned company
            $firstAssigned = $user->assignedCompanies()->first();
            if ($firstAssigned !== null) {
                return (string) $firstAssigned->id;
            }

            if ($user->company_id !== null) {
                return (string) $user->company_id;
            }

            throw new AccessDeniedHttpException('Doradca nie posiada przypisanej żadnej firmy.');
        }

        // For client users, always enforce their assigned company_id
        if ($requestedCompanyId !== null && (string) $requestedCompanyId !== (string) $user->company_id) {
            throw new AccessDeniedHttpException('Brak uprawnień do przeglądania danych innej firmy.');
        }

        return (string) $user->company_id;
    }
}
