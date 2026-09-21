FINBOARD - DIAGNOSTYKA POŁĄCZENIA POCZTOWEGO (SMTP)
===========================================================

Niniejsza wiadomość została pomyślnie nadana przez moduł diagnostyki poczty platformy FinBoard.
Jeśli otrzymałeś ten email, oznacza to, że transport pocztowy oraz autoryzacja SMTP funkcjonują prawidłowo.

PARAMETRY DIAGNOSTYCZNE:
------------------------
Adres odbiorcy: {{ $recipientEmail }}
Czas nadania (UTC): {{ $sentAtFormatted }}
Środowisko: {{ $environment }}
Aktywny mailer: {{ $mailer }}
Host SMTP: {{ $host ?? 'N/A' }}
Port SMTP: {{ $port ?? 'N/A' }} {{ $isSecurePort ? '(Port bezpieczny TLS/SSL)' : ($isPort25 ? '(Ostrzeżenie: Port 25)' : '') }}
Szyfrowanie: {{ $encryption ? strtoupper($encryption) : 'Brak' }}
Adres nadawcy: {{ $fromAddress ?? 'N/A' }}
@if($socketLatencyMs !== null)
Latencja połączenia socket: {{ $socketLatencyMs }} ms
@endif
@if(!empty($diagnosticMetadata['php_version']))
Wersja PHP: {{ $diagnosticMetadata['php_version'] }}
@endif
@if(!empty($diagnosticMetadata['laravel_version']))
Wersja Laravel: {{ $diagnosticMetadata['laravel_version'] }}
@endif
@if(!empty($diagnosticMetadata['server_hostname']))
Węzeł serwera: {{ $diagnosticMetadata['server_hostname'] }}
@endif

--
FinBoard Deal Advisory & Virtual Data Room Platform
Wiadomość wygenerowana automatycznie przez system diagnostyczny SMTP.
