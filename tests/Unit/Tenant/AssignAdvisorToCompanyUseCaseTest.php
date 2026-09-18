<?php

declare(strict_types=1);

namespace Tests\Unit\Tenant;

use App\Contexts\Identity\Domain\Entities\Role;
use App\Contexts\Identity\Domain\Model\User;
use App\Contexts\Identity\Domain\Repositories\UserRepositoryInterface;
use App\Contexts\Identity\Domain\ValueObjects\Email;
use App\Contexts\Identity\Domain\ValueObjects\HashedPassword;
use App\Contexts\Identity\Domain\ValueObjects\UserId;
use App\Contexts\Tenant\Application\Commands\AssignAdvisorToCompanyCommand;
use App\Contexts\Tenant\Application\Commands\RevokeAdvisorFromCompanyCommand;
use App\Contexts\Tenant\Application\Exceptions\AdvisorNotFoundException;
use App\Contexts\Tenant\Application\Exceptions\CompanyNotFoundException;
use App\Contexts\Tenant\Application\Exceptions\TargetUserNotAdvisorException;
use App\Contexts\Tenant\Application\Exceptions\UnauthorizedAssignmentException;
use App\Contexts\Tenant\Application\UseCases\AssignAdvisorToCompanyUseCase;
use App\Contexts\Tenant\Application\UseCases\RevokeAdvisorFromCompanyUseCase;
use App\Contexts\Tenant\Domain\Entities\CompanyAdvisorAssignment;
use App\Contexts\Tenant\Domain\Repositories\CompanyAdvisorRepositoryInterface;
use App\Contexts\Tenant\Domain\Repositories\CompanyRepositoryInterface;
use App\Contexts\Tenant\Domain\ValueObjects\CompanyId;
use DomainException;
use PHPUnit\Framework\TestCase;

final class AssignAdvisorToCompanyUseCaseTest extends TestCase
{
    private CompanyAdvisorRepositoryInterface $advisorRepoMock;
    private UserRepositoryInterface $userRepoMock;
    private CompanyRepositoryInterface $companyRepoMock;

    private AssignAdvisorToCompanyUseCase $assignUseCase;
    private RevokeAdvisorFromCompanyUseCase $revokeUseCase;

    private User $superAdmin;
    private User $advisor;
    private User $client;
    private string $companyId = '11111111-1111-1111-1111-111111111111';

    protected function setUp(): void
    {
        parent::setUp();

        $this->advisorRepoMock = $this->createMock(CompanyAdvisorRepositoryInterface::class);
        $this->userRepoMock = $this->createMock(UserRepositoryInterface::class);
        $this->companyRepoMock = $this->createMock(CompanyRepositoryInterface::class);

        $this->assignUseCase = new AssignAdvisorToCompanyUseCase(
            $this->advisorRepoMock,
            $this->userRepoMock,
            $this->companyRepoMock
        );

        $this->revokeUseCase = new RevokeAdvisorFromCompanyUseCase(
            $this->advisorRepoMock,
            $this->userRepoMock
        );

        $this->superAdmin = User::register(
            UserId::fromString('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
            'Partner Admin',
            Email::fromString('partner@helvest.com'),
            HashedPassword::fromPlainText('ValidPassword123!'),
            Role::superAdmin()
        );

        $this->advisor = User::register(
            UserId::fromString('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
            'Senior Advisor',
            Email::fromString('advisor@helvest.com'),
            HashedPassword::fromPlainText('ValidPassword123!'),
            Role::advisor()
        );

        $this->client = User::register(
            UserId::fromString('cccccccc-cccc-cccc-cccc-cccccccccccc'),
            'Client User',
            Email::fromString('cfo@acme.com'),
            HashedPassword::fromPlainText('ValidPassword123!'),
            Role::client()
        );
    }

    public function test_superadmin_can_successfully_assign_advisor_to_company(): void
    {
        $command = new AssignAdvisorToCompanyCommand(
            companyId: $this->companyId,
            advisorId: $this->advisor->id(),
            assignedById: $this->superAdmin->id()
        );

        $this->userRepoMock->method('findById')
            ->willReturnCallback(fn (UserId $id) => match ($id->value()) {
                $this->superAdmin->id() => $this->superAdmin,
                $this->advisor->id() => $this->advisor,
                default => null,
            });

        $this->companyRepoMock->method('exists')
            ->with($this->callback(fn (CompanyId $id) => $id->value() === $this->companyId))
            ->willReturn(true);

        $this->advisorRepoMock->expects($this->once())
            ->method('assign')
            ->with($this->callback(function (CompanyAdvisorAssignment $assignment) {
                return $assignment->companyId()->value() === $this->companyId
                    && $assignment->advisorId()->value() === $this->advisor->id()
                    && $assignment->assignedBy()?->value() === $this->superAdmin->id();
            }));

        $result = $this->assignUseCase->execute($command);

        $this->assertSame($this->companyId, $result->companyId()->value());
        $this->assertSame($this->advisor->id(), $result->advisorId()->value());
    }

    public function test_client_cannot_assign_advisors(): void
    {
        $command = new AssignAdvisorToCompanyCommand(
            companyId: $this->companyId,
            advisorId: $this->advisor->id(),
            assignedById: $this->client->id()
        );

        $this->userRepoMock->method('findById')
            ->with($this->callback(fn (UserId $id) => $id->value() === $this->client->id()))
            ->willReturn($this->client);

        $this->expectException(UnauthorizedAssignmentException::class);

        $this->assignUseCase->execute($command);
    }

    public function test_inactive_actor_is_rejected(): void
    {
        $this->superAdmin->deactivate();

        $command = new AssignAdvisorToCompanyCommand(
            companyId: $this->companyId,
            advisorId: $this->advisor->id(),
            assignedById: $this->superAdmin->id()
        );

        $this->userRepoMock->method('findById')->willReturn($this->superAdmin);

        $this->expectException(UnauthorizedAssignmentException::class);

        $this->assignUseCase->execute($command);
    }

    public function test_assign_fails_when_company_not_found(): void
    {
        $command = new AssignAdvisorToCompanyCommand(
            companyId: $this->companyId,
            advisorId: $this->advisor->id(),
            assignedById: $this->superAdmin->id()
        );

        $this->userRepoMock->method('findById')->willReturn($this->superAdmin);
        $this->companyRepoMock->method('exists')->willReturn(false);

        $this->expectException(CompanyNotFoundException::class);

        $this->assignUseCase->execute($command);
    }

    public function test_assign_fails_when_advisor_user_not_found(): void
    {
        $command = new AssignAdvisorToCompanyCommand(
            companyId: $this->companyId,
            advisorId: '99999999-9999-9999-9999-999999999999',
            assignedById: $this->superAdmin->id()
        );

        $this->userRepoMock->method('findById')
            ->willReturnCallback(fn (UserId $id) => match ($id->value()) {
                $this->superAdmin->id() => $this->superAdmin,
                default => null,
            });

        $this->companyRepoMock->method('exists')->willReturn(true);

        $this->expectException(AdvisorNotFoundException::class);

        $this->assignUseCase->execute($command);
    }

    public function test_assign_fails_when_advisor_is_inactive(): void
    {
        $this->advisor->deactivate();

        $command = new AssignAdvisorToCompanyCommand(
            companyId: $this->companyId,
            advisorId: $this->advisor->id(),
            assignedById: $this->superAdmin->id()
        );

        $this->userRepoMock->method('findById')
            ->willReturnCallback(fn (UserId $id) => match ($id->value()) {
                $this->superAdmin->id() => $this->superAdmin,
                $this->advisor->id() => $this->advisor,
                default => null,
            });

        $this->companyRepoMock->method('exists')->willReturn(true);

        $this->expectException(DomainException::class);

        $this->assignUseCase->execute($command);
    }

    public function test_assign_fails_when_target_user_is_client(): void
    {
        $command = new AssignAdvisorToCompanyCommand(
            companyId: $this->companyId,
            advisorId: $this->client->id(),
            assignedById: $this->superAdmin->id()
        );

        $this->userRepoMock->method('findById')
            ->willReturnCallback(fn (UserId $id) => match ($id->value()) {
                $this->superAdmin->id() => $this->superAdmin,
                $this->client->id() => $this->client,
                default => null,
            });

        $this->companyRepoMock->method('exists')->willReturn(true);

        $this->expectException(TargetUserNotAdvisorException::class);

        $this->assignUseCase->execute($command);
    }

    public function test_superadmin_can_revoke_advisor_from_company(): void
    {
        $command = new RevokeAdvisorFromCompanyCommand(
            companyId: $this->companyId,
            advisorId: $this->advisor->id(),
            revokedById: $this->superAdmin->id()
        );

        $this->userRepoMock->method('findById')->willReturn($this->superAdmin);

        $this->advisorRepoMock->expects($this->once())
            ->method('revoke')
            ->with(
                $this->callback(fn (CompanyId $id) => $id->value() === $this->companyId),
                $this->callback(fn (UserId $id) => $id->value() === $this->advisor->id()),
                $this->callback(fn (UserId $id) => $id->value() === $this->superAdmin->id())
            );

        $this->revokeUseCase->execute($command);
    }

    public function test_client_cannot_revoke_advisors(): void
    {
        $command = new RevokeAdvisorFromCompanyCommand(
            companyId: $this->companyId,
            advisorId: $this->advisor->id(),
            revokedById: $this->client->id()
        );

        $this->userRepoMock->method('findById')->willReturn($this->client);

        $this->expectException(UnauthorizedAssignmentException::class);

        $this->revokeUseCase->execute($command);
    }
}
