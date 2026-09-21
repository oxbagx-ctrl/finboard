<?php

declare(strict_types=1);

namespace App\Presentation\Api\Controllers;

use App\Contexts\Identity\Infrastructure\Mail\MailDiagnosticService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

final class AdminMailController extends Controller
{
    public function __construct(
        private readonly MailDiagnosticService $diagnosticService
    ) {
    }

    /**
     * Get active mail transport configuration, security attributes, and optional socket health.
     */
    public function status(Request $request): JsonResponse
    {
        $transport = $request->query('transport');
        $status = $this->diagnosticService->getStatus(is_string($transport) ? $transport : null);

        $checkSocket = $request->boolean('check_socket', true);
        $socketResult = null;

        if ($checkSocket && $status['mailer'] === 'smtp' && !empty($status['host']) && !empty($status['port'])) {
            $socketResult = $this->diagnosticService->checkSocket(
                $status['host'],
                $status['port'],
                $status['timeout'] ?? 5
            );
        }

        return response()->json([
            'status' => 'success',
            'data' => array_merge($status, [
                'socket' => $socketResult,
            ]),
        ]);
    }

    /**
     * Dispatch a diagnostic test email to the specified recipient and measure latency.
     */
    public function test(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'recipient' => ['required', 'email'],
            'transport' => ['nullable', 'string'],
        ], [
            'recipient.required' => 'Adres email odbiorcy jest wymagany.',
            'recipient.email' => 'Podany adres email ma nieprawidłowy format.',
        ]);

        $recipient = (string) $validated['recipient'];
        $transport = isset($validated['transport']) ? (string) $validated['transport'] : null;

        $result = $this->diagnosticService->sendTestEmail($recipient, $transport);

        if ($result['success']) {
            return response()->json([
                'status' => 'success',
                'latency_ms' => $result['latency_ms'],
                'message' => "Wiadomość testowa została pomyślnie wysłana do: {$recipient}.",
                'recipient' => $recipient,
            ]);
        }

        return response()->json([
            'status' => 'error',
            'latency_ms' => $result['latency_ms'],
            'message' => $result['error_message'] ?? 'Nie udało się nawiązać połączenia z serwerem pocztowym SMTP.',
            'recipient' => $recipient,
        ]);
    }
}
