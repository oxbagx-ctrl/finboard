FINBOARD | Deal Advisory Platform
ZAPROSZENIE DO PLATFORMY

Dzień dobry,

Zostałeś zaproszony do platformy FinBoard – systemu analityki finansowej, wycen transakcyjnych oraz repozytorium Virtual Data Room (VDR).

Szczegóły konta:
- Rola w systemie: {{ $roleDisplayName }}
@if($companyName)
- Przypisana spółka: {{ $companyName }}
@endif
@if(!empty($assignedCompanyNames))
- Dostęp do spółek: {{ implode(', ', $assignedCompanyNames) }}
@endif
@if($inviterName)
- Zaproszony przez: {{ $inviterName }}
@endif
- Ważność linku: {{ $expiresAtFormatted }}

Aby aktywować konto i bezpiecznie utworzyć hasło, przejdź pod poniższy adres:
{{ $invitationUrl }}

Wskazówka bezpieczeństwa:
Zgodnie z polityką zerowego zaufania hasło do Twojego konta nie jest generowane przez administratorów. Konto zostanie aktywowane wyłącznie po ustanowieniu hasła za pośrednictwem powyższego linku.

--
FinBoard Deal Advisory Platform
Wiadomość wygenerowana automatycznie.
