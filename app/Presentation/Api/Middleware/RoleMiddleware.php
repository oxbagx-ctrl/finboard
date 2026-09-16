<?php

declare(strict_types=1);

namespace App\Presentation\Api\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class RoleMiddleware
{
    /**
     * Handle an incoming request and ensure user has one of the allowed roles.
     *
     * @param Closure(Request): (Response) $next
     * @param string ...$roles
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if ($user === null) {
            return new JsonResponse([
                'message' => 'Unauthenticated.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        if (!$user->is_active) {
            return new JsonResponse([
                'message' => 'Konto użytkownika jest nieaktywne.',
            ], Response::HTTP_FORBIDDEN);
        }

        if (!empty($roles) && !in_array($user->role, $roles, true)) {
            return new JsonResponse([
                'message' => sprintf('Brak uprawnień do tego zasobu. Wymagana rola: %s.', implode(', ', $roles)),
            ], Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}
