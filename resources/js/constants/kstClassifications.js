/**
 * Statutory Classification of Fixed Assets (Klasyfikacja Środków Trwałych - KŚT)
 * Aligned with App\Contexts\InvestmentProject\Domain\ValueObjects\KstClassification
 */
export const KST_CLASSIFICATIONS = [
    {
        code: 'KST_0',
        name: 'Grunty i tereny (nieamortyzowane)',
        rate: 0.0,
        group: 'Grupa 0',
    },
    {
        code: 'KST_1',
        name: 'Budynki i lokale przemysłowo-biurowe',
        rate: 2.5,
        group: 'Grupa 1',
    },
    {
        code: 'KST_2',
        name: 'Budowle i obiekty inżynierii lądowej',
        rate: 4.5,
        group: 'Grupa 2',
    },
    {
        code: 'KST_3',
        name: 'Kotły i maszyny energetyczne',
        rate: 7.0,
        group: 'Grupa 3',
    },
    {
        code: 'KST_4',
        name: 'Maszyny i aparaty ogólnego zastosowania',
        rate: 10.0,
        group: 'Grupa 4',
    },
    {
        code: 'KST_5',
        name: 'Specjalistyczne ciągi technologiczne',
        rate: 14.0,
        group: 'Grupa 5',
    },
    {
        code: 'KST_6',
        name: 'Urządzenia techniczne i sieci',
        rate: 10.0,
        group: 'Grupa 6',
    },
    {
        code: 'KST_7',
        name: 'Środki transportu i pojazdy',
        rate: 20.0,
        group: 'Grupa 7',
    },
    {
        code: 'KST_8',
        name: 'Narzędzia, przyrządy i wyposażenie',
        rate: 20.0,
        group: 'Grupa 8',
    },
    {
        code: 'KST_IT',
        name: 'Sprzęt komputerowy i systemy informatyczne',
        rate: 30.0,
        group: 'Informatyka',
    },
];

export const getKstByCode = (code) => {
    return KST_CLASSIFICATIONS.find((k) => k.code === code) || {
        code: code || 'KST_1',
        name: 'Standardowe środki trwałe',
        rate: 2.5,
        group: 'Inne',
    };
};
