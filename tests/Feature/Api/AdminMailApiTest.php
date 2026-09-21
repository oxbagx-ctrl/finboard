<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class AdminMailApiTest extends TestCase
{
    private User $adminUser;
    private User $superAdminUser;
    private User $clientUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->adminUser = new User([
            'name' => 'Admin User',
            'email' => 'admin@finboard.local',
            'role' => 'admin',
            'is_active' => true,
        ]);
        $this->adminUser->id = 1;

        $this->superAdminUser = new User([
            'name' => 'Super Admin User',
            'email' => 'superadmin@finboard.local',
            'role' => 'super_admin',
            'is_active' => true,
        ]);
        $this->superAdminUser->id = 2;

        $this->clientUser = new User([
            'name' => 'Client User',
            'email' => 'client@finboard.local',
            'role' => 'client',
            'is_active' => true,
        ]);
        $this->clientUser->id = 3;
    }

    public function test_unauthenticated_request_is_rejected_for_status_endpoint(): void
    {
        $response = $this->getJson('/api/v1/admin/mail/status');

        $response->assertStatus(401);
    }

    public function test_unauthenticated_request_is_rejected_for_test_endpoint(): void
    {
        $response = $this->postJson('/api/v1/admin/mail/test', [
            'recipient' => 'test@example.com',
        ]);

        $response->assertStatus(401);
    }

    public function test_client_role_is_forbidden_from_accessing_admin_mail_endpoints(): void
    {
        Sanctum::actingAs($this->clientUser);

        $statusResponse = $this->getJson('/api/v1/admin/mail/status');
        $statusResponse->assertStatus(403);

        $testResponse = $this->postJson('/api/v1/admin/mail/test', [
            'recipient' => 'test@example.com',
        ]);
        $testResponse->assertStatus(403);
    }

    public function test_inactive_admin_is_forbidden(): void
    {
        $inactiveAdmin = new User([
            'name' => 'Inactive Admin',
            'email' => 'inactive@finboard.local',
            'role' => 'admin',
            'is_active' => false,
        ]);
        $inactiveAdmin->id = 99;

        Sanctum::actingAs($inactiveAdmin);

        $response = $this->getJson('/api/v1/admin/mail/status');
        $response->assertStatus(403);
    }

    public function test_admin_can_retrieve_mail_status(): void
    {
        Config::set('mail.default', 'smtp');
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/v1/admin/mail/status?check_socket=0');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'status',
                'data' => [
                    'mailer',
                    'host',
                    'port',
                    'encryption',
                    'username',
                    'has_password',
                    'timeout',
                    'from_address',
                    'from_name',
                    'is_secure_port',
                    'is_port_25_warning',
                    'socket',
                ],
            ])
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.mailer', 'smtp');
    }

    public function test_admin_receives_validation_error_for_invalid_test_payload(): void
    {
        Sanctum::actingAs($this->adminUser);

        $responseEmpty = $this->postJson('/api/v1/admin/mail/test', []);
        $responseEmpty->assertStatus(422)
            ->assertJsonValidationErrors(['recipient']);

        $responseInvalid = $this->postJson('/api/v1/admin/mail/test', [
            'recipient' => 'not-an-email',
        ]);
        $responseInvalid->assertStatus(422)
            ->assertJsonValidationErrors(['recipient']);
    }

    public function test_admin_can_send_test_email_successfully_with_array_transport(): void
    {
        Sanctum::actingAs($this->adminUser);
        Mail::fake();

        $response = $this->postJson('/api/v1/admin/mail/test', [
            'recipient' => 'diagnostic@helvest.pl',
            'transport' => 'array',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'status',
                'latency_ms',
                'message',
                'recipient',
            ])
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('recipient', 'diagnostic@helvest.pl');
    }

    public function test_super_admin_can_use_alias_test_connection_endpoint(): void
    {
        Sanctum::actingAs($this->superAdminUser);
        Mail::fake();

        $response = $this->postJson('/api/v1/admin/mail/test-connection', [
            'recipient' => 'superadmin@helvest.pl',
            'transport' => 'array',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('recipient', 'superadmin@helvest.pl');
    }

    public function test_super_admin_can_retrieve_mail_status(): void
    {
        Sanctum::actingAs($this->superAdminUser);

        $response = $this->getJson('/api/v1/admin/mail/status?check_socket=0');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success');
    }

    public function test_status_endpoint_supports_custom_transport_query_param(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/v1/admin/mail/status?transport=log&check_socket=0');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.mailer', 'log');
    }

    public function test_status_endpoint_returns_socket_health_when_check_socket_is_enabled(): void
    {
        Sanctum::actingAs($this->adminUser);

        Config::set('mail.default', 'smtp');
        Config::set('mail.mailers.smtp.host', '127.0.0.1');
        Config::set('mail.mailers.smtp.port', 59998);
        Config::set('mail.mailers.smtp.timeout', 1);

        $response = $this->getJson('/api/v1/admin/mail/status?check_socket=1');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonStructure([
                'status',
                'data' => [
                    'socket' => [
                        'connected',
                        'latency_ms',
                        'error_code',
                        'error_message',
                    ],
                ],
            ])
            ->assertJsonPath('data.socket.connected', false);
    }

    public function test_admin_receives_error_response_when_smtp_fails(): void
    {
        Sanctum::actingAs($this->adminUser);

        // Force an invalid SMTP host that will fail
        Config::set('mail.mailers.smtp.host', '127.0.0.1');
        Config::set('mail.mailers.smtp.port', 59998);
        Config::set('mail.mailers.smtp.timeout', 1);

        $response = $this->postJson('/api/v1/admin/mail/test', [
            'recipient' => 'fail@finboard.local',
            'transport' => 'smtp',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'error')
            ->assertJsonPath('recipient', 'fail@finboard.local')
            ->assertJsonStructure(['status', 'latency_ms', 'message', 'recipient']);
    }
}
