<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zaproszenie do platformy FinBoard</title>
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
            padding: 32px 32px 24px;
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
        .badge {
            display: inline-block;
            padding: 4px 10px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            background-color: rgba(16, 185, 129, 0.15);
            color: #34d399;
            border: 1px solid rgba(16, 185, 129, 0.3);
            border-radius: 4px;
        }
        .content {
            padding: 32px;
        }
        .greeting {
            font-size: 18px;
            font-weight: 600;
            color: #ffffff;
            margin-top: 0;
            margin-bottom: 16px;
        }
        .text {
            font-size: 14px;
            line-height: 1.6;
            color: #a1a1aa;
            margin-bottom: 24px;
        }
        .meta-box {
            background-color: #27272a;
            border: 1px solid #3f3f46;
            border-radius: 4px;
            padding: 16px 20px;
            margin-bottom: 28px;
        }
        .meta-row {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            font-size: 13px;
            border-bottom: 1px solid #3f3f46;
        }
        .meta-row:last-child {
            border-bottom: none;
        }
        .meta-label {
            color: #71717a;
            font-weight: 500;
        }
        .meta-value {
            color: #f4f4f5;
            font-weight: 600;
            text-align: right;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }
        .cta-container {
            text-align: center;
            margin: 32px 0 24px;
        }
        .btn-primary {
            display: inline-block;
            background-color: #10b981;
            color: #09090b !important;
            font-size: 14px;
            font-weight: 600;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 4px;
            text-align: center;
            letter-spacing: 0.01em;
        }
        .fallback-text {
            font-size: 12px;
            color: #71717a;
            line-height: 1.5;
            word-break: break-all;
            margin-top: 24px;
            padding-top: 20px;
            border-top: 1px solid #27272a;
        }
        .fallback-link {
            color: #34d399;
            text-decoration: underline;
        }
        .security-notice {
            background-color: rgba(234, 179, 8, 0.1);
            border-left: 3px solid #eab308;
            padding: 12px 16px;
            font-size: 12px;
            color: #fef08a;
            line-height: 1.5;
            margin-top: 24px;
            border-radius: 0 4px 4px 0;
        }
        .footer {
            padding: 24px 32px;
            background-color: #09090b;
            border-top: 1px solid #27272a;
            text-align: center;
            font-size: 12px;
            color: #52525b;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo-row">
                <h1 class="brand-title">FINBOARD <span style="font-weight: 400; color: #71717a; font-size: 14px;">| Deal Advisory</span></h1>
                <span class="badge">Zaproszenie</span>
            </div>
        </div>

        <div class="content">
            <h2 class="greeting">Dzień dobry,</h2>
            <p class="text">
                Zostałeś zaproszony do platformy <strong>FinBoard</strong> – systemu analityki finansowej, wycen transakcyjnych oraz repozytorium Virtual Data Room (VDR).
            </p>

            <div class="meta-box">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #3f3f46;">
                        <td style="padding: 6px 0; color: #a1a1aa; font-size: 13px;">Rola w systemie:</td>
                        <td style="padding: 6px 0; color: #ffffff; font-weight: 600; text-align: right; font-size: 13px;">{{ $roleDisplayName }}</td>
                    </tr>
                    @if($companyName)
                    <tr style="border-bottom: 1px solid #3f3f46;">
                        <td style="padding: 6px 0; color: #a1a1aa; font-size: 13px;">Przypisana spółka:</td>
                        <td style="padding: 6px 0; color: #ffffff; font-weight: 600; text-align: right; font-size: 13px;">{{ $companyName }}</td>
                    </tr>
                    @endif
                    @if(!empty($assignedCompanyNames))
                    <tr style="border-bottom: 1px solid #3f3f46;">
                        <td style="padding: 6px 0; color: #a1a1aa; font-size: 13px;">Dostęp do spółek:</td>
                        <td style="padding: 6px 0; color: #ffffff; font-weight: 600; text-align: right; font-size: 13px;">{{ implode(', ', $assignedCompanyNames) }}</td>
                    </tr>
                    @endif
                    @if($inviterName)
                    <tr style="border-bottom: 1px solid #3f3f46;">
                        <td style="padding: 6px 0; color: #a1a1aa; font-size: 13px;">Zaproszony przez:</td>
                        <td style="padding: 6px 0; color: #ffffff; font-weight: 600; text-align: right; font-size: 13px;">{{ $inviterName }}</td>
                    </tr>
                    @endif
                    <tr>
                        <td style="padding: 6px 0; color: #a1a1aa; font-size: 13px;">Ważność linku:</td>
                        <td style="padding: 6px 0; color: #34d399; font-weight: 600; text-align: right; font-size: 13px;">{{ $expiresAtFormatted }}</td>
                    </tr>
                </table>
            </div>

            <div class="cta-container">
                <a href="{{ $invitationUrl }}" class="btn-primary" target="_blank">
                    Aktywuj Konto i Ustaw Hasło &rarr;
                </a>
            </div>

            <div class="security-notice">
                <strong>Wskazówka bezpieczeństwa:</strong> Zgodnie z polityką zerowego zaufania (Zero-Trust) hasło do Twojego konta nie jest generowane przez administratorów. Aby uzyskać dostęp, musisz samodzielnie zdefiniować bezpieczne hasło za pomocą powyższego odnośnika.
            </div>

            <div class="fallback-text">
                Jeśli przycisk nie działa, skopiuj poniższy adres URL i wklej go w pasku adresu przeglądarki:<br>
                <a href="{{ $invitationUrl }}" class="fallback-link">{{ $invitationUrl }}</a>
            </div>
        </div>

        <div class="footer">
            &copy; {{ date('Y') }} FinBoard Deal Advisory Platform &bull; Wiadomość wygenerowana automatycznie.
        </div>
    </div>
</body>
</html>
