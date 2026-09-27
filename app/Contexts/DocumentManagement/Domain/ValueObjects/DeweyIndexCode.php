<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Domain\ValueObjects;

use App\Shared\Domain\ValueObject;
use InvalidArgumentException;

final class DeweyIndexCode implements ValueObject
{
    private readonly string $value;

    private function __construct(string $rawCode)
    {
        $clean = trim($rawCode);
        if ($clean === '' || !preg_match('/^\d+(\.\d+)*$/', $clean)) {
            throw new InvalidArgumentException(sprintf('Invalid Dewey decimal index code: "%s". Expected format like "01.00", "02.01", "02.01.03".', $rawCode));
        }

        $normalized = self::normalize($clean);
        if (!self::isValid($normalized)) {
            throw new InvalidArgumentException(sprintf('Invalid Dewey decimal index code: "%s". Expected format like "01.00", "02.01", "02.01.03".', $rawCode));
        }

        $this->value = $normalized;
    }

    public static function fromString(string $code): self
    {
        return new self($code);
    }

    public static function fromSegments(int ...$segments): self
    {
        if (empty($segments)) {
            throw new InvalidArgumentException('DeweyIndexCode must have at least one numeric segment.');
        }

        $padded = array_map(fn (int $seg) => str_pad((string) max(0, $seg), 2, '0', STR_PAD_LEFT), $segments);

        if (count($padded) === 1) {
            $padded[] = '00';
        }

        return new self(implode('.', $padded));
    }

    public function value(): string
    {
        return $this->value;
    }

    /**
     * @return list<int>
     */
    public function segments(): array
    {
        return array_map('intval', explode('.', $this->value));
    }

    public function level(): int
    {
        $segments = explode('.', $this->value);
        if (count($segments) === 2 && $segments[1] === '00') {
            return 1;
        }

        return count($segments);
    }

    public function isRoot(): bool
    {
        return $this->level() === 1;
    }

    public function parentCode(): ?self
    {
        $parts = explode('.', $this->value);
        $count = count($parts);

        if ($count <= 2) {
            if ($parts[1] === '00') {
                return null;
            }
            return new self($parts[0] . '.00');
        }

        array_pop($parts);
        return new self(implode('.', $parts));
    }

    public function child(int $sequenceNumber): self
    {
        if ($sequenceNumber < 1) {
            throw new InvalidArgumentException('Child sequence number must be positive (>= 1).');
        }

        $paddedSeq = str_pad((string) $sequenceNumber, 2, '0', STR_PAD_LEFT);
        $parts = explode('.', $this->value);

        if (count($parts) === 2 && $parts[1] === '00') {
            return new self($parts[0] . '.' . $paddedSeq);
        }

        return new self($this->value . '.' . $paddedSeq);
    }

    public function isAncestorOf(self $other): bool
    {
        if ($this->equals($other)) {
            return false;
        }

        if ($this->isRoot()) {
            $myRoot = explode('.', $this->value)[0];
            $otherRoot = explode('.', $other->value)[0];
            return $myRoot === $otherRoot;
        }

        return str_starts_with($other->value, $this->value . '.');
    }

    public function compare(self $other): int
    {
        $mySegs = $this->segments();
        $otherSegs = $other->segments();

        $maxLen = max(count($mySegs), count($otherSegs));
        for ($i = 0; $i < $maxLen; $i++) {
            $a = $mySegs[$i] ?? -1;
            $b = $otherSegs[$i] ?? -1;

            if ($a !== $b) {
                return $a <=> $b;
            }
        }

        return 0;
    }

    public function equals(ValueObject $other): bool
    {
        return $other instanceof self && $this->value === $other->value;
    }

    public function __toString(): string
    {
        return $this->value;
    }

    public static function normalize(string $input): string
    {
        $clean = trim($input);
        if ($clean === '') {
            return '';
        }

        $parts = explode('.', $clean);
        $padded = array_map(function ($part) {
            $digits = preg_replace('/\D/', '', $part);
            return str_pad($digits !== '' ? $digits : '0', 2, '0', STR_PAD_LEFT);
        }, $parts);

        if (count($padded) === 1) {
            $padded[] = '00';
        }

        return implode('.', $padded);
    }

    public static function isValid(string $normalized): bool
    {
        return (bool) preg_match('/^\d{2}(\.\d{2})+$/', $normalized);
    }
}
