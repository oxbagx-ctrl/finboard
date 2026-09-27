<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Domain\ValueObjects;

use DateTimeImmutable;
use DateTimeInterface;

final readonly class WatermarkOptions
{
    /**
     * @param array{0: int, 1: int, 2: int} $colorRgb
     */
    public function __construct(
        public string $userName,
        public ?string $userEmail = null,
        public ?string $ipAddress = null,
        public ?DateTimeInterface $timestamp = null,
        public ?string $companyName = null,
        public ?string $customNotice = null,
        public float $alpha = 0.22,
        public int $fontSize = 14,
        public float $angle = 45.0,
        public array $colorRgb = [140, 140, 140],
        public bool $includeDiagonal = true,
        public bool $includeHeader = true,
        public bool $includeFooter = true,
        public bool $compress = true
    ) {
    }

    public static function create(
        string $userName,
        ?string $userEmail = null,
        ?string $ipAddress = null,
        ?DateTimeInterface $timestamp = null,
        ?string $companyName = null,
        ?string $customNotice = null,
        float $alpha = 0.22,
        int $fontSize = 14,
        float $angle = 45.0,
        array $colorRgb = [140, 140, 140],
        bool $includeDiagonal = true,
        bool $includeHeader = true,
        bool $includeFooter = true,
        bool $compress = true
    ): self {
        return new self(
            userName: $userName,
            userEmail: $userEmail,
            ipAddress: $ipAddress,
            timestamp: $timestamp ?? new DateTimeImmutable('now'),
            companyName: $companyName,
            customNotice: $customNotice,
            alpha: max(0.05, min(1.0, $alpha)),
            fontSize: max(8, min(36, $fontSize)),
            angle: $angle,
            colorRgb: $colorRgb,
            includeDiagonal: $includeDiagonal,
            includeHeader: $includeHeader,
            includeFooter: $includeFooter,
            compress: $compress
        );
    }

    /**
     * Formats the primary diagonal watermark text string.
     */
    public function diagonalText(): string
    {
        $notice = $this->customNotice ?? 'FINBOARD VDR - STRICTLY CONFIDENTIAL';
        $userPart = $this->userIdentifier();

        return sprintf('%s - %s', $notice, $userPart);
    }

    /**
     * Formats a secondary diagonal watermark line (timestamp and IP).
     */
    public function secondaryDiagonalText(): string
    {
        $timeStr = ($this->timestamp ?? new DateTimeImmutable('now'))->format('Y-m-d H:i:s T');
        $ipStr = $this->ipAddress ? sprintf(' - IP: %s', $this->ipAddress) : '';

        return sprintf('ACCESSED: %s%s - DO NOT DISTRIBUTE', $timeStr, $ipStr);
    }

    /**
     * Formats the running top header watermark line.
     */
    public function headerText(): string
    {
        $company = $this->companyName ? sprintf('%s | ', $this->companyName) : '';
        $timeStr = ($this->timestamp ?? new DateTimeImmutable('now'))->format('Y-m-d H:i:s T');

        return sprintf(
            'FINBOARD VDR | %sCONFIDENTIAL & PRIVILEGED | %s | %s',
            $company,
            $this->userIdentifier(),
            $timeStr
        );
    }

    /**
     * Formats the bottom footer watermark line.
     */
    public function footerText(int $currentPage, int $totalPages): string
    {
        $ipPart = $this->ipAddress ? sprintf(' | IP: %s', $this->ipAddress) : '';

        return sprintf(
            'AUTHORIZED USE ONLY | %s%s | Page %d of %d',
            $this->userIdentifier(),
            $ipPart,
            $currentPage,
            $totalPages
        );
    }

    public function userIdentifier(): string
    {
        if ($this->userEmail !== null && $this->userEmail !== '') {
            return sprintf('%s (%s)', $this->userName, $this->userEmail);
        }

        return $this->userName;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'user_name' => $this->userName,
            'user_email' => $this->userEmail,
            'ip_address' => $this->ipAddress,
            'timestamp' => ($this->timestamp ?? new DateTimeImmutable('now'))->format(DateTimeInterface::ATOM),
            'company_name' => $this->companyName,
            'custom_notice' => $this->customNotice,
            'alpha' => $this->alpha,
            'font_size' => $this->fontSize,
            'angle' => $this->angle,
            'color_rgb' => $this->colorRgb,
            'include_diagonal' => $this->includeDiagonal,
            'include_header' => $this->includeHeader,
            'include_footer' => $this->includeFooter,
        ];
    }
}
