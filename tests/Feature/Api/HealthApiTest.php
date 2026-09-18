<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use Tests\TestCase;

final class HealthApiTest extends TestCase
{
    public function test_health_check_returns_healthy_status_and_system_metrics(): void
    {
        $response = $this->getJson('/api/v1/health');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'status',
                'timestamp',
                'platform',
                'environment',
                'php_version',
                'services' => [
                    'database' => ['status'],
                    'storage' => ['status', 'disk'],
                ],
                'memory_usage',
            ])
            ->assertJsonPath('status', 'healthy')
            ->assertJsonPath('platform', 'FinBoard Enterprise Financial Platform');
    }
}
