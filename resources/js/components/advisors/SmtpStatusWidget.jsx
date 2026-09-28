import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/client';
import { useNotification } from '../../context/NotificationContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Tooltip, InfoTooltip } from '../ui/Tooltip';
import {
    Server,
    ShieldCheck,
    ShieldAlert,
    CheckCircle2,
    XCircle,
    RotateCw,
    Send,
    Lock,
    Mail,
    Clock,
    AlertTriangle,
    Terminal
} from 'lucide-react';

export const SmtpStatusWidget = ({
    onOpenTestModal,
    compact = false
}) => {
    const { error: notifyError } = useNotification();
    const [statusData, setStatusData] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchStatus = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/admin/mail/status');
            setStatusData(res.data?.data || null);
        } catch (err) {
            notifyError('Nie udało się pobrać statusu konfiguracji poczty SMTP.');
            setStatusData(null);
        } finally {
            setLoading(false);
        }
    }, [notifyError]);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    const isConnected = statusData?.socket?.connected === true;
    const isPort25 = statusData?.is_port_25_warning || statusData?.port === 25;
    const socketLatency = statusData?.socket?.latency_ms ?? null;
    const socketBanner = statusData?.socket?.banner || null;
    const socketError = statusData?.socket?.error_message || null;

    if (compact) {
        return (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono shadow-xs">
                <div className="flex items-center gap-2.5">
                    <Tooltip content={isConnected ? `Gniazdo TCP połączone pomyślnie (${socketLatency ?? 0}ms)` : 'Brak odpowiedzi gniazda TCP serwera SMTP'}>
                        <div
                            tabIndex={0}
                            role="img"
                            aria-label={isConnected ? 'SMTP połączony' : 'SMTP rozłączony'}
                            className={`w-6 h-6 rounded flex items-center justify-center border focus:outline-none focus:ring-1 focus:ring-zinc-400 ${
                                isConnected
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700/60 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700/60 text-rose-600 dark:text-rose-400'
                            }`}
                        >
                            {isConnected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        </div>
                    </Tooltip>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-zinc-700 dark:text-zinc-300 font-semibold">SMTP:</span>
                        <span className="text-zinc-500 dark:text-zinc-400 font-mono">
                            {statusData ? `${statusData.host}:${statusData.port}` : 'Ładowanie...'}
                        </span>
                        {statusData && (
                            <Tooltip content={isConnected ? `Węzeł SMTP online, opóźnienie ${socketLatency ?? 0} ms` : 'Serwer SMTP nie odpowiada na zdefiniowanym porcie'}>
                                <span>
                                    <Badge variant={isConnected ? 'success' : 'danger'} size="sm">
                                        {isConnected ? `ONLINE (${socketLatency ?? 0}ms)` : 'OFFLINE'}
                                    </Badge>
                                </span>
                            </Tooltip>
                        )}
                        {isPort25 && (
                            <Tooltip content="Wykryto port 25 blokowany domyślnie przez dostawców IaaS (np. OCI). Zaleca się port 587 lub 465.">
                                <span>
                                    <Badge variant="warning" size="sm">PORT 25 (OCI BLOCKED)</Badge>
                                </span>
                            </Tooltip>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Tooltip content="Odśwież stan połączenia SMTP">
                        <span>
                            <Button
                                variant="ghost"
                                size="sm"
                                icon={RotateCw}
                                onClick={fetchStatus}
                                disabled={loading}
                                loading={loading}
                                title="Odśwież stan połączenia SMTP"
                                aria-label="Odśwież stan połączenia SMTP"
                            >
                                Odśwież
                            </Button>
                        </span>
                    </Tooltip>
                    <Tooltip content="Wyślij testową wiadomość e-mail weryfikującą konfigurację">
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={Send}
                            onClick={onOpenTestModal}
                            aria-label="Testuj SMTP"
                        >
                            Testuj SMTP
                        </Button>
                    </Tooltip>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden font-mono text-xs shadow-sm">
            {/* Widget Header */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Tooltip content="Węzeł poczty transakcyjnej do wysyłki zaproszeń i alertów systemowych">
                        <div
                            tabIndex={0}
                            role="img"
                            aria-label="Węzeł poczty transakcyjnej"
                            className="w-8 h-8 rounded bg-zinc-100 dark:bg-zinc-850 border border-zinc-300 dark:border-zinc-750 flex items-center justify-center text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                        >
                            <Server className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                        </div>
                    </Tooltip>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs uppercase tracking-wider">
                                Węzeł Poczty Transakcyjnej (SMTP)
                            </span>
                            <InfoTooltip
                                content="Węzeł SMTP obsługuje wysyłkę bezpiecznych linków aktywacyjnych dla zaproszonych doradców i klientów spółek portfelowych."
                                ariaLabel="Informacje o węźle poczty transakcyjnej"
                                size="xs"
                            />
                            <Tooltip content={isConnected ? `Połączenie aktywne (opóźnienie ${socketLatency ?? 0}ms)` : 'Brak odpowiedzi gniazda TCP'}>
                                <span>
                                    <Badge variant={isConnected ? 'success' : 'danger'} size="sm">
                                        {loading ? 'BADANIE...' : isConnected ? 'POŁĄCZENIE AKTYWNE' : 'BRAK POŁĄCZENIA'}
                                    </Badge>
                                </span>
                            </Tooltip>
                            {statusData?.is_secure_port && (
                                <Tooltip content={`Port ${statusData.port} ze wsparciem bezpiecznego szyfrowania TLS/SSL`}>
                                    <span>
                                        <Badge variant="purple" size="sm">PORT SZYFROWANY ({statusData.port})</Badge>
                                    </span>
                                </Tooltip>
                            )}
                        </div>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                            TRANSPORTER EMAIL DLA ZAPROSZEŃ I POWIADOMIEŃ SYSTEMOWYCH FINBOARD
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Tooltip content="Wykonaj test gniazda TCP i zbadaj dostępność portu SMTP">
                        <span>
                            <Button
                                variant="outline"
                                size="sm"
                                icon={RotateCw}
                                onClick={fetchStatus}
                                disabled={loading}
                                loading={loading}
                                aria-label="Sprawdź Port"
                            >
                                Sprawdź Port
                            </Button>
                        </span>
                    </Tooltip>
                    <Tooltip content="Otwórz formularz wysyłki testowej wiadomości e-mail">
                        <Button
                            variant="primary"
                            size="sm"
                            icon={Send}
                            onClick={onOpenTestModal}
                            aria-label="Wyślij Test SMTP"
                        >
                            Wyślij Test SMTP
                        </Button>
                    </Tooltip>
                </div>
            </div>

            {/* Port 25 Warning Banner */}
            {isPort25 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-[11px] leading-relaxed flex-1">
                        <strong className="text-amber-900 dark:text-amber-200">Uwaga: Wykryto port 25. </strong>
                        W środowiskach chmurowych (np. Oracle Cloud Infrastructure OCI) port 25 jest domyślnie blokowany przez dostawcę w celu ochrony przed spamem. Dla niezawodnej wysyłki zaproszeń zaleca się przełączenie na port <strong>587 (TLS)</strong> lub <strong>465 (SSL)</strong> w pliku <code>.env</code>.
                    </div>
                    <InfoTooltip
                        content="Blokada portu 25 dotyczy ruchu wychodzącego do zewnętrznych serwerów pocztowych. Porty 587 (wymagający STARTTLS) oraz 465 (SMTPS) gwarantują szyfrowaną komunikację i brak blokad u dostawców chmurowych."
                        ariaLabel="Szczegóły o blokadzie portu 25"
                        size="xs"
                    />
                </div>
            )}

            {/* Main Configuration Grid */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="p-3 bg-white dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded shadow-xs">
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Serwer & Port</span>
                        <Tooltip content="Nazwa hosta i port serwera pocztowego">
                            <Server className="w-3 h-3 text-zinc-400 dark:text-zinc-500 cursor-help" tabIndex={0} aria-label="Serwer i Port" />
                        </Tooltip>
                    </div>
                    <div className="text-zinc-900 dark:text-zinc-100 font-bold text-xs truncate">
                        {statusData?.host || 'N/A'}:{statusData?.port || 'N/A'}
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
                        <span>Szyfrowanie: <strong className="text-zinc-800 dark:text-zinc-300 uppercase">{statusData?.encryption || 'BRAK'}</strong></span>
                    </div>
                </div>

                <div className="p-3 bg-white dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded shadow-xs">
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Autoryzacja SMTP</span>
                        <Tooltip content="Dane uwierzytelniające węzła pocztowego">
                            <ShieldCheck className="w-3 h-3 text-zinc-400 dark:text-zinc-500 cursor-help" tabIndex={0} aria-label="Autoryzacja SMTP" />
                        </Tooltip>
                    </div>
                    <div className="text-zinc-900 dark:text-zinc-100 font-bold text-xs truncate">
                        {statusData?.username || 'Brak autoryzacji'}
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                        Hasło: <strong className={statusData?.has_password ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400'}>
                            {statusData?.has_password ? 'USTAWIONE' : 'BRAK'}
                        </strong>
                    </div>
                </div>

                <div className="p-3 bg-white dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded shadow-xs">
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Adres Nadawcy</span>
                        <Tooltip content="Tożsamość nadawcy wiadomości wychodzących">
                            <Mail className="w-3 h-3 text-zinc-400 dark:text-zinc-500 cursor-help" tabIndex={0} aria-label="Adres Nadawcy" />
                        </Tooltip>
                    </div>
                    <div className="text-zinc-900 dark:text-zinc-100 font-bold text-xs truncate">
                        {statusData?.from_address || 'N/A'}
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 truncate">
                        {statusData?.from_name || 'FinBoard Deal Advisory'}
                    </div>
                </div>

                <div className="p-3 bg-white dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded shadow-xs">
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Gniazdo TCP (Socket)</span>
                        <Tooltip content="Czas odpowiedzi na sondowanie gniazda TCP serwera SMTP">
                            <Clock className="w-3 h-3 text-zinc-400 dark:text-zinc-500 cursor-help" tabIndex={0} aria-label="Gniazdo TCP" />
                        </Tooltip>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {isConnected ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                        )}
                        <span className={`font-bold text-xs ${isConnected ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                            {isConnected ? `POŁĄCZONO (${socketLatency ?? 0} ms)` : 'BŁĄD POŁĄCZENIA'}
                        </span>
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                        Timeout socketu: {statusData?.timeout ?? 5}s
                    </div>
                </div>
            </div>

            {/* Diagnostic Terminal Output / Banner */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                <div className="flex items-center gap-2 mb-2 text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    <Terminal className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
                    <span>Odpowiedź Powitalna Serwera (SMTP Banner & Diagnoza)</span>
                    <InfoTooltip
                        content="Baner powitalny zwracany przez serwer SMTP po nawiązaniu połączenia TCP (kod 220). Umożliwia identyfikację silnika pocztowego (np. Postfix, Exim, Exchange)."
                        ariaLabel="Informacje o banerze SMTP"
                        size="xs"
                    />
                </div>
                <div className="p-2.5 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] font-mono text-zinc-800 dark:text-zinc-300 overflow-x-auto">
                    {socketBanner ? (
                        <span className="text-emerald-600 dark:text-emerald-400">{socketBanner}</span>
                    ) : socketError ? (
                        <span className="text-rose-600 dark:text-rose-400">{socketError}</span>
                    ) : (
                        <span className="text-zinc-400 dark:text-zinc-600">Brak zarejestrowanej odpowiedzi powitalnej węzła SMTP.</span>
                    )}
                </div>
            </div>
        </div>
    );
};
