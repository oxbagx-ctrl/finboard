<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Domain\Services;

use App\Contexts\DocumentManagement\Domain\Model\TransactionFolder;
use App\Contexts\DocumentManagement\Domain\ValueObjects\DeweyIndexCode;
use App\Contexts\DocumentManagement\Domain\ValueObjects\FolderId;

final class DeweyMnaStructureGenerator
{
    /**
     * Standard M&A Due Diligence taxonomy template.
     *
     * @var array<string, array{name: string, description: string, children: array<string, array{name: string, description: string}>}>
     */
    public const STANDARD_MNA_TAXONOMY = [
        '01.00' => [
            'name' => 'Informacje Korporacyjne i Struktura Grupy',
            'description' => 'Statuty, odpisy z rejestrów, księga udziałów, struktura grupy i uchwały organów.',
            'children' => [
                '01.01' => ['name' => 'Umowy Spółki, Statuty i Akty Założycielskie', 'description' => 'Akty notarialne, statuty, regulaminy zarządu i rady nadzorczej.'],
                '01.02' => ['name' => 'Odpisy KRS, Rejestry i Certyfikaty Rejestracji', 'description' => 'Aktualne i pełne odpisy z rejestru przedsiębiorców KRS, NIP, REGON.'],
                '01.03' => ['name' => 'Księga Udziałów i Struktura Akcjonariatu', 'description' => 'Wykaz wspólników/akcjonariuszy, historia zmian kapitałowych.'],
                '01.04' => ['name' => 'Uchwały Organów Spółki', 'description' => 'Protokoły i uchwały Zgromadzenia Wspólników, Rady Nadzorczej oraz Zarządu.'],
            ],
        ],
        '02.00' => [
            'name' => 'Finanse, Księgowość i Podatki',
            'description' => 'Sprawozdania finansowe, raporty zarządcze, audyty biegłego rewidenta i deklaracje podatkowe.',
            'children' => [
                '02.01' => ['name' => 'Roczne Sprawozdania Finansowe i Bilans', 'description' => 'Zatwierdzone roczne sprawozdania finansowe (RZiS, Bilans, Cash Flow).'],
                '02.02' => ['name' => 'Miesięczne Zestawienia Obrotów i Sald (ZOiS) oraz P&L', 'description' => 'Bieżące dane zarządcze, rachunek wyników, ZOiS za ostatnie 36 miesięcy.'],
                '02.03' => ['name' => 'Deklaracje Podatkowe i Rozliczenia CIT/VAT', 'description' => 'Roczne CIT-8, deklaracje VAT-7/JPK_V7, zaświadczenia o niezaleganiu w podatkach.'],
                '02.04' => ['name' => 'Raporty Biegłego Rewidenta i Audyty', 'description' => 'Opinie i raporty z badania sprawozdań finansowych przez biegłych rewidentów.'],
            ],
        ],
        '03.00' => [
            'name' => 'Umowy Handlowe, Operacyjne i Dostawcy',
            'description' => 'Kluczowe kontrakty przychodowe z klientami oraz umowy z głównymi dostawcami.',
            'children' => [
                '03.01' => ['name' => 'Kluczowe Kontrakty z Klientami (Top 10)', 'description' => 'Umowy handlowe generujące ponad 5% przychodów ze sprzedaży.'],
                '03.02' => ['name' => 'Umowy z Dostawcami i Podwykonawcami', 'description' => 'Długoterminowe kontrakty na dostawy surowców, mediów i komponentów produkcyjnych.'],
                '03.03' => ['name' => 'Dystrybucja, Logistyka i Warunki Handlowe', 'description' => 'Umowy spedycyjne, agencyjne, SLA, cenniki i ogólne warunki sprzedaży (OWS).'],
            ],
        ],
        '04.00' => [
            'name' => 'Majątek, Środki Trwałe i Nieruchomości',
            'description' => 'Prawa własności do nieruchomości, park maszynowy, leasingi i obciążenia majątku.',
            'children' => [
                '04.01' => ['name' => 'Tytuły Prawne do Nieruchomości', 'description' => 'Odpisy z ksiąg wieczystych, akty własności, umowy najmu i dzierżawy zakładów.'],
                '04.02' => ['name' => 'Rejestr Środków Trwałych i Maszyn', 'description' => 'Ewidencja bilansowa środków trwałych, specyfikacja linii technologicznych.'],
                '04.03' => ['name' => 'Umowy Leasingu i Zastawy Rejestrowe', 'description' => 'Aktywne umowy leasingu operacyjnego/finansowego oraz obciążenia hipoteczne i zastawne.'],
            ],
        ],
        '05.00' => [
            'name' => 'Zasoby Ludzkie (HR) i Zarządzanie',
            'description' => 'Struktura zatrudnienia, kluczowa kadra zarządzająca, wzorce umów i systemy motywacyjne.',
            'children' => [
                '05.01' => ['name' => 'Struktura Organizacyjna i Kluczowy Personel', 'description' => 'Schemat organizacyjny, CV kadry C-level, regulaminy pracy i wynagradzania.'],
                '05.02' => ['name' => 'Wzorce Umów o Pracę i Kontraktów Menedżerskich', 'description' => 'Standardowe wzory umów o pracę, kontraktów B2B, zakazów konkurencji i NDA.'],
                '05.03' => ['name' => 'Programy Motywacyjne i Świadczenia (ESOP)', 'description' => 'Programy opcji na udziały/akcje, pakiety premiowe i pozapłacowe.'],
            ],
        ],
        '06.00' => [
            'name' => 'Własność Intelektualna (IP), IT i Systemy',
            'description' => 'Prawa autorskie, znaki towarowe, licencje systemów IT i bezpieczeństwo danych.',
            'children' => [
                '06.01' => ['name' => 'Znaki Towarowe, Patenty i Prawa Własności Przemysłowej', 'description' => 'Świadectwa ochronne UPRP/EUIPO, zgłoszenia patentowe, domeny internetowe.'],
                '06.02' => ['name' => 'Licencje IT, Systemy ERP i Architektura', 'description' => 'Umowy wdrożeniowe ERP/CRM, licencje na oprogramowanie produkcyjne, infrastruktura chmurowa.'],
                '06.03' => ['name' => 'Polityki Bezpieczeństwa Informacji i RODO', 'description' => 'Dokumentacja przetwarzania danych osobowych, procedury cyberbezpieczeństwa.'],
            ],
        ],
        '07.00' => [
            'name' => 'Spory Prawne, Zobowiązania Warunkowe i Ubezpieczenia',
            'description' => 'Postępowania sądowe i administracyjne, polisy ubezpieczeniowe oraz gwarancje.',
            'children' => [
                '07.01' => ['name' => 'Spory Sądowe, Arbitrażowe i Postępowania Administracyjne', 'description' => 'Opis toczących się i potencjalnych sporów, pozwy, pisma procesowe, opinie prawne.'],
                '07.02' => ['name' => 'Polisy Ubezpieczeniowe (OC, Majątek, D&O)', 'description' => 'Certyfikaty ubezpieczeniowe majątku, OC działalności, ubezpieczenia członków zarządu.'],
                '07.03' => ['name' => 'Gwarancje Bankowe, Weksle i Poręczenia', 'description' => 'Wystawione i otrzymane gwarancje należytego wykonania umowy, weksle in blanco.'],
            ],
        ],
        '08.00' => [
            'name' => 'Ochrona Środowiska (ESG) i Pozwolenia Branżowe',
            'description' => 'Decyzje środowiskowe, pozwolenia zintegrowane, certyfikaty ISO i raporty zrównoważonego rozwoju.',
            'children' => [
                '08.01' => ['name' => 'Decyzje Środowiskowe i Pozwolenia Zintegrowane', 'description' => 'Pozwolenia emisyjne, gospodarka odpadami, decyzje o środowiskowych uwarunkowaniach.'],
                '08.02' => ['name' => 'Certyfikaty Jakościowe i Standardy ESG', 'description' => 'Certyfikaty ISO 9001/14001/45001, raporty taksonomii unijnej i audyty BHP.'],
            ],
        ],
    ];

    /**
     * Generate standard M&A TransactionFolder entities for the given company.
     *
     * @return list<TransactionFolder>
     */
    public function generateStandardFolders(string $companyId): array
    {
        $folders = [];
        $sortOrder = 10;

        foreach (self::STANDARD_MNA_TAXONOMY as $rootCode => $rootData) {
            $rootId = FolderId::generate();
            $rootFolder = TransactionFolder::create(
                id: $rootId,
                companyId: $companyId,
                indexCode: DeweyIndexCode::fromString($rootCode),
                name: $rootData['name'],
                parentId: null,
                description: $rootData['description'],
                sortOrder: $sortOrder
            );
            $folders[] = $rootFolder;
            $sortOrder += 10;

            $subSortOrder = 1;
            foreach ($rootData['children'] as $childCode => $childData) {
                $childId = FolderId::generate();
                $childFolder = TransactionFolder::create(
                    id: $childId,
                    companyId: $companyId,
                    indexCode: DeweyIndexCode::fromString($childCode),
                    name: $childData['name'],
                    parentId: $rootId,
                    description: $childData['description'],
                    sortOrder: $subSortOrder++
                );
                $folders[] = $childFolder;
            }
        }

        return $folders;
    }
}
