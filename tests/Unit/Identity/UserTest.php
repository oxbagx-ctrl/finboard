<?php

declare(strict_types=1);

namespace Tests\Unit\Identity;

use App\Contexts\Identity\Domain\Entities\Role;
use App\Contexts\Identity\Domain\Events\UserRegistered;
use App\Contexts\Identity\Domain\Events\UserRoleAssigned;
use App\Contexts\Identity\Domain\Model\User;
use App\Contexts\Identity\Domain\ValueObjects\Email;
use App\Contexts\Identity\Domain\ValueObjects\HashedPassword;
use App\Contexts\Identity\Domain\ValueObjects\UserId;
use DomainException;
use PHPUnit\Framework\TestCase;

final class UserTest extends TestCase
{
    private const COMPANY_A = '11111111-1111-1111-1111-111111111111';
    private const COMPANY_B = '22222222-2222-2222-2222-222222222222';

    public function test_user_can_be_registered_and_records_domain_event(): void
    {
        $userId = UserId::generate();
        $email = Email::fromString('cfo@acme.com');
        $password = HashedPassword::fromPlainText('SecurePass123!');
        $role = Role::client();

        $user = User::register(
            id: $userId,
            name: 'Jan Kowalski',
            email: $email,
            password: $password,
            role: $role,
            companyId: self::COMPANY_A
        );

        $this->assertSame($userId->value(), $user->id());
        $this->assertSame('Jan Kowalski', $user->name());
        $this->assertTrue($user->email()->equals($email));
        $this->assertTrue($user->password()->verify('SecurePass123!'));
        $this->assertTrue($user->isClient());
        $this->assertFalse($user->isAdmin());
        $this->assertFalse($user->isAdvisor());
        $this->assertFalse($user->isSuperAdmin());
        $this->assertSame(self::COMPANY_A, $user->companyId());
        $this->assertTrue($user->isActive());
        $this->assertTrue($user->hasEvents());

        $events = $user->releaseEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(UserRegistered::class, $events[0]);
        $this->assertSame($userId->value(), $events[0]->aggregateId());
        $this->assertSame('cfo@acme.com', $events[0]->email());
        $this->assertSame('client', $events[0]->role());
        $this->assertSame(self::COMPANY_A, $events[0]->companyId());

        // Events buffer should now be cleared
        $this->assertFalse($user->hasEvents());
        $this->assertEmpty($user->releaseEvents());
    }

    public function test_super_admin_and_advisor_registration_and_predicates(): void
    {
        $superAdmin = User::register(
            id: UserId::generate(),
            name: 'Partner Zarządzający',
            email: Email::fromString('partner@helvest.com'),
            password: HashedPassword::fromPlainText('SuperSecret123!'),
            role: Role::superAdmin(),
            companyId: null
        );

        $this->assertTrue($superAdmin->isSuperAdmin());
        $this->assertTrue($superAdmin->isAdmin());
        $this->assertFalse($superAdmin->isAdvisor());
        $this->assertFalse($superAdmin->isClient());
        $this->assertTrue($superAdmin->can('manage_advisors'));
        $this->assertTrue($superAdmin->can('assign_advisors'));

        $advisor = User::register(
            id: UserId::generate(),
            name: 'Doradca M&A',
            email: Email::fromString('advisor@helvest.com'),
            password: HashedPassword::fromPlainText('AdvisorPass123!'),
            role: Role::advisor(),
            companyId: null
        );

        $this->assertTrue($advisor->isAdvisor());
        $this->assertFalse($advisor->isSuperAdmin());
        $this->assertFalse($advisor->isClient());
        $this->assertTrue($advisor->can('view_assigned_companies'));
        $this->assertTrue($advisor->can('invite_clients'));
        $this->assertFalse($advisor->can('manage_advisors'));
    }

    public function test_user_role_can_be_changed_and_records_event(): void
    {
        $user = $this->createClientUser();

        $this->assertTrue($user->isClient());
        $this->assertFalse($user->isAdmin());

        $user->changeRole(Role::superAdmin());

        $this->assertTrue($user->isSuperAdmin());
        $this->assertTrue($user->isAdmin());
        $this->assertFalse($user->isClient());

        $events = $user->releaseEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(UserRoleAssigned::class, $events[0]);
        $this->assertSame('client', $events[0]->previousRole());
        $this->assertSame('super_admin', $events[0]->newRole());
    }

    public function test_changing_to_same_role_does_not_record_event(): void
    {
        $user = $this->createClientUser();

        $user->changeRole(Role::client());

        $this->assertFalse($user->hasEvents());
    }

    public function test_user_can_change_password(): void
    {
        $user = $this->createClientUser();

        $newPassword = HashedPassword::fromPlainText('BrandNewPassword456!');
        $user->changePassword($newPassword);

        $this->assertTrue($user->password()->verify('BrandNewPassword456!'));
        $this->assertFalse($user->password()->verify('OldPassword123!'));
    }

    public function test_user_profile_can_be_updated(): void
    {
        $user = $this->createClientUser();

        $user->updateProfile('Piotr Nowak', Email::fromString('piotr.nowak@acme.com'));

        $this->assertSame('Piotr Nowak', $user->name());
        $this->assertSame('piotr.nowak@acme.com', $user->email()->value());
    }

    public function test_user_deactivation_and_activation_lifecycle(): void
    {
        $user = $this->createClientUser();
        $this->assertTrue($user->isActive());

        $user->deactivate();
        $this->assertFalse($user->isActive());

        $user->activate();
        $this->assertTrue($user->isActive());
    }

    public function test_cannot_deactivate_already_inactive_user(): void
    {
        $user = $this->createClientUser();
        $user->deactivate();

        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('User is already inactive.');

        $user->deactivate();
    }

    public function test_cannot_activate_already_active_user(): void
    {
        $user = $this->createClientUser();

        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('User is already active.');

        $user->activate();
    }

    public function test_permission_verification(): void
    {
        $client = $this->createClientUser();
        $this->assertTrue($client->can('view_kpi'));
        $this->assertTrue($client->can('download_documents'));
        $this->assertFalse($client->can('manage_finances'));
        $this->assertFalse($client->can('upload_financial_data'));

        $admin = $this->createAdminUser();
        $this->assertTrue($admin->can('manage_finances'));
        $this->assertTrue($admin->can('upload_financial_data'));
        $this->assertTrue($admin->can('view_kpi'));

        // Inactive users have no active permissions
        $client->deactivate();
        $this->assertFalse($client->can('view_kpi'));
    }

    public function test_multi_tenant_company_access_control(): void
    {
        $client = $this->createClientUser(self::COMPANY_A);

        // Client can access their assigned company
        $this->assertTrue($client->canAccessCompany(self::COMPANY_A));

        // Client CANNOT access another company's data
        $this->assertFalse($client->canAccessCompany(self::COMPANY_B));

        // Inactive client cannot access even their own company
        $client->deactivate();
        $this->assertFalse($client->canAccessCompany(self::COMPANY_A));

        // Admin has global multi-tenant access across any company
        $admin = $this->createAdminUser();
        $this->assertTrue($admin->canAccessCompany(self::COMPANY_A));
        $this->assertTrue($admin->canAccessCompany(self::COMPANY_B));
        $this->assertTrue($admin->canAccessCompany('any-random-company-uuid'));

        $admin->deactivate();
        $this->assertFalse($admin->canAccessCompany(self::COMPANY_A));
    }

    private function createClientUser(string $companyId = self::COMPANY_A): User
    {
        $user = User::register(
            id: UserId::generate(),
            name: 'Klient Testowy',
            email: Email::fromString('test@client.com'),
            password: HashedPassword::fromPlainText('OldPassword123!'),
            role: Role::client(),
            companyId: $companyId
        );

        $user->releaseEvents(); // clear initial register event

        return $user;
    }

    private function createAdminUser(): User
    {
        $user = User::register(
            id: UserId::generate(),
            name: 'Admin Testowy',
            email: Email::fromString('test@admin.com'),
            password: HashedPassword::fromPlainText('AdminPassword123!'),
            role: Role::admin(),
            companyId: null
        );

        $user->releaseEvents(); // clear initial register event

        return $user;
    }
}
