import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/client';
import { useNotification } from '../../context/NotificationContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
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
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-2.5">
                    <div className={`w-6 h-6 rounded flex items-center justify-center border ${
                        isConnected
                            ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-400'
                            : 'bg-rose-950/60 border-rose-700/60 text-rose-400'
                    }`}>
                        {isConnected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-zinc-300 font-semibold">SMTP:</span>
                        <span className="text-zinc-400 font-mono">
                            {statusData ? `${statusData.host}:${statusData.port}` : 'Ładowanie...'}
                        </span>
                        {statusData && (
                            <Badge variant={isConnected ? 'success' : 'danger'} size="sm">
                                {isConnected ? `ONLINE (${socketLatency ?? 0}ms)` : 'OFFLINE'}
                            </Badge>
                        )}
                        {isPort25 && (
                            <Badge variant="warning" size="sm">PORT 25 (OCI BLOCKED)</Badge>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        icon={RotateCw}
                        onClick={fetchStatus}
                        disabled={loading}
                        loading={loading}
                        title="Odśwież stan połączenia SMTP"
                    >
                        Odśwież
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={Send}
                        onClick={onOpenTestModal}
                    >
                        Testuj SMTP
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden font-mono text-xs">
            {/* Widget Header */}
            <div className="p-4 bg-zinc-950 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-zinc-850 border border-zinc-750 flex items-center justify-center text-zinc-300">
                        <Server className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-100 text-xs uppercase tracking-wider">
                                Węzeł Poczty Transakcyjnej (SMTP)
                            </span>
                            <Badge variant={isConnected ? 'success' : 'danger'} size="sm">
                                {loading ? 'BADANIE...' : isConnected ? 'POŁĄCZENIE AKTYWNE' : 'BRAK POŁĄCZENIA'}
                            </Badge>
                            {statusData?.is_secure_port && (
                                <Badge variant="purple" size="sm">PORT SZYFROWANY ({statusData.port})</Badge>
                            )}
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                            TRANSPORTER EMAIL DLA ZAPROSZEŃ I POWIADOMIEŃ SYSTEMOWYCH FINBOARD
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        icon={RotateCw}
                        onClick={fetchStatus}
                        disabled={loading}
                        loading={loading}
                    >
                        Sprawdź Port
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        icon={Send}
                        onClick={onOpenTestModal}
                    >
                        Wyślij Test SMTP
                    </Button>
                </div>
            </div>

            {/* Port 25 Warning Banner */}
            {isPort25 && (
                <div className="p-3 bg-amber-950/40 border-b border-amber-800/60 text-amber-300 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-[11px] leading-relaxed">
                        <strong className="text-amber-200">Uwaga: Wykryto port 25. </strong>
                        W środowiskach chmurowych (np. Oracle Cloud Infrastructure OCI) port 25 jest domyślnie blokowany przez dostawcę w celu ochrony przed spamem. Dla niezawodnej wysyłki zaproszeń zaleca się przełączenie na port <strong>587 (TLS)</strong> lub <strong>465 (SSL)</strong> w pliku <code>.env</code>.
                    </div>
                </div>
            )}

            {/* Main Configuration Grid */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 bg-zinc-900/50">
                <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded">
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Serwer & Port</span>
                        <Server className="w-3 h-3 text-zinc-500" />
                    </div>
                    <div className="text-zinc-100 font-bold text-xs truncate">
                        {statusData?.host || 'N/A'}:{statusData?.port || 'N/A'}
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-zinc-500" />
                        <span>Szyfrowanie: <strong className="text-zinc-300 uppercase">{statusData?.encryption || 'BRAK'}</strong></span>
                    </div>
                </div>

                <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded">
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Autoryzacja SMTP</span>
                        <ShieldCheck className="w-3 h-3 text-zinc-500" />
                    </div>
                    <div className="text-zinc-100 font-bold text-xs truncate">
                        {statusData?.username || 'Brak autoryzacji'}
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-1">
                        Hasło: <strong className={statusData?.has_password ? 'text-emerald-400' : 'text-zinc-500'}>
                            {statusData?.has_password ? 'USTAWIONE' : 'BRAK'}
                        </strong>
                    </div>
                </div>

                <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded">
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Adres Nadawcy</span>
                        <Mail className="w-3 h-3 text-zinc-500" />
                    </div>
                    <div className="text-zinc-100 font-bold text-xs truncate">
                        {statusData?.from_address || 'N/A'}
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-1 truncate">
                        {statusData?.from_name || 'FinBoard Deal Advisory'}
                    </div>
                </div>

                <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded">
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Gniazdo TCP (Socket)</span>
                        <Clock className="w-3 h-3 text-zinc-500" />
                    </div>
                    <div className="flex items-center gap-1.5">
                        {isConnected ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                        )}
                        <span className={`font-bold text-xs ${isConnected ? 'text-emerald-300' : 'text-rose-300'}`}>
                            {isConnected ? `POŁĄCZONO (${socketLatency ?? 0} ms)` : 'BŁĄD POŁĄCZENIA'}
                        </span>
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1">
                        Timeout socketu: {statusData?.timeout ?? 5}s
                    </div>
                </div>
            </div>

            {/* Diagnostic Terminal Output / Banner */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-950">
                <div className="flex items-center gap-2 mb-2 text-[10px] text-zinc-500 uppercase tracking-wider">
                    <Terminal className="w-3 h-3 text-zinc-400" />
                    <span>Odpowiedź Powitalna Serwera (SMTP Banner & Diagnoza)</span>
                </div>
                <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-300 overflow-x-auto">
                    {socketBanner ? (
                        <span className="text-emerald-400">{socketBanner}</span>
                    ) : socketError ? (
                        <span className="text-rose-400">{socketError}</span>
                    ) : (
                        <span className="text-zinc-600">Brak zarejestrowanej odpowiedzi powitalnej węzła SMTP.</span>
                    )}
                </div>
            </div>
        </div>
    );
};
