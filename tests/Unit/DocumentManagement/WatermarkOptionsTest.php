<?php

declare(strict_types=1);

namespace Tests\Unit\DocumentManagement;

use App\Contexts\DocumentManagement\Domain\ValueObjects\WatermarkOptions;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;

final class WatermarkOptionsTest extends TestCase
{
    public function test_create_with_defaults(): void
    {
        $timestamp = new DateTimeImmutable('2026-09-27 12:00:00 UTC');
        $options = WatermarkOptions::create(
            userName: 'Jan Kowalski',
            userEmail: 'cfo@acme.com',
            ipAddress: '192.168.1.50',
            timestamp: $timestamp,
            companyName: 'Acme Corp'
        );

        $this->assertSame('Jan Kowalski', $options->userName);
        $this->assertSame('cfo@acme.com', $options->userEmail);
        $this->assertSame('192.168.1.50', $options->ipAddress);
        $this->assertSame('Jan Kowalski (cfo@acme.com)', $options->userIdentifier());
        $this->assertEquals(0.22, $options->alpha);
        $this->assertSame(14, $options->fontSize);
        $this->assertEquals(45.0, $options->angle);
        $this->assertTrue($options->includeDiagonal);
        $this->assertTrue($options->includeHeader);
        $this->assertTrue($options->includeFooter);
    }

    public function test_alpha_and_font_size_clamping(): void
    {
        $tooSmall = WatermarkOptions::create(
            userName: 'Test',
            alpha: 0.001,
            fontSize: 2
        );
        $this->assertEquals(0.05, $tooSmall->alpha);
        $this->assertSame(8, $tooSmall->fontSize);

        $tooLarge = WatermarkOptions::create(
            userName: 'Test',
            alpha: 1.5,
            fontSize: 100
        );
        $this->assertEquals(1.0, $tooLarge->alpha);
        $this->assertSame(36, $tooLarge->fontSize);
    }

    public function test_diagonal_text_formats(): void
    {
        $options = WatermarkOptions::create(
            userName: 'M&A Advisor',
            userEmail: 'advisor@helvest.pl',
            customNotice: 'CONFIDENTIAL DEAL ROOM'
        );

        $this->assertSame(
            'CONFIDENTIAL DEAL ROOM - M&A Advisor (advisor@helvest.pl)',
            $options->diagonalText()
        );

        $timestamp = new DateTimeImmutable('2026-09-27 15:30:00 UTC');
        $timeOptions = WatermarkOptions::create(
            userName: 'M&A Advisor',
            ipAddress: '10.0.0.1',
            timestamp: $timestamp
        );

        $this->assertStringContainsString('ACCESSED: 2026-09-27 15:30:00 UTC - IP: 10.0.0.1', $timeOptions->secondaryDiagonalText());
    }

    public function test_header_and_footer_text_formatting(): void
    {
        $timestamp = new DateTimeImmutable('2026-09-27 15:30:00 UTC');
        $options = WatermarkOptions::create(
            userName: 'Audit Lead',
            userEmail: 'auditor@kpmg.com',
            ipAddress: '89.10.20.30',
            timestamp: $timestamp,
            companyName: 'Helvest Portfolio'
        );

        $header = $options->headerText();
        $this->assertStringContainsString('Helvest Portfolio', $header);
        $this->assertStringContainsString('Audit Lead (auditor@kpmg.com)', $header);
        $this->assertStringContainsString('2026-09-27 15:30:00 UTC', $header);

        $footer = $options->footerText(1, 5);
        $this->assertStringContainsString('Audit Lead (auditor@kpmg.com)', $footer);
        $this->assertStringContainsString('IP: 89.10.20.30', $footer);
        $this->assertStringContainsString('Page 1 of 5', $footer);
    }

    public function test_to_array_serialization(): void
    {
        $options = WatermarkOptions::create(
            userName: 'Test User',
            userEmail: 'test@example.com'
        );

        $array = $options->toArray();
        $this->assertSame('Test User', $array['user_name']);
        $this->assertSame('test@example.com', $array['user_email']);
        $this->assertArrayHasKey('timestamp', $array);
        $this->assertArrayHasKey('alpha', $array);
        $this->assertArrayHasKey('color_rgb', $array);
    }
}
