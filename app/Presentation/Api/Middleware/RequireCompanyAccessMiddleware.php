<?php

declare(strict_types=1);

namespace App\Presentation\Api\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class RequireCompanyAccessMiddleware
{
    /**
     * Ensure the authenticated user has authorization to access data for the specified company.
     *
     * @param Closure(Request): (Response) $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null) {
            return new JsonResponse([
                'message' => 'Unauthenticated.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        // Admins and SuperAdmins have universal multi-tenant oversight
        if ($user->isAdmin()) {
            return $next($request);
        }

        $companyId = $request->route('companyId')
            ?? $request->input('company_id')
            ?? $request->header('X-Company-Id');

        if ($companyId !== null && !$user->canAccessCompany((string) $companyId)) {
            return new JsonResponse([
                'message' => 'Brak uprawnień do przeglądania danych wskazanej firmy.',
            ], Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}
