<?php

declare(strict_types=1);

namespace Tests\Unit\Tenant;

use App\Contexts\Identity\Domain\Entities\Role;
use App\Contexts\Identity\Domain\Model\User;
use App\Contexts\Identity\Domain\ValueObjects\Email;
use App\Contexts\Identity\Domain\ValueObjects\HashedPassword;
use App\Contexts\Identity\Domain\ValueObjects\UserId;
use PHPUnit\Framework\TestCase;

final class AdvisorCompanyAccessControlTest extends TestCase
{
    private const COMPANY_ALPHA = '11111111-1111-1111-1111-111111111111';
    private const COMPANY_BETA = '22222222-2222-2222-2222-222222222222';
    private const COMPANY_GAMMA = '33333333-3333-3333-3333-333333333333';

    public function test_advisor_can_access_only_assigned_companies(): void
    {
        $advisor = $this->createAdvisorUser();
        $assignedCompanies = [self::COMPANY_ALPHA, self::COMPANY_BETA];

        // Advisor can access assigned companies
        $this->assertTrue($advisor->canAccessCompany(self::COMPANY_ALPHA, $assignedCompanies));
        $this->assertTrue($advisor->canAccessCompany(self::COMPANY_BETA, $assignedCompanies));

        // Advisor CANNOT access unassigned company
        $this->assertFalse($advisor->canAccessCompany(self::COMPANY_GAMMA, $assignedCompanies));
        $this->assertFalse($advisor->canAccessCompany('random-uuid-9999-9999-999999999999', $assignedCompanies));
    }

    public function test_advisor_with_no_assignments_cannot_access_any_company(): void
    {
        $advisor = $this->createAdvisorUser();
        $emptyAssignments = [];

        $this->assertFalse($advisor->canAccessCompany(self::COMPANY_ALPHA, $emptyAssignments));
        $this->assertFalse($advisor->canAccessCompany(self::COMPANY_BETA, $emptyAssignments));
        $this->assertFalse($advisor->canAccessCompany(self::COMPANY_GAMMA, $emptyAssignments));
    }

    public function test_deactivated_advisor_cannot_access_any_company_even_if_assigned(): void
    {
        $advisor = $this->createAdvisorUser();
        $assignedCompanies = [self::COMPANY_ALPHA];

        $this->assertTrue($advisor->canAccessCompany(self::COMPANY_ALPHA, $assignedCompanies));

        $advisor->deactivate();

        $this->assertFalse($advisor->canAccessCompany(self::COMPANY_ALPHA, $assignedCompanies));
        $this->assertFalse($advisor->canAccessCompany(self::COMPANY_BETA, $assignedCompanies));
    }

    public function test_super_admin_has_universal_company_access_regardless_of_assignments(): void
    {
        $superAdmin = User::register(
            id: UserId::generate(),
            name: 'Senior Managing Partner',
            email: Email::fromString('managing.partner@helvest.com'),
            password: HashedPassword::fromPlainText('SuperPass123!'),
            role: Role::superAdmin(),
            companyId: null
        );

        $this->assertTrue($superAdmin->canAccessCompany(self::COMPANY_ALPHA, []));
        $this->assertTrue($superAdmin->canAccessCompany(self::COMPANY_BETA, []));
        $this->assertTrue($superAdmin->canAccessCompany(self::COMPANY_GAMMA, []));
        $this->assertTrue($superAdmin->canAccessCompany('unassigned-global-company-uuid', []));

        $superAdmin->deactivate();
        $this->assertFalse($superAdmin->canAccessCompany(self::COMPANY_ALPHA, []));
    }

    public function test_client_access_is_strictly_restricted_to_designated_company(): void
    {
        $client = User::register(
            id: UserId::generate(),
            name: 'CFO Spółki Alpha',
            email: Email::fromString('cfo@alpha.com'),
            password: HashedPassword::fromPlainText('ClientPass123!'),
            role: Role::client(),
            companyId: self::COMPANY_ALPHA
        );

        // Client can access only their own designated company, even if passed array of companies
        $this->assertTrue($client->canAccessCompany(self::COMPANY_ALPHA, [self::COMPANY_BETA, self::COMPANY_GAMMA]));
        $this->assertFalse($client->canAccessCompany(self::COMPANY_BETA, [self::COMPANY_BETA, self::COMPANY_GAMMA]));
        $this->assertFalse($client->canAccessCompany(self::COMPANY_GAMMA, []));
    }

    private function createAdvisorUser(): User
    {
        $user = User::register(
            id: UserId::generate(),
            name: 'Transakcyjny Doradca M&A',
            email: Email::fromString('advisor@helvest.com'),
            password: HashedPassword::fromPlainText('AdvisorPass123!'),
            role: Role::advisor(),
            companyId: null
        );

        $user->releaseEvents();

        return $user;
    }
}
