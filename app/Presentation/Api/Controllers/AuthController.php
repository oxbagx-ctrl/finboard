<?php

declare(strict_types=1);

namespace App\Presentation\Api\Controllers;

use App\Models\Company;
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

        $availableCompanies = $user->role === 'admin'
            ? Company::orderBy('name')->get(['id', 'name', 'code', 'tax_id'])->values()
            : ($user->company ? [
                [
                    'id' => $user->company->id,
                    'name' => $user->company->name,
                    'code' => $user->company->code,
                    'tax_id' => $user->company->tax_id,
                ]
            ] : []);

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
                    'tax_id' => $user->company->tax_id,
                ] : null,
            ],
            'available_companies' => $availableCompanies,
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user()->load('company');

        $availableCompanies = $user->role === 'admin'
            ? Company::orderBy('name')->get(['id', 'name', 'code', 'tax_id'])->values()
            : ($user->company ? [
                [
                    'id' => $user->company->id,
                    'name' => $user->company->name,
                    'code' => $user->company->code,
                    'tax_id' => $user->company->tax_id,
                ]
            ] : []);

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
                    'tax_id' => $user->company->tax_id,
                ] : null,
            ],
            'available_companies' => $availableCompanies,
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'current_password' => ['sometimes', 'required_with:new_password', 'string'],
            'new_password' => ['sometimes', 'required_with:current_password', 'string', 'min:8'],
        ]);

        /** @var User $user */
        $user = $request->user();

        if (isset($validated['name'])) {
            $user->name = trim($validated['name']);
        }

        if (isset($validated['new_password'])) {
            if (!Hash::check($validated['current_password'], $user->password)) {
                return new JsonResponse([
                    'message' => 'Podane aktualne hasło jest niepoprawne.',
                    'errors' => [
                        'current_password' => ['Podane aktualne hasło jest niepoprawne.'],
                    ],
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $user->password = Hash::make($validated['new_password']);
        }

        $user->save();
        $user->load('company');

        return new JsonResponse([
            'message' => 'Profil został zaktualizowany pomyślnie.',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'company' => $user->company ? [
                    'id' => $user->company->id,
                    'name' => $user->company->name,
                    'code' => $user->company->code,
                    'tax_id' => $user->company->tax_id,
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
