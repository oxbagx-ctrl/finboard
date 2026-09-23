<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\ValueObjects;

enum TaxLossSettlementMode: string
{
    /**
     * Art. 7 ust. 5 pkt 1 ustawy o CIT:
     * Obniżenie dochodu w najbliższych kolejno po sobie następujących 5 latach podatkowych,
     * z tym że kwota obniżenia w którymkolwiek z tych lat nie może przekroczyć 50% wysokości tej straty.
     */
    case STANDARD_LOSS_CAP = 'standard_loss_cap';

    /**
     * Art. 7 ust. 5 pkt 2 ustawy o CIT:
     * Jednorazowe obniżenie dochodu w jednym z 5 lat podatkowych o kwotę do 5 000 000 PLN,
     * nieodliczona część podlega rozliczeniu w pozostałych latach z limitem 50% wysokości tej straty.
     */
    case ONE_OFF_5M = 'one_off_5m';

    /**
     * Tryb uproszczony / legacy:
     * Limit odliczenia liczony jako maksymalnie 50% bieżącego dochodu podatkowego (EBT).
     */
    case EBT_CAP = 'ebt_cap';

    public static function fromOrDefault(?string $value): self
    {
        if ($value === null || $value === '') {
            return self::STANDARD_LOSS_CAP;
        }

        return self::tryFrom($value) ?? self::STANDARD_LOSS_CAP;
    }

    public function label(): string
    {
        return match ($this) {
            self::STANDARD_LOSS_CAP => 'Standardowy limit 50% kwoty straty rocznie (art. 7 ust. 5 pkt 1 CIT)',
            self::ONE_OFF_5M => 'Jednorazowe odliczenie do 5 mln zł w roczniku (art. 7 ust. 5 pkt 2 CIT)',
            self::EBT_CAP => 'Uproszczony limit 50% bieżącego dochodu podatkowego (EBT)',
        };
    }

    public function legalBasis(): string
    {
        return match ($this) {
            self::STANDARD_LOSS_CAP => 'art. 7 ust. 5 pkt 1 ustawy o CIT',
            self::ONE_OFF_5M => 'art. 7 ust. 5 pkt 2 ustawy o CIT',
            self::EBT_CAP => 'Uproszczona metodyka zarządcza',
        };
    }
}
