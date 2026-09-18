<?php

declare(strict_types=1);

namespace Tests\Unit\Identity;

use App\Contexts\Identity\Domain\Exceptions\InvalidInvitationTokenException;
use App\Contexts\Identity\Domain\ValueObjects\Token;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;

final class TokenTest extends TestCase
{
    public function test_token_can_be_generated_with_default_48h_expiration(): void
    {
        $now = new DateTimeImmutable('2026-06-01 12:00:00');
        $token = Token::generate(Token::DEFAULT_VALIDITY_HOURS, $now);

        $this->assertSame(64, strlen($token->value()));
        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $token->value());
        $this->assertSame('2026-06-03 12:00:00', $token->expiresAt()->format('Y-m-d H:i:s'));
        $this->assertTrue($token->isValid($now));
        $this->assertFalse($token->isExpired($now));
        $this->assertSame(48, $token->timeRemainingInHours($now));
        $this->assertSame(48 * 3600, $token->timeRemainingInSeconds($now));
    }

    public function test_token_expiration_logic(): void
    {
        $creationTime = new DateTimeImmutable('2026-06-01 12:00:00');
        $token = Token::generate(24, $creationTime);

        // Before expiration: valid
        $duringTime = new DateTimeImmutable('2026-06-02 11:59:59');
        $this->assertTrue($token->isValid($duringTime));
        $this->assertFalse($token->isExpired($duringTime));
        $this->assertSame(1, $token->timeRemainingInSeconds($duringTime));

        // Exactly at expiration: expired
        $atExpiry = new DateTimeImmutable('2026-06-02 12:00:00');
        $this->assertFalse($token->isValid($atExpiry));
        $this->assertTrue($token->isExpired($atExpiry));
        $this->assertSame(0, $token->timeRemainingInSeconds($atExpiry));
        $this->assertSame(0, $token->timeRemainingInHours($atExpiry));

        // After expiration: expired
        $afterExpiry = new DateTimeImmutable('2026-06-02 13:00:00');
        $this->assertFalse($token->isValid($afterExpiry));
        $this->assertTrue($token->isExpired($afterExpiry));
        $this->assertSame(0, $token->timeRemainingInSeconds($afterExpiry));
    }

    public function test_token_hash_and_matching(): void
    {
        $now = new DateTimeImmutable('2026-06-01 12:00:00');
        $token = Token::generate(48, $now);

        $plainValue = $token->value();
        $expectedHash = hash('sha256', $plainValue);

        $this->assertSame($expectedHash, $token->hash());
        $this->assertTrue($token->matches($plainValue));
        $this->assertTrue($token->matches("  {$plainValue}  ")); // trimmed matching
        $this->assertFalse($token->matches('wrong_token_value_that_does_not_match_at_all_12345678'));

        $this->assertTrue($token->matchesHash($expectedHash));
        $this->assertFalse($token->matchesHash('wrong_hash_value_1234567890abcdef'));
    }

    public function test_token_validation_rejects_too_short_strings(): void
    {
        $this->expectException(InvalidInvitationTokenException::class);
        $this->expectExceptionMessage('co najmniej 32 znaków');

        new Token('short_token_123', new DateTimeImmutable('+24 hours'));
    }

    public function test_token_validation_rejects_invalid_characters(): void
    {
        $this->expectException(InvalidInvitationTokenException::class);
        $this->expectExceptionMessage('Format tokenu zaproszenia jest nieprawidłowy');

        new Token('this_token_is_long_enough_but_has_invalid_symbols_$$$$@@@@', new DateTimeImmutable('+24 hours'));
    }

    public function test_token_equality(): void
    {
        $expiresAt = new DateTimeImmutable('2026-06-03 12:00:00');
        $raw = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

        $token1 = Token::fromString($raw, $expiresAt);
        $token2 = Token::fromString($raw, $expiresAt);
        $token3 = Token::fromString('b1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90', $expiresAt);

        $this->assertTrue($token1->equals($token2));
        $this->assertFalse($token1->equals($token3));
        $this->assertSame($raw, (string) $token1);
    }
}
