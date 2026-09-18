<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Contexts\Identity\Domain\ValueObjects\RoleType;
use App\Models\Company;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class IdentitySeeder extends Seeder
{
    public const HELVEST_COMPANY_ID = '11111111-1111-1111-1111-111111111111';
    public const ACME_COMPANY_ID = '22222222-2222-2222-2222-222222222222';

    public const SUPERADMIN_USER_ID = '00000000-0000-0000-0000-000000000001';
    public const ADVISOR_USER_ID = '00000000-0000-0000-0000-000000000002';
    public const ADMIN_USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    public const CLIENT_USER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

    public function run(): void
    {
        // 1. Seed Helvest Advisory (Advisory firm tenant)
        $helvest = Company::updateOrCreate(
            ['id' => self::HELVEST_COMPANY_ID],
            [
                'name' => 'Helvest Advisory Sp. z o.o.',
                'code' => 'HELVEST',
                'tax_id' => 'PL5252525252',
            ]
        );

        // 2. Seed Acme Corporation (Client tenant)
        $acme = Company::updateOrCreate(
            ['id' => self::ACME_COMPANY_ID],
            [
                'name' => 'Acme Manufacturing S.A.',
                'code' => 'ACME',
                'tax_id' => 'PL7010101010',
            ]
        );

        // 3. Seed Super Admin (Partner)
        $superAdmin = User::updateOrCreate(
            ['email' => 'superadmin@helvest.com'],
            [
                'id' => self::SUPERADMIN_USER_ID,
                'name' => 'Partner Zarządzający (Helvest)',
                'email' => 'superadmin@helvest.com',
                'password' => Hash::make('password123'),
                'role' => RoleType::SUPER_ADMIN->value,
                'company_id' => $helvest->id,
                'is_active' => true,
            ]
        );

        // 4. Seed Advisor (Doradca Transakcyjny)
        $advisor = User::updateOrCreate(
            ['email' => 'advisor@helvest.com'],
            [
                'id' => self::ADVISOR_USER_ID,
                'name' => 'Doradca Transakcyjny (Helvest)',
                'email' => 'advisor@helvest.com',
                'password' => Hash::make('password123'),
                'role' => RoleType::ADVISOR->value,
                'company_id' => $helvest->id,
                'is_active' => true,
            ]
        );

        // 5. Seed Mock Admin / Financial Analyst (Legacy / full access)
        User::updateOrCreate(
            ['email' => 'admin@helvest.com'],
            [
                'id' => self::ADMIN_USER_ID,
                'name' => 'Analityk Finansowy (Helvest)',
                'email' => 'admin@helvest.com',
                'password' => Hash::make('password123'),
                'role' => RoleType::ADMIN->value,
                'company_id' => $helvest->id,
                'is_active' => true,
            ]
        );

        // 6. Seed Mock Client / CFO
        User::updateOrCreate(
            ['email' => 'klient@acme.com'],
            [
                'id' => self::CLIENT_USER_ID,
                'name' => 'Jan Kowalski (CFO Acme)',
                'email' => 'klient@acme.com',
                'password' => Hash::make('password123'),
                'role' => RoleType::CLIENT->value,
                'company_id' => $acme->id,
                'is_active' => true,
            ]
        );

        // 7. Seed Advisor Company Assignment (Advisor assigned to Acme)
        DB::table('advisor_company')->updateOrInsert(
            [
                'advisor_id' => $advisor->id,
                'company_id' => $acme->id,
            ],
            [
                'assigned_by' => $superAdmin->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }
}
