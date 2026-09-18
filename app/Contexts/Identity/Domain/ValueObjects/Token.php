<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Domain\ValueObjects;

use App\Contexts\Identity\Domain\Exceptions\InvalidInvitationTokenException;
use App\Shared\Domain\ValueObject;
use DateTimeImmutable;

final class Token implements ValueObject
{
    public const DEFAULT_VALIDITY_HOURS = 48;
    public const MINIMUM_LENGTH = 32;

    private string $value;
    private DateTimeImmutable $expiresAt;

    public function __construct(string $value, DateTimeImmutable $expiresAt)
    {
        $trimmed = trim($value);

        if (strlen($trimmed) < self::MINIMUM_LENGTH) {
            throw InvalidInvitationTokenException::tooShort(self::MINIMUM_LENGTH);
        }

        if (!preg_match('/^[a-zA-Z0-9_\-]+$/', $trimmed)) {
            throw InvalidInvitationTokenException::invalidFormat();
        }

        $this->value = $trimmed;
        $this->expiresAt = $expiresAt;
    }

    /**
     * Generate a new cryptographically secure random token with configured expiration.
     */
    public static function generate(int $validityHours = self::DEFAULT_VALIDITY_HOURS, ?DateTimeImmutable $now = null): self
    {
        $currentTime = $now ?? new DateTimeImmutable();
        $randomValue = bin2hex(random_bytes(32)); // 64-character hexadecimal token
        $expiresAt = $currentTime->modify(sprintf('+%d hours', $validityHours));

        return new self($randomValue, $expiresAt);
    }

    public static function fromString(string $value, DateTimeImmutable $expiresAt): self
    {
        return new self($value, $expiresAt);
    }

    public function value(): string
    {
        return $this->value;
    }

    public function expiresAt(): DateTimeImmutable
    {
        return $this->expiresAt;
    }

    /**
     * Check whether the token has expired against current or specified reference time.
     */
    public function isExpired(?DateTimeImmutable $now = null): bool
    {
        $reference = $now ?? new DateTimeImmutable();

        return $reference >= $this->expiresAt;
    }

    /**
     * Check whether the token is still active and valid.
     */
    public function isValid(?DateTimeImmutable $now = null): bool
    {
        return !$this->isExpired($now);
    }

    /**
     * Get remaining validity time in seconds.
     */
    public function timeRemainingInSeconds(?DateTimeImmutable $now = null): int
    {
        $reference = $now ?? new DateTimeImmutable();

        return max(0, $this->expiresAt->getTimestamp() - $reference->getTimestamp());
    }

    /**
     * Get remaining validity time in full hours.
     */
    public function timeRemainingInHours(?DateTimeImmutable $now = null): int
    {
        return intdiv($this->timeRemainingInSeconds($now), 3600);
    }

    /**
     * Compute SHA-256 cryptographic hash of the token.
     */
    public function hash(): string
    {
        return hash('sha256', $this->value);
    }

    /**
     * Constant-time verification of a raw token string against this token.
     */
    public function matches(string $plainToken): bool
    {
        return hash_equals($this->value, trim($plainToken));
    }

    /**
     * Constant-time verification of a raw SHA-256 hash.
     */
    public function matchesHash(string $hash): bool
    {
        return hash_equals($this->hash(), strtolower(trim($hash)));
    }

    public function __toString(): string
    {
        return $this->value;
    }

    public function equals(ValueObject $other): bool
    {
        return $other instanceof self
            && hash_equals($this->value, $other->value)
            && $this->expiresAt->getTimestamp() === $other->expiresAt->getTimestamp();
    }
}
