<?php

declare(strict_types=1);

namespace Tests\Unit\Identity;

use App\Contexts\Identity\Domain\Entities\Role;
use App\Contexts\Identity\Domain\Exceptions\InvalidEmailException;
use App\Contexts\Identity\Domain\ValueObjects\Email;
use App\Contexts\Identity\Domain\ValueObjects\HashedPassword;
use App\Contexts\Identity\Domain\ValueObjects\RoleType;
use App\Contexts\Identity\Domain\ValueObjects\UserId;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

final class ValueObjectsTest extends TestCase
{
    // --- UserId Tests ---

    public function test_valid_user_id_can_be_generated_and_parsed(): void
    {
        $userId = UserId::generate();
        $this->assertNotEmpty($userId->value());

        $parsed = UserId::fromString($userId->value());
        $this->assertTrue($userId->equals($parsed));
        $this->assertSame($userId->value(), (string) $parsed);
    }

    public function test_invalid_uuid_throws_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('not a valid UUID');

        UserId::fromString('invalid-uuid-string');
    }

    // --- Email Tests ---

    public function test_valid_email_is_normalized(): void
    {
        $email = Email::fromString('  User.Test@Helvest.COM  ');

        $this->assertSame('user.test@helvest.com', $email->value());
        $this->assertSame('helvest.com', $email->domain());
        $this->assertSame('user.test@helvest.com', (string) $email);
    }

    public function test_invalid_email_throws_exception(): void
    {
        $this->expectException(InvalidEmailException::class);
        $this->expectExceptionMessage('is invalid');

        Email::fromString('not-an-email');
    }

    public function test_email_equality(): void
    {
        $email1 = Email::fromString('test@domain.com');
        $email2 = Email::fromString('TEST@DOMAIN.COM');
        $email3 = Email::fromString('other@domain.com');

        $this->assertTrue($email1->equals($email2));
        $this->assertFalse($email1->equals($email3));
    }

    // --- HashedPassword Tests ---

    public function test_hashed_password_creation_and_verification(): void
    {
        $plainText = 'P@ssword1234!';
        $hashed = HashedPassword::fromPlainText($plainText);

        $this->assertNotSame($plainText, $hashed->value());
        $this->assertTrue($hashed->verify($plainText));
        $this->assertFalse($hashed->verify('WrongPassword123!'));
    }

    public function test_password_shorter_than_8_chars_throws_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Password must be at least 8 characters long');

        HashedPassword::fromPlainText('short');
    }

    public function test_empty_hash_throws_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('cannot be empty');

        HashedPassword::fromHash('');
    }

    // --- Role Tests ---

    public function test_super_admin_role_properties_and_permissions(): void
    {
        $superAdmin = Role::superAdmin();

        $this->assertSame(RoleType::SUPER_ADMIN, $superAdmin->name());
        $this->assertTrue($superAdmin->isSuperAdmin());
        $this->assertTrue($superAdmin->isAdmin());
        $this->assertFalse($superAdmin->isAdvisor());
        $this->assertFalse($superAdmin->isClient());
        $this->assertTrue($superAdmin->can('manage_advisors'));
        $this->assertTrue($superAdmin->can('assign_advisors'));
        $this->assertTrue($superAdmin->can('view_all_companies'));
        $this->assertTrue($superAdmin->can('invite_users'));
    }

    public function test_advisor_role_properties_and_permissions(): void
    {
        $advisor = Role::advisor();

        $this->assertSame(RoleType::ADVISOR, $advisor->name());
        $this->assertTrue($advisor->isAdvisor());
        $this->assertFalse($advisor->isSuperAdmin());
        $this->assertFalse($advisor->isClient());
        $this->assertTrue($advisor->can('view_assigned_companies'));
        $this->assertTrue($advisor->can('manage_finances'));
        $this->assertTrue($advisor->can('invite_clients'));
        $this->assertFalse($advisor->can('manage_advisors'));
    }

    public function test_client_role_properties_and_permissions(): void
    {
        $client = Role::client();

        $this->assertSame(RoleType::CLIENT, $client->name());
        $this->assertTrue($client->isClient());
        $this->assertFalse($client->isAdvisor());
        $this->assertFalse($client->isSuperAdmin());
        $this->assertFalse($client->isAdmin());
        $this->assertTrue($client->can('view_kpi'));
        $this->assertTrue($client->can('download_documents'));
        $this->assertFalse($client->can('manage_finances'));
        $this->assertFalse($client->can('invite_clients'));
    }

    public function test_role_from_string_factory(): void
    {
        $superAdmin = Role::fromString('super_admin');
        $this->assertTrue($superAdmin->isSuperAdmin());

        $advisor = Role::fromString('advisor');
        $this->assertTrue($advisor->isAdvisor());

        $client = Role::fromString('client');
        $this->assertTrue($client->isClient());

        $admin = Role::fromString('admin');
        $this->assertTrue($admin->isAdmin());

        $this->expectException(InvalidArgumentException::class);
        Role::fromString('invalid_role');
    }

    public function test_role_properties_and_permissions_legacy(): void
    {
        $adminRole = Role::admin();
        $clientRole = Role::client();

        $this->assertSame(RoleType::ADMIN, $adminRole->name());
        $this->assertTrue($adminRole->isAdmin());
        $this->assertFalse($adminRole->isClient());
        $this->assertTrue($adminRole->can('manage_finances'));
        $this->assertTrue($adminRole->can('upload_financial_data'));

        $this->assertFalse($adminRole->equals($clientRole));
        $this->assertTrue($adminRole->equals(Role::admin()));
    }
}
