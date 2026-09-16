<?php

declare(strict_types=1);

namespace App\Presentation\Api\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Response;

final class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::with('company')->where('email', strtolower(trim($validated['email'])))->first();

        if ($user === null || !Hash::check($validated['password'], $user->password)) {
            return new JsonResponse([
                'message' => 'Błędny adres email lub hasło.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        if (!$user->is_active) {
            return new JsonResponse([
                'message' => 'Konto użytkownika jest zablokowane.',
            ], Response::HTTP_FORBIDDEN);
        }

        $token = $user->createToken('finboard-api-token')->plainTextToken;

        return new JsonResponse([
            'token' => $token,
            'token_type' => 'Bearer',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'company' => $user->company ? [
                    'id' => $user->company->id,
                    'name' => $user->company->name,
                    'code' => $user->company->code,
                ] : null,
            ],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user()->load('company');

        return new JsonResponse([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'company' => $user->company ? [
                    'id' => $user->company->id,
                    'name' => $user->company->name,
                    'code' => $user->company->code,
                ] : null,
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return new JsonResponse([
            'message' => 'Wylogowano pomyślnie.',
        ]);
    }
}
