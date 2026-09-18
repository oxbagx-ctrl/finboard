<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

final class AuthApiTest extends TestCase
{
    use DatabaseTransactions;

    private User $adminUser;
    private User $clientUser;
    private User $inactiveUser;
    private Company $acmeCompany;
    private Company $helvestCompany;

    protected function setUp(): void
    {
        parent::setUp();

        $this->helvestCompany = Company::firstOrCreate(
            ['code' => 'HELVEST'],
            ['name' => 'Helvest Advisory Sp. z o.o.', 'tax_id' => 'PL5252525252']
        );

        $this->acmeCompany = Company::firstOrCreate(
            ['code' => 'ACME'],
            ['name' => 'Acme Manufacturing S.A.', 'tax_id' => 'PL7010101010']
        );

        $this->adminUser = User::firstOrCreate(
            ['email' => 'admin@helvest.com'],
            [
                'name' => 'Admin Helvest',
                'password' => bcrypt('password123'),
                'role' => 'admin',
                'company_id' => $this->helvestCompany->id,
                'is_active' => true,
            ]
        );

        $this->clientUser = User::firstOrCreate(
            ['email' => 'klient@acme.com'],
            [
                'name' => 'Jan Kowalski (CFO Acme)',
                'password' => bcrypt('password123'),
                'role' => 'client',
                'company_id' => $this->acmeCompany->id,
                'is_active' => true,
            ]
        );

        $this->inactiveUser = User::firstOrCreate(
            ['email' => 'inactive@acme.com'],
            [
                'name' => 'Zablokowany Uzytkownik',
                'password' => bcrypt('password123'),
                'role' => 'client',
                'company_id' => $this->acmeCompany->id,
                'is_active' => false,
            ]
        );
    }

    public function test_user_can_login_with_valid_credentials_and_receive_token(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'klient@acme.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'token',
                'token_type',
                'user' => [
                    'id',
                    'name',
                    'email',
                    'role',
                    'company' => [
                        'id',
                        'name',
                        'code',
                    ],
                ],
                'available_companies',
            ])
            ->assertJsonPath('token_type', 'Bearer')
            ->assertJsonPath('user.email', 'klient@acme.com')
            ->assertJsonPath('user.role', 'client')
            ->assertJsonPath('user.company.code', 'ACME');

        $this->assertNotEmpty($response->json('token'));
        $this->assertCount(1, $response->json('available_companies'));
    }

    public function test_admin_receives_all_available_companies_on_login(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@helvest.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure(['token', 'user', 'available_companies']);

        $companies = $response->json('available_companies');
        $this->assertGreaterThanOrEqual(2, count($companies));
    }

    public function test_login_fails_with_invalid_password(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'klient@acme.com',
            'password' => 'wrong-password',
        ]);

        $response->assertStatus(401)
            ->assertJsonPath('message', 'Błędny adres email lub hasło.');
    }

    public function test_login_fails_for_non_existent_email(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'doesnotexist@nowhere.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(401);
    }

    public function test_login_fails_for_deactivated_user(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'inactive@acme.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(403)
            ->assertJsonPath('message', 'Konto użytkownika jest zablokowane.');
    }

    public function test_login_validation_errors(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'not-an-email',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email', 'password']);
    }

    public function test_authenticated_user_can_access_me_endpoint_with_bearer_token(): void
    {
        $loginResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'klient@acme.com',
            'password' => 'password123',
        ]);

        $token = $loginResponse->json('token');

        $meResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/auth/me');

        $meResponse->assertStatus(200)
            ->assertJsonPath('user.email', 'klient@acme.com')
            ->assertJsonPath('user.company.code', 'ACME')
            ->assertJsonStructure(['user', 'available_companies']);
    }

    public function test_user_can_update_profile_name(): void
    {
        $loginResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'klient@acme.com',
            'password' => 'password123',
        ]);
        $token = $loginResponse->json('token');

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->putJson('/api/v1/auth/profile', [
                'name' => 'Jan Kowalski-Nowak (CFO)',
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('user.name', 'Jan Kowalski-Nowak (CFO)');

        $this->assertDatabaseHas('users', [
            'email' => 'klient@acme.com',
            'name' => 'Jan Kowalski-Nowak (CFO)',
        ]);
    }

    public function test_user_can_update_password(): void
    {
        $loginResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'klient@acme.com',
            'password' => 'password123',
        ]);
        $token = $loginResponse->json('token');

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->putJson('/api/v1/auth/profile', [
                'current_password' => 'password123',
                'new_password' => 'newSecretPass2026!',
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('message', 'Profil został zaktualizowany pomyślnie.');

        // Verify login with new password succeeds
        $retryLogin = $this->postJson('/api/v1/auth/login', [
            'email' => 'klient@acme.com',
            'password' => 'newSecretPass2026!',
        ]);
        $retryLogin->assertStatus(200);
    }

    public function test_user_cannot_update_password_with_incorrect_current_password(): void
    {
        $loginResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'klient@acme.com',
            'password' => 'password123',
        ]);
        $token = $loginResponse->json('token');

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->putJson('/api/v1/auth/profile', [
                'current_password' => 'wrongCurrentPassword',
                'new_password' => 'newSecretPass2026!',
            ]);

        $response->assertStatus(422)
            ->assertJsonPath('message', 'Podane aktualne hasło jest niepoprawne.');
    }

    public function test_user_can_logout_and_revoke_token(): void
    {
        $loginResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'klient@acme.com',
            'password' => 'password123',
        ]);

        $token = $loginResponse->json('token');

        $logoutResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/auth/logout');

        $logoutResponse->assertStatus(200)
            ->assertJsonPath('message', 'Wylogowano pomyślnie.');

        // Clear cached guard in test runner so next request re-authenticates from token
        $this->app['auth']->forgetGuards();

        // Token should now be invalid in DB
        $retryMe = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/auth/me');

        $retryMe->assertStatus(401);
    }

    public function test_admin_probe_allows_admin(): void
    {
        $adminLogin = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@helvest.com',
            'password' => 'password123',
        ]);
        $adminToken = $adminLogin->json('token');

        $this->withHeader('Authorization', 'Bearer ' . $adminToken)
            ->getJson('/api/v1/admin/probe')
            ->assertStatus(200)
            ->assertJsonPath('status', 'ok');
    }

    public function test_admin_probe_denies_client(): void
    {
        $clientLogin = $this->postJson('/api/v1/auth/login', [
            'email' => 'klient@acme.com',
            'password' => 'password123',
        ]);
        $clientToken = $clientLogin->json('token');

        $this->withHeader('Authorization', 'Bearer ' . $clientToken)
            ->getJson('/api/v1/admin/probe')
            ->assertStatus(403);
    }

    public function test_client_probe_allows_both_client_and_admin(): void
    {
        $adminLogin = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@helvest.com',
            'password' => 'password123',
        ]);
        $adminToken = $adminLogin->json('token');

        $this->withHeader('Authorization', 'Bearer ' . $adminToken)
            ->getJson('/api/v1/client/probe')
            ->assertStatus(200);

        $this->app['auth']->forgetGuards();

        $clientLogin = $this->postJson('/api/v1/auth/login', [
            'email' => 'klient@acme.com',
            'password' => 'password123',
        ]);
        $clientToken = $clientLogin->json('token');

        $this->withHeader('Authorization', 'Bearer ' . $clientToken)
            ->getJson('/api/v1/client/probe')
            ->assertStatus(200);
    }
}
