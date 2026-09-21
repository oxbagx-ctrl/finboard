<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FinBoard SMTP Diagnostic Ping</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #09090b;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #f4f4f5;
            -webkit-font-smoothing: antialiased;
        }
        .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #18181b;
            border: 1px solid #27272a;
            border-radius: 6px;
            overflow: hidden;
        }
        .header {
            padding: 28px 32px;
            background-color: #09090b;
            border-bottom: 1px solid #27272a;
        }
        .logo-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .brand-title {
            font-size: 20px;
            font-weight: 700;
            letter-spacing: -0.025em;
            color: #ffffff;
            margin: 0;
        }
        .badge-diagnostic {
            display: inline-block;
            padding: 4px 10px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            background-color: rgba(59, 130, 246, 0.15);
            color: #60a5fa;
            border: 1px solid rgba(59, 130, 246, 0.3);
            border-radius: 4px;
        }
        .badge-success {
            display: inline-block;
            padding: 2px 8px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            background-color: rgba(16, 185, 129, 0.15);
            color: #34d399;
            border: 1px solid rgba(16, 185, 129, 0.3);
            border-radius: 3px;
        }
        .badge-warning {
            display: inline-block;
            padding: 2px 8px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            background-color: rgba(245, 158, 11, 0.15);
            color: #fbbf24;
            border: 1px solid rgba(245, 158, 11, 0.3);
            border-radius: 3px;
        }
        .content {
            padding: 32px;
        }
        .greeting {
            font-size: 18px;
            font-weight: 600;
            color: #ffffff;
            margin-top: 0;
            margin-bottom: 12px;
        }
        .text {
            font-size: 14px;
            line-height: 1.6;
            color: #a1a1aa;
            margin-bottom: 24px;
        }
        .status-box {
            background-color: rgba(16, 185, 129, 0.08);
            border: 1px solid rgba(16, 185, 129, 0.25);
            border-radius: 4px;
            padding: 16px 20px;
            margin-bottom: 24px;
        }
        .status-box-title {
            color: #34d399;
            font-size: 13px;
            font-weight: 600;
            margin: 0 0 6px 0;
        }
        .status-box-desc {
            color: #a1a1aa;
            font-size: 12px;
            line-height: 1.5;
            margin: 0;
        }
        .meta-box {
            background-color: #27272a;
            border: 1px solid #3f3f46;
            border-radius: 4px;
            padding: 16px 20px;
            margin-bottom: 28px;
        }
        .meta-table {
            width: 100%;
            border-collapse: collapse;
        }
        .meta-table tr {
            border-bottom: 1px solid #3f3f46;
        }
        .meta-table tr:last-child {
            border-bottom: none;
        }
        .meta-table td {
            padding: 8px 0;
            font-size: 13px;
        }
        .meta-label {
            color: #71717a;
            font-weight: 500;
            width: 40%;
        }
        .meta-value {
            color: #f4f4f5;
            font-weight: 600;
            text-align: right;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            width: 60%;
        }
        .footer {
            padding: 24px 32px;
            background-color: #09090b;
            border-top: 1px solid #27272a;
            font-size: 12px;
            color: #52525b;
            line-height: 1.5;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo-row">
                <h1 class="brand-title">FinBoard</h1>
                <span class="badge-diagnostic">SMTP Diagnostic Ping</span>
            </div>
        </div>

        <div class="content">
            <h2 class="greeting">Weryfikacja Połączenia Pocztowego SMTP</h2>
            <p class="text">
                Niniejsza wiadomość została pomyślnie wygenerowana i nadana przez moduł diagnostyczny platformy <strong>FinBoard</strong>. 
                Otrzymanie tego maila potwierdza, że transport pocztowy oraz autoryzacja SMTP funkcjonują prawidłowo.
            </p>

            <div class="status-box">
                <p class="status-box-title">✓ Połączenie i wysyłka zweryfikowane pomyślnie</p>
                <p class="status-box-desc">
                    Wszystkie zaproszenia użytkowników, powiadomienia transakcyjne oraz linki aktywacyjne będą bez przeszkód doręczane do skrzynek odbiorców.
                </p>
            </div>

            <div class="meta-box">
                <table class="meta-table">
                    <tr>
                        <td class="meta-label">Adres odbiorcy:</td>
                        <td class="meta-value">{{ $recipientEmail }}</td>
                    </tr>
                    <tr>
                        <td class="meta-label">Czas nadania (UTC):</td>
                        <td class="meta-value">{{ $sentAtFormatted }}</td>
                    </tr>
                    <tr>
                        <td class="meta-label">Środowisko:</td>
                        <td class="meta-value">{{ $environment }}</td>
                    </tr>
                    <tr>
                        <td class="meta-label">Aktywny mailer:</td>
                        <td class="meta-value">{{ $mailer }}</td>
                    </tr>
                    <tr>
                        <td class="meta-label">Host SMTP:</td>
                        <td class="meta-value">{{ $host ?? 'N/A' }}</td>
                    </tr>
                    <tr>
                        <td class="meta-label">Port SMTP:</td>
                        <td class="meta-value">
                            {{ $port ?? 'N/A' }}
                            @if($isSecurePort)
                                <span class="badge-success">Bezpieczny (TLS/SSL)</span>
                            @elseif($isPort25)
                                <span class="badge-warning">Port 25 (OCI Warning)</span>
                            @endif
                        </td>
                    </tr>
                    <tr>
                        <td class="meta-label">Szyfrowanie:</td>
                        <td class="meta-value">{{ $encryption ? strtoupper($encryption) : 'Brak' }}</td>
                    </tr>
                    <tr>
                        <td class="meta-label">Nadawca (From):</td>
                        <td class="meta-value">{{ $fromAddress ?? 'N/A' }}</td>
                    </tr>
                    @if($socketLatencyMs !== null)
                    <tr>
                        <td class="meta-label">Latencja socketu:</td>
                        <td class="meta-value">{{ $socketLatencyMs }} ms</td>
                    </tr>
                    @endif
                    @if(!empty($diagnosticMetadata['php_version']))
                    <tr>
                        <td class="meta-label">Wersja PHP:</td>
                        <td class="meta-value">{{ $diagnosticMetadata['php_version'] }}</td>
                    </tr>
                    @endif
                    @if(!empty($diagnosticMetadata['laravel_version']))
                    <tr>
                        <td class="meta-label">Wersja Laravel:</td>
                        <td class="meta-value">{{ $diagnosticMetadata['laravel_version'] }}</td>
                    </tr>
                    @endif
                    @if(!empty($diagnosticMetadata['server_hostname']))
                    <tr>
                        <td class="meta-label">Węzeł serwera:</td>
                        <td class="meta-value">{{ $diagnosticMetadata['server_hostname'] }}</td>
                    </tr>
                    @endif
                </table>
            </div>
        </div>

        <div class="footer">
            Wiadomość wygenerowana automatycznie przez FinBoard Deal Advisory & VDR Platform.<br>
            Poufne powiadomienie administracyjne. Wszelkie prawa zastrzeżone.
        </div>
    </div>
</body>
</html>
