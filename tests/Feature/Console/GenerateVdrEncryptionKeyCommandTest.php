<?php

declare(strict_types=1);

namespace Tests\Feature\Console;

use Illuminate\Support\Facades\File;
use Tests\TestCase;

final class GenerateVdrEncryptionKeyCommandTest extends TestCase
{
    private string $tempEnvPath;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tempEnvPath = base_path('.env.testing.vdr_test');
        File::put($this->tempEnvPath, "APP_NAME=FinBoard\nVDR_ENCRYPTION_KEY=\n");
        $this->app->useEnvironmentPath(base_path());
        $this->app->loadEnvironmentFrom('.env.testing.vdr_test');
    }

    protected function tearDown(): void
    {
        if (File::exists($this->tempEnvPath)) {
            File::delete($this->tempEnvPath);
        }

        parent::tearDown();
    }

    public function test_vdr_key_generate_show_displays_key_without_modifying_env(): void
    {
        $initialContent = File::get($this->tempEnvPath);

        $this->artisan('vdr:key-generate', ['--show' => true])
            ->expectsOutputToContain('base64:')
            ->assertExitCode(0);

        $this->assertSame($initialContent, File::get($this->tempEnvPath));
    }

    public function test_vdr_key_generate_updates_env_file(): void
    {
        $this->artisan('vdr:key-generate')
            ->assertExitCode(0);

        $updatedContent = File::get($this->tempEnvPath);
        $this->assertMatchesRegularExpression('/^VDR_ENCRYPTION_KEY=base64:[A-Za-z0-9+\/]+=*$/m', $updatedContent);
    }
}
