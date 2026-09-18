<?php

declare(strict_types=1);

namespace Tests\Unit\Tenant;

use App\Contexts\Identity\Domain\ValueObjects\UserId;
use App\Contexts\Tenant\Domain\Entities\CompanyAdvisorAssignment;
use App\Contexts\Tenant\Domain\Events\AdvisorAssignedToCompany;
use App\Contexts\Tenant\Domain\Events\AdvisorRevokedFromCompany;
use App\Contexts\Tenant\Domain\Repositories\CompanyAdvisorRepositoryInterface;
use App\Contexts\Tenant\Domain\ValueObjects\CompanyId;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

final class CompanyAdvisorAssignmentTest extends TestCase
{
    private const VALID_COMPANY_UUID = '33333333-3333-3333-3333-333333333333';
    private const VALID_ADVISOR_UUID = '44444444-4444-4444-4444-444444444444';
    private const VALID_SUPERADMIN_UUID = '55555555-5555-5555-5555-555555555555';

    public function test_valid_company_id_can_be_instantiated_and_compared(): void
    {
        $companyId = CompanyId::fromString(self::VALID_COMPANY_UUID);
        $this->assertSame(self::VALID_COMPANY_UUID, $companyId->value());
        $this->assertSame(self::VALID_COMPANY_UUID, (string) $companyId);

        $sameCompanyId = CompanyId::fromString(self::VALID_COMPANY_UUID);
        $this->assertTrue($companyId->equals($sameCompanyId));

        $generated = CompanyId::generate();
        $this->assertNotEmpty($generated->value());
        $this->assertFalse($companyId->equals($generated));
    }

    public function test_invalid_company_id_throws_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('not a valid UUID');

        CompanyId::fromString('invalid-company-id');
    }

    public function test_company_advisor_assignment_creation_records_domain_event(): void
    {
        $companyId = CompanyId::fromString(self::VALID_COMPANY_UUID);
        $advisorId = UserId::fromString(self::VALID_ADVISOR_UUID);
        $superAdminId = UserId::fromString(self::VALID_SUPERADMIN_UUID);

        $assignment = CompanyAdvisorAssignment::create(
            companyId: $companyId,
            advisorId: $advisorId,
            assignedBy: $superAdminId
        );

        $this->assertTrue($assignment->companyId()->equals($companyId));
        $this->assertTrue($assignment->advisorId()->equals($advisorId));
        $this->assertTrue($assignment->assignedBy()->equals($superAdminId));
        $this->assertTrue($assignment->hasEvents());

        $events = $assignment->releaseEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(AdvisorAssignedToCompany::class, $events[0]);

        /** @var AdvisorAssignedToCompany $event */
        $event = $events[0];
        $this->assertSame(self::VALID_COMPANY_UUID, $event->companyId());
        $this->assertSame(self::VALID_ADVISOR_UUID, $event->advisorId());
        $this->assertSame(self::VALID_SUPERADMIN_UUID, $event->assignedBy());
        $this->assertSame(self::VALID_COMPANY_UUID . ':' . self::VALID_ADVISOR_UUID, $event->aggregateId());
        $this->assertArrayHasKey('assigned_at', $event->toPayload());
    }

    public function test_company_advisor_assignment_revocation_records_domain_event(): void
    {
        $companyId = CompanyId::fromString(self::VALID_COMPANY_UUID);
        $advisorId = UserId::fromString(self::VALID_ADVISOR_UUID);
        $superAdminId = UserId::fromString(self::VALID_SUPERADMIN_UUID);

        $assignment = new CompanyAdvisorAssignment($companyId, $advisorId);
        $assignment->recordRevocation($superAdminId);

        $this->assertTrue($assignment->hasEvents());

        $events = $assignment->releaseEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(AdvisorRevokedFromCompany::class, $events[0]);

        /** @var AdvisorRevokedFromCompany $event */
        $event = $events[0];
        $this->assertSame(self::VALID_COMPANY_UUID, $event->companyId());
        $this->assertSame(self::VALID_ADVISOR_UUID, $event->advisorId());
        $this->assertSame(self::VALID_SUPERADMIN_UUID, $event->revokedBy());
        $this->assertSame(self::VALID_COMPANY_UUID . ':' . self::VALID_ADVISOR_UUID, $event->aggregateId());
        $this->assertArrayHasKey('revoked_at', $event->toPayload());
    }

    public function test_in_memory_repository_mock_satisfies_interface(): void
    {
        $repository = new class implements CompanyAdvisorRepositoryInterface {
            /** @var array<string, array<string, string>> */
            private array $assignments = [];

            public function assign(CompanyAdvisorAssignment $assignment): void
            {
                $this->assignments[$assignment->advisorId()->value()][$assignment->companyId()->value()] = $assignment->assignedBy()?->value() ?? '';
            }

            public function revoke(CompanyId $companyId, UserId $advisorId, ?UserId $revokedBy = null): void
            {
                unset($this->assignments[$advisorId->value()][$companyId->value()]);
            }

            public function isAdvisorAssigned(CompanyId $companyId, UserId $advisorId): bool
            {
                return isset($this->assignments[$advisorId->value()][$companyId->value()]);
            }

            public function findCompanyIdsByAdvisor(UserId $advisorId): array
            {
                return array_keys($this->assignments[$advisorId->value()] ?? []);
            }

            public function findAdvisorIdsByCompany(CompanyId $companyId): array
            {
                $advisors = [];
                foreach ($this->assignments as $advId => $companies) {
                    if (isset($companies[$companyId->value()])) {
                        $advisors[] = $advId;
                    }
                }
                return $advisors;
            }
        };

        $companyId = CompanyId::fromString(self::VALID_COMPANY_UUID);
        $advisorId = UserId::fromString(self::VALID_ADVISOR_UUID);
        $superAdminId = UserId::fromString(self::VALID_SUPERADMIN_UUID);

        $this->assertFalse($repository->isAdvisorAssigned($companyId, $advisorId));

        $assignment = CompanyAdvisorAssignment::create($companyId, $advisorId, $superAdminId);
        $repository->assign($assignment);

        $this->assertTrue($repository->isAdvisorAssigned($companyId, $advisorId));
        $this->assertSame([self::VALID_COMPANY_UUID], $repository->findCompanyIdsByAdvisor($advisorId));
        $this->assertSame([self::VALID_ADVISOR_UUID], $repository->findAdvisorIdsByCompany($companyId));

        $repository->revoke($companyId, $advisorId, $superAdminId);
        $this->assertFalse($repository->isAdvisorAssigned($companyId, $advisorId));
        $this->assertEmpty($repository->findCompanyIdsByAdvisor($advisorId));
    }
}
