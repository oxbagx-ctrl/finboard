<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\Invitation;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class InvitationApiTest extends TestCase
{
    use DatabaseTransactions;

    private User $admin;
    private User $advisor;
    private User $client;
    private Company $companyA;
    private Company $companyB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->companyA = Company::firstOrCreate(
            ['code' => 'ACME'],
            ['name' => 'Acme Manufacturing S.A.']
        );

        $this->companyB = Company::firstOrCreate(
            ['code' => 'HELVEST'],
            ['name' => 'Helvest Advisory Sp. z o.o.']
        );

        $this->admin = User::firstOrCreate(
            ['email' => 'admin@helvest.com'],
            [
                'name' => 'Super Admin',
                'password' => bcrypt('password123'),
                'role' => 'super_admin',
                'is_active' => true,
            ]
        );

        $this->advisor = User::firstOrCreate(
            ['email' => 'advisor.test@helvest.com'],
            [
                'name' => 'Advisor Test',
                'password' => bcrypt('password123'),
                'role' => 'advisor',
                'is_active' => true,
            ]
        );

        $this->advisor->assignedCompanies()->syncWithoutDetaching([$this->companyA->id]);

        $this->client = User::firstOrCreate(
            ['email' => 'client.test@acme.com'],
            [
                'name' => 'Client Test',
                'password' => bcrypt('password123'),
                'role' => 'client',
                'company_id' => $this->companyA->id,
                'is_active' => true,
            ]
        );
    }

    public function test_unauthenticated_request_cannot_list_or_create_invitations(): void
    {
        $this->getJson('/api/v1/invitations')->assertStatus(401);
        $this->postJson('/api/v1/invitations', [])->assertStatus(401);
    }

    public function test_client_cannot_list_or_create_invitations(): void
    {
        Sanctum::actingAs($this->client);

        $this->getJson('/api/v1/invitations')->assertStatus(403);

        $this->postJson('/api/v1/invitations', [
            'email' => 'forbidden@acme.com',
            'role' => 'client',
            'company_id' => $this->companyA->id,
        ])->assertStatus(403);
    }

    public function test_superadmin_can_send_invitation_to_client(): void
    {
        Sanctum::actingAs($this->admin);

        $response = $this->postJson('/api/v1/invitations', [
            'email' => 'invited.cfo@acme.com',
            'role' => 'client',
            'company_id' => (string) $this->companyA->id,
            'validity_hours' => 72,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.email', 'invited.cfo@acme.com')
            ->assertJsonPath('data.role', 'client')
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.is_pending', true);

        $this->assertDatabaseHas('invitations', [
            'email' => 'invited.cfo@acme.com',
            'role' => 'client',
            'company_id' => (string) $this->companyA->id,
            'status' => 'pending',
        ]);
    }

    public function test_advisor_can_invite_client_to_assigned_company_only(): void
    {
        Sanctum::actingAs($this->advisor);

        // Can invite to assigned companyA
        $this->postJson('/api/v1/invitations', [
            'email' => 'client.a@acme.com',
            'role' => 'client',
            'company_id' => (string) $this->companyA->id,
        ])->assertStatus(201);

        // Cannot invite to unassigned companyB
        $this->postJson('/api/v1/invitations', [
            'email' => 'client.b@helvest.com',
            'role' => 'client',
            'company_id' => (string) $this->companyB->id,
        ])->assertStatus(403);
    }

    public function test_advisor_can_only_see_invitations_for_assigned_companies(): void
    {
        // Create invitation for companyA and companyB
        $invA = Invitation::create([
            'email' => 'invite.compa@example.com',
            'role' => 'client',
            'company_id' => (string) $this->companyA->id,
            'token' => 'token_for_comp_a_' . bin2hex(random_bytes(20)),
            'invited_by' => (string) $this->admin->id,
            'status' => 'pending',
            'expires_at' => Carbon::now()->addDays(2),
        ]);

        $invB = Invitation::create([
            'email' => 'invite.compb@example.com',
            'role' => 'client',
            'company_id' => (string) $this->companyB->id,
            'token' => 'token_for_comp_b_' . bin2hex(random_bytes(20)),
            'invited_by' => (string) $this->admin->id,
            'status' => 'pending',
            'expires_at' => Carbon::now()->addDays(2),
        ]);

        Sanctum::actingAs($this->advisor);

        $response = $this->getJson('/api/v1/invitations');
        $response->assertStatus(200);

        $emails = collect($response->json('data'))->pluck('email');
        $this->assertTrue($emails->contains('invite.compa@example.com'));
        $this->assertFalse($emails->contains('invite.compb@example.com'));
    }

    public function test_public_verify_endpoint_validates_token(): void
    {
        $token = 'public_token_test_' . bin2hex(random_bytes(20));

        $invitation = Invitation::create([
            'email' => 'verify.user@acme.com',
            'role' => 'client',
            'company_id' => (string) $this->companyA->id,
            'token' => $token,
            'invited_by' => (string) $this->admin->id,
            'status' => 'pending',
            'expires_at' => Carbon::now()->addHours(24),
        ]);

        // Via query parameter
        $responseQuery = $this->getJson('/api/v1/invitations/verify?token=' . $token);
        $responseQuery->assertStatus(200)
            ->assertJsonPath('valid', true)
            ->assertJsonPath('email', 'verify.user@acme.com')
            ->assertJsonPath('role', 'client')
            ->assertJsonPath('company.code', 'ACME');

        // Via route parameter
        $responseRoute = $this->getJson('/api/v1/invitations/tokens/' . $token);
        $responseRoute->assertStatus(200)
            ->assertJsonPath('valid', true)
            ->assertJsonPath('email', 'verify.user@acme.com');

        // Non existent token
        $this->getJson('/api/v1/invitations/verify?token=non_existent_token_1234567890')
            ->assertStatus(404);

        // Expired token
        $invitation->update(['expires_at' => Carbon::now()->subHour()]);
        $this->getJson('/api/v1/invitations/verify?token=' . $token)
            ->assertStatus(410);
    }

    public function test_public_accept_endpoint_activates_account_and_returns_bearer_token(): void
    {
        $token = 'accept_token_test_' . bin2hex(random_bytes(20));

        $invitation = Invitation::create([
            'email' => 'accept.cfo@acme.com',
            'role' => 'client',
            'company_id' => (string) $this->companyA->id,
            'token' => $token,
            'invited_by' => (string) $this->admin->id,
            'status' => 'pending',
            'expires_at' => Carbon::now()->addHours(48),
        ]);

        $response = $this->postJson('/api/v1/invitations/accept', [
            'token' => $token,
            'name' => 'Michał Aktywowany',
            'password' => 'SecurePass2026!#',
            'password_confirmation' => 'SecurePass2026!#',
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'message',
                'token',
                'token_type',
                'user' => ['id', 'name', 'email', 'role', 'company'],
                'available_companies',
            ])
            ->assertJsonPath('user.email', 'accept.cfo@acme.com')
            ->assertJsonPath('user.name', 'Michał Aktywowany')
            ->assertJsonPath('user.role', 'client');

        $createdUser = User::where('email', 'accept.cfo@acme.com')->first();
        $this->assertNotNull($createdUser);
        $this->assertTrue(Hash::check('SecurePass2026!#', $createdUser->password));

        // Authenticate with issued token
        $this->withHeader('Authorization', 'Bearer ' . $response->json('token'))
            ->getJson('/api/v1/auth/me')
            ->assertStatus(200)
            ->assertJsonPath('user.email', 'accept.cfo@acme.com');
    }

    public function test_resend_and_revoke_invitation_endpoints(): void
    {
        Sanctum::actingAs($this->admin);

        $token = 'resend_revoke_token_' . bin2hex(random_bytes(20));
        $invitation = Invitation::create([
            'email' => 'resend.user@acme.com',
            'role' => 'client',
            'company_id' => (string) $this->companyA->id,
            'token' => $token,
            'invited_by' => (string) $this->admin->id,
            'status' => 'pending',
            'expires_at' => Carbon::now()->addHours(1),
        ]);

        // Resend
        $resendResponse = $this->postJson("/api/v1/invitations/{$invitation->id}/resend");
        $resendResponse->assertStatus(200)
            ->assertJsonPath('message', 'Nowy link aktywacyjny został wysłany na podany adres email.');

        $invitation->refresh();
        $this->assertNotSame($token, $invitation->token);
        $this->assertTrue($invitation->expires_at->gt(Carbon::now()->addHours(40)));

        // Revoke
        $revokeResponse = $this->deleteJson("/api/v1/invitations/{$invitation->id}");
        $revokeResponse->assertStatus(200)
            ->assertJsonPath('message', 'Zaproszenie zostało pomyślnie unieważnione.');

        $invitation->refresh();
        $this->assertSame('revoked', $invitation->status);
    }
}
