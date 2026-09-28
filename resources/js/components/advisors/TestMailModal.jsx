import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { Button } from '../ui/Button';
import { Tooltip, InfoTooltip } from '../ui/Tooltip';
import {
    X,
    Mail,
    Send,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Clock,
    Server,
    ShieldAlert
} from 'lucide-react';

export const TestMailModal = ({
    isOpen,
    onClose,
    onSuccess
}) => {
    const { user: currentUser } = useAuth();
    const { success, error } = useNotification();

    const [recipient, setRecipient] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [validationError, setValidationError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setRecipient(currentUser?.email || '');
            setTestResult(null);
            setValidationError('');
        }
    }, [isOpen, currentUser]);

    if (!isOpen) return null;

    const handleSendTest = async (e) => {
        e?.preventDefault();
        setValidationError('');

        const cleanEmail = recipient.trim();
        if (!cleanEmail) {
            setValidationError('Adres e-mail odbiorcy jest wymagany.');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
            setValidationError('Wprowadzono niepoprawny format adresu e-mail.');
            return;
        }

        setSubmitting(true);
        setTestResult(null);

        try {
            const res = await apiClient.post('/admin/mail/test', {
                recipient: cleanEmail,
            });

            const data = res.data;
            if (data.status === 'success') {
                const resultObj = {
                    success: true,
                    message: data.message || `Wiadomość testowa została pomyślnie wysłana do: ${cleanEmail}.`,
                    latency_ms: data.latency_ms ?? null,
                };
                setTestResult(resultObj);
                success(`Email testowy został wysłany do ${cleanEmail} (${data.latency_ms ?? 0} ms).`);
                if (onSuccess) onSuccess(resultObj);
            } else {
                const resultObj = {
                    success: false,
                    message: data.message || 'Nie udało się nawiązać połączenia z serwerem pocztowym SMTP.',
                    latency_ms: data.latency_ms ?? null,
                };
                setTestResult(resultObj);
                error(resultObj.message);
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Błąd podczas wysyłania wiadomości testowej.';
            const latencyMs = err.response?.data?.latency_ms ?? null;
            const resultObj = {
                success: false,
                message: errorMsg,
                latency_ms: latencyMs,
            };
            setTestResult(resultObj);
            error(errorMsg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 dark:bg-zinc-950/80 backdrop-blur-xs font-mono">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="px-5 py-3.5 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                        <Tooltip content="Wysyłka testowa i badanie opóźnienia transportu pocztowego SMTP">
                            <div
                                tabIndex={0}
                                role="img"
                                aria-label="Diagnostyka połączenia SMTP"
                                className="w-7 h-7 rounded bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-700/60 flex items-center justify-center text-blue-600 dark:text-blue-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                            >
                                <Send className="w-4 h-4" />
                            </div>
                        </Tooltip>
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                                Diagnostyka Połączenia SMTP
                            </h2>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                TEST TRANSPORTU POCZTY & HANDSHAKE TLS/SSL
                            </p>
                        </div>
                    </div>
                    <Tooltip content="Zamknij (Esc)">
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                            title="Zamknij"
                            aria-label="Zamknij okno testu SMTP"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </Tooltip>
                </div>

                {/* Modal Body */}
                <form onSubmit={handleSendTest} noValidate className="p-5 space-y-4 overflow-y-auto">
                    <div className="p-3 rounded bg-zinc-50 dark:bg-zinc-850/70 border border-zinc-200 dark:border-zinc-750/70 flex items-start gap-2.5">
                        <Server className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0 mt-0.5" />
                        <div className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-relaxed flex-1">
                            Narzędzie wykonuje autentyczny handshake z serwerem pocztowym (TLS port 587 lub SSL port 465), autoryzuje poświadczenia i wysyła szablon diagnostyczny Deal Advisory z pomiarem opóźnienia.
                        </div>
                        <InfoTooltip
                            content="Wysyłka testowa pozwala potwierdzić, że serwer docelowy nie odrzuca wiadomości ze względu na brak rekordów SPF/DKIM lub niewłaściwy certyfikat SSL."
                            ariaLabel="Szczegóły o teście SMTP"
                            size="xs"
                        />
                    </div>

                    {/* Email Input */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                                Adres E-mail Odbiorcy Testu <span className="text-rose-600 dark:text-rose-400">*</span>
                            </label>
                            <InfoTooltip
                                content="Wpisz adres e-mail, na który ma dotrzeć testowy pakiet weryfikacyjny Deal Advisory."
                                ariaLabel="Informacje o odbiorcy testu"
                                size="xs"
                            />
                        </div>
                        <div className="relative">
                            <Mail className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="email"
                                autoFocus
                                value={recipient}
                                onChange={(e) => {
                                    setRecipient(e.target.value);
                                    if (validationError) setValidationError('');
                                }}
                                placeholder="np. admin@helvest.com"
                                className={`w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-zinc-950 border rounded text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-brand ${
                                    validationError ? 'border-rose-500' : 'border-zinc-300 dark:border-zinc-800'
                                }`}
                                disabled={submitting}
                            />
                        </div>
                        {validationError && (
                            <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1">{validationError}</p>
                        )}
                    </div>

                    {/* Test Result Display */}
                    {testResult && (
                        <div
                            className={`p-3 rounded border text-xs space-y-2 animate-in fade-in duration-150 ${
                                testResult.success
                                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                                    : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-500/40 text-rose-800 dark:text-rose-300'
                            }`}
                        >
                            <div className="flex items-start gap-2.5">
                                {testResult.success ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                ) : (
                                    <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                                )}
                                <div className="space-y-1 flex-1">
                                    <div className="font-semibold text-xs">
                                        {testResult.success ? 'Wysyłka Zakończona Sukcesem' : 'Błąd Dostarczenia Wiadomości'}
                                    </div>
                                    <div className="text-[11px] opacity-90 break-words font-mono">
                                        {testResult.message}
                                    </div>
                                    {testResult.latency_ms !== null && (
                                        <div className="flex items-center gap-1.5 text-[10px] font-mono mt-1 text-zinc-500 dark:text-zinc-400">
                                            <Clock className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
                                            <span>Czas odpowiedzi transportu: <strong className="text-zinc-800 dark:text-zinc-200">{testResult.latency_ms} ms</strong></span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {!testResult.success && (
                                <div className="mt-2 pt-2 border-t border-rose-200 dark:border-rose-500/20 text-[10px] text-rose-700 dark:text-rose-300/80 flex items-start gap-1.5">
                                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                                    <span>
                                        Wskazówka: W środowisku chmurowym (Oracle Cloud OCI) upewnij się, że port 25 nie jest używany (jest blokowany przez OCI) oraz że Security List zezwala na ruch wychodzący TCP dla portu 587 / 465.
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                        <Tooltip content="Zamknij okno diagnostyki SMTP">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={onClose}
                                disabled={submitting}
                                aria-label="Zamknij"
                            >
                                Zamknij
                            </Button>
                        </Tooltip>
                        <Tooltip content="Rozpocznij próbę doręczenia wiadomości testowej">
                            <span>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="sm"
                                    icon={Send}
                                    loading={submitting}
                                    disabled={submitting}
                                    aria-label="Wyślij Email Testowy"
                                >
                                    {submitting ? 'Nawiązywanie połączenia...' : 'Wyślij Email Testowy'}
                                </Button>
                            </span>
                        </Tooltip>
                    </div>
                </form>
            </div>
        </div>
    );
};
