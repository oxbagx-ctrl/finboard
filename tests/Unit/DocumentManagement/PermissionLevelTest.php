<?php

declare(strict_types=1);

namespace Tests\Unit\DocumentManagement;

use App\Contexts\DocumentManagement\Domain\ValueObjects\AccessSubject;
use App\Contexts\DocumentManagement\Domain\ValueObjects\EffectivePermission;
use App\Contexts\DocumentManagement\Domain\ValueObjects\PermissionLevel;
use App\Contexts\DocumentManagement\Domain\ValueObjects\VdrPermissionId;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

final class PermissionLevelTest extends TestCase
{
    public function test_permission_level_priorities_and_capabilities(): void
    {
        $none = PermissionLevel::NONE;
        $view = PermissionLevel::VIEW;
        $download = PermissionLevel::DOWNLOAD;
        $manage = PermissionLevel::MANAGE;

        $this->assertSame(0, $none->priority());
        $this->assertSame(10, $view->priority());
        $this->assertSame(20, $download->priority());
        $this->assertSame(30, $manage->priority());

        $this->assertTrue($none->isNone());
        $this->assertFalse($none->canView());
        $this->assertFalse($none->canDownload());
        $this->assertFalse($none->canManage());

        $this->assertFalse($view->isNone());
        $this->assertTrue($view->canView());
        $this->assertFalse($view->canDownload());
        $this->assertFalse($view->canManage());

        $this->assertTrue($download->canView());
        $this->assertTrue($download->canDownload());
        $this->assertFalse($download->canManage());

        $this->assertTrue($manage->canView());
        $this->assertTrue($manage->canDownload());
        $this->assertTrue($manage->canManage());
    }

    public function test_from_string_factory(): void
    {
        $this->assertSame(PermissionLevel::NONE, PermissionLevel::fromString('none'));
        $this->assertSame(PermissionLevel::NONE, PermissionLevel::fromString('no_access'));
        $this->assertSame(PermissionLevel::VIEW, PermissionLevel::fromString('view'));
        $this->assertSame(PermissionLevel::VIEW, PermissionLevel::fromString('preview'));
        $this->assertSame(PermissionLevel::DOWNLOAD, PermissionLevel::fromString('download'));
        $this->assertSame(PermissionLevel::MANAGE, PermissionLevel::fromString('manage'));
        $this->assertSame(PermissionLevel::MANAGE, PermissionLevel::fromString('full'));
    }

    public function test_invalid_permission_level_throws_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);
        PermissionLevel::fromString('super_power');
    }

    public function test_access_subject_roles_and_users(): void
    {
        $roleSubj = AccessSubject::forRole('client');
        $this->assertTrue($roleSubj->isRole());
        $this->assertFalse($roleSubj->isUser());
        $this->assertSame('role:client', $roleSubj->identifier());
        $this->assertTrue($roleSubj->matchesRole('client'));
        $this->assertFalse($roleSubj->matchesRole('advisor'));

        $userSubj = AccessSubject::forUser('usr-uuid-123');
        $this->assertTrue($userSubj->isUser());
        $this->assertFalse($userSubj->isRole());
        $this->assertSame('user:usr-uuid-123', $userSubj->identifier());
        $this->assertTrue($userSubj->matchesUser('usr-uuid-123'));
        $this->assertFalse($userSubj->matchesUser('usr-uuid-999'));

        $this->assertTrue($roleSubj->equals(AccessSubject::fromTypeAndId('role', 'client')));
        $this->assertFalse($roleSubj->equals($userSubj));
    }

    public function test_vdr_permission_id_generation_and_validation(): void
    {
        $id = VdrPermissionId::generate();
        $this->assertNotEmpty($id->value());
        $this->assertTrue($id->equals(VdrPermissionId::fromString($id->value())));

        $this->expectException(InvalidArgumentException::class);
        VdrPermissionId::fromString('not-a-valid-uuid');
    }

    public function test_effective_permission_value_object(): void
    {
        $super = EffectivePermission::superAdmin();
        $this->assertSame('super_admin', $super->source());
        $this->assertTrue($super->canManage());
        $this->assertFalse($super->watermarkRequired());

        $none = EffectivePermission::none();
        $this->assertTrue($none->isNone());
        $this->assertFalse($none->canView());

        $arr = $super->toArray();
        $this->assertSame('manage', $arr['level']);
        $this->assertTrue($arr['can_manage']);
    }
}
