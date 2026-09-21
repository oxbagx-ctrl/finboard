<?php

declare(strict_types=1);

namespace Tests\Unit\Identity;

use App\Models\Invitation;
use App\Presentation\Api\Resources\InvitationResource;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Str;
use Tests\TestCase;

final class InvitationResourceTest extends TestCase
{
    public function test_pending_invitation_exposes_secure_activation_url(): void
    {
        Config::set('app.url', 'http://localhost:8080');

        $token = 'secure_invitation_token_12345';
        $invitation = new Invitation([
            'id' => (string) Str::uuid(),
            'email' => 'deal.client@targetcorp.com',
            'role' => 'client',
            'status' => 'pending',
            'token' => $token,
            'expires_at' => Carbon::now()->addDays(3),
        ]);

        $resource = new InvitationResource($invitation);
        $data = $resource->toArray(Request::create('/api/v1/invitations'));

        $this->assertTrue($data['is_pending']);
        $this->assertNotNull($data['activation_url']);
        $this->assertSame(
            'http://localhost:8080/invitation/accept?token=' . urlencode($token),
            $data['activation_url']
        );
        $this->assertArrayNotHasKey('token', $data, 'Raw token must not be directly exposed in resource array');
    }

    public function test_accepted_invitation_does_not_expose_activation_url(): void
    {
        $invitation = new Invitation([
            'id' => (string) Str::uuid(),
            'email' => 'client@acme.com',
            'role' => 'client',
            'status' => 'accepted',
            'token' => 'already_used_token_98765',
            'expires_at' => Carbon::now()->addDays(1),
            'accepted_at' => Carbon::now()->subHour(),
        ]);

        $resource = new InvitationResource($invitation);
        $data = $resource->toArray(Request::create('/api/v1/invitations'));

        $this->assertFalse($data['is_pending']);
        $this->assertTrue($data['is_accepted']);
        $this->assertNull($data['activation_url']);
    }

    public function test_revoked_invitation_does_not_expose_activation_url(): void
    {
        $invitation = new Invitation([
            'id' => (string) Str::uuid(),
            'email' => 'client@acme.com',
            'role' => 'client',
            'status' => 'revoked',
            'token' => 'revoked_token_555',
            'expires_at' => Carbon::now()->addDays(2),
            'revoked_at' => Carbon::now()->subMinute(),
        ]);

        $resource = new InvitationResource($invitation);
        $data = $resource->toArray(Request::create('/api/v1/invitations'));

        $this->assertFalse($data['is_pending']);
        $this->assertTrue($data['is_revoked']);
        $this->assertNull($data['activation_url']);
    }

    public function test_expired_invitation_does_not_expose_activation_url(): void
    {
        $invitation = new Invitation([
            'id' => (string) Str::uuid(),
            'email' => 'client@acme.com',
            'role' => 'client',
            'status' => 'pending',
            'token' => 'expired_token_111',
            'expires_at' => Carbon::now()->subDay(),
        ]);

        $resource = new InvitationResource($invitation);
        $data = $resource->toArray(Request::create('/api/v1/invitations'));

        $this->assertFalse($data['is_pending']);
        $this->assertTrue($data['is_expired']);
        $this->assertNull($data['activation_url']);
    }

    public function test_invitation_without_token_returns_null_activation_url(): void
    {
        $invitation = new Invitation([
            'id' => (string) Str::uuid(),
            'email' => 'client@acme.com',
            'role' => 'client',
            'status' => 'pending',
            'token' => null,
            'expires_at' => Carbon::now()->addDays(1),
        ]);

        $resource = new InvitationResource($invitation);
        $data = $resource->toArray(Request::create('/api/v1/invitations'));

        $this->assertNull($data['activation_url']);
    }

    public function test_activation_url_honors_configured_app_url(): void
    {
        Config::set('app.url', 'https://ethon.pl');

        $token = 'prod_token_xyz';
        $invitation = new Invitation([
            'id' => (string) Str::uuid(),
            'email' => 'cfo@helvest.pl',
            'role' => 'client',
            'status' => 'pending',
            'token' => $token,
            'expires_at' => Carbon::now()->addDays(2),
        ]);

        $resource = new InvitationResource($invitation);
        $data = $resource->toArray(Request::create('/api/v1/invitations'));

        $this->assertSame(
            'https://ethon.pl/invitation/accept?token=' . urlencode($token),
            $data['activation_url']
        );
    }
}
