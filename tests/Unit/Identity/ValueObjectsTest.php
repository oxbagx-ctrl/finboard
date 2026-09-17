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

    public function test_role_properties_and_permissions(): void
    {
        $adminRole = Role::admin();
        $clientRole = Role::client();

        $this->assertSame(RoleType::ADMIN, $adminRole->name());
        $this->assertTrue($adminRole->isAdmin());
        $this->assertFalse($adminRole->isClient());
        $this->assertTrue($adminRole->can('manage_finances'));
        $this->assertTrue($adminRole->can('upload_financial_data'));

        $this->assertSame(RoleType::CLIENT, $clientRole->name());
        $this->assertTrue($clientRole->isClient());
        $this->assertFalse($clientRole->isAdmin());
        $this->assertTrue($clientRole->can('view_kpi'));
        $this->assertFalse($clientRole->can('manage_finances'));

        $this->assertFalse($adminRole->equals($clientRole));
        $this->assertTrue($adminRole->equals(Role::admin()));
    }
}
