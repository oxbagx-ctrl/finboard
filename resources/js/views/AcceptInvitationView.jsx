import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ROUTES } from '../constants/routes';
import {
    ShieldCheck,
    Lock,
    User,
    Mail,
    Building2,
    Calendar,
    AlertCircle,
    CheckCircle2,
    Eye,
    EyeOff,
    Check,
    X,
    LogIn
} from 'lucide-react';

export const AcceptInvitationView = ({ token: initialToken = null, onNavigateLogin }) => {
    const { login } = useAuth();
    const { success, error } = useNotification();

    let navigate = null;
    try {
        navigate = useNavigate();
    } catch {
        navigate = (to) => {
            if (typeof window !== 'undefined' && typeof to === 'string') {
                window.location.href = to;
            }
        };
    }

    let routeParams = {};
    try {
        routeParams = useParams() || {};
    } catch {
        routeParams = {};
    }

    let searchParams = null;
    try {
        const [sp] = useSearchParams();
        searchParams = sp;
    } catch {
        searchParams = null;
    }

    // Resolve token from prop, route params (:token), search params (?token=...) or fallback path
    const resolvedToken = useMemo(() => {
        if (initialToken) return initialToken;
        if (routeParams?.token) return routeParams.token.trim();
        const searchToken = searchParams?.get('token');
        if (searchToken) return searchToken.trim();

        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const tokenParam = urlParams.get('token');
            if (tokenParam) return tokenParam.trim();

            const pathParts = window.location.pathname.split('/');
            const tokenIndex = pathParts.indexOf('tokens');
            if (tokenIndex !== -1 && pathParts[tokenIndex + 1]) {
                return pathParts[tokenIndex + 1].trim();
            }
        }
        return '';
    }, [initialToken, routeParams, searchParams]);

    const [verifying, setVerifying] = useState(true);
    const [verificationError, setVerificationError] = useState(null);
    const [invitationData, setInvitationData] = useState(null);

    // Form fields
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);

    const [submitting, setSubmitting] = useState(false);
    const [validationErrors, setValidationErrors] = useState({});
    const [activationSuccess, setActivationSuccess] = useState(false);

    // Verify token on mount or token change
    useEffect(() => {
        let isMounted = true;

        const verifyInvitationToken = async () => {
            if (!resolvedToken) {
                setVerificationError('Brak tokenu zaproszenia w adresie URL. Upewnij się, że skopiowano pełny link z wiadomości e-mail.');
                setVerifying(false);
                return;
            }

            setVerifying(true);
            setVerificationError(null);

            try {
                const response = await apiClient.get('/invitations/verify', {
                    params: { token: resolvedToken }
                });

                if (isMounted) {
                    setInvitationData(response.data);
                }
            } catch (err) {
                if (isMounted) {
                    const msg = err.response?.data?.message || 'Nie udało się zweryfikować tokenu zaproszenia. Link może być nieprawidłowy lub wygasł.';
                    setVerificationError(msg);
                }
            } finally {
                if (isMounted) {
                    setVerifying(false);
                }
            }
        };

        verifyInvitationToken();

        return () => {
            isMounted = false;
        };
    }, [resolvedToken]);

    // Password criteria indicators
    const passwordChecks = useMemo(() => {
        const hasMinLength = password.length >= 8;
        const hasUpper = /[A-Z]/.test(password);
        const hasDigitOrSpecial = /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
        const matchesConfirmation = password.length > 0 && password === passwordConfirmation;

        const score = [hasMinLength, hasUpper, hasDigitOrSpecial].filter(Boolean).length;

        let strengthLabel = 'Wymagane hasło';
        let strengthColor = 'bg-zinc-700';
        let strengthWidth = 'w-0';

        if (password.length > 0) {
            if (score <= 1) {
                strengthLabel = 'Słabe';
                strengthColor = 'bg-rose-500';
                strengthWidth = 'w-1/3';
            } else if (score === 2) {
                strengthLabel = 'Średnie';
                strengthColor = 'bg-amber-500';
                strengthWidth = 'w-2/3';
            } else if (score === 3) {
                strengthLabel = 'Silne';
                strengthColor = 'bg-emerald-500';
                strengthWidth = 'w-full';
            }
        }

        return {
            hasMinLength,
            hasUpper,
            hasDigitOrSpecial,
            matchesConfirmation,
            score,
            strengthLabel,
            strengthColor,
            strengthWidth
        };
    }, [password, passwordConfirmation]);

    const handleNavigateLogin = () => {
        if (typeof window !== 'undefined') {
            window.history.replaceState({}, document.title, ROUTES.LOGIN);
        }
        if (onNavigateLogin) {
            onNavigateLogin();
        } else if (navigate) {
            navigate(ROUTES.LOGIN, { replace: true });
        } else if (typeof window !== 'undefined') {
            window.location.href = ROUTES.LOGIN;
        }
    };

    const validateForm = () => {
        const errors = {};

        if (!name.trim()) {
            errors.name = 'Imię i nazwisko jest wymagane.';
        } else if (name.trim().length < 2) {
            errors.name = 'Imię i nazwisko musi zawierać co najmniej 2 znaki.';
        }

        if (!password) {
            errors.password = 'Hasło jest wymagane.';
        } else if (password.length < 8) {
            errors.password = 'Hasło musi zawierać co najmniej 8 znaków.';
        }

        if (!passwordConfirmation) {
            errors.password_confirmation = 'Potwierdzenie hasła jest wymagane.';
        } else if (password !== passwordConfirmation) {
            errors.password_confirmation = 'Hasła nie są identyczne.';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e) => {
        if (e && e.preventDefault) {
            e.preventDefault();
        }

        if (!validateForm()) {
            return;
        }

        setSubmitting(true);
        try {
            const response = await apiClient.post('/invitations/accept', {
                token: resolvedToken,
                name: name.trim(),
                password,
                password_confirmation: passwordConfirmation,
            });

            const data = response.data;
            setActivationSuccess(true);
            success(data.message || 'Konto zostało pomyślnie aktywowane!');

            // Clean URL query parameters
            if (typeof window !== 'undefined') {
                window.history.replaceState({}, document.title, ROUTES.DASHBOARD);
            }

            // Automatically log in user and transition to main app
            setTimeout(() => {
                login(data.token, data.user, data.available_companies || []);
                if (navigate) {
                    navigate(ROUTES.DASHBOARD, { replace: true });
                }
            }, 800);
        } catch (err) {
            const resData = err.response?.data;
            if (resData?.errors) {
                const serverErrors = {};
                for (const key in resData.errors) {
                    serverErrors[key] = resData.errors[key][0];
                }
                setValidationErrors(serverErrors);
            } else {
                const msg = resData?.message || 'Wystąpił błąd podczas aktywacji konta.';
                error(msg);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const formatExpiryDate = (isoString) => {
        if (!isoString) return 'Brak informacji';
        try {
            const d = new Date(isoString);
            return `${d.toLocaleDateString('pl-PL')} ${d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })} UTC`;
        } catch (e) {
            return isoString;
        }
    };

    const roleBadge = useMemo(() => {
        if (!invitationData?.role) return null;
        switch (invitationData.role) {
            case 'super_admin':
                return <Badge variant="purple" size="md">SUPER ADMIN (PARTNER)</Badge>;
            case 'advisor':
                return <Badge variant="brand" size="md">DORADCA M&A (ADVISOR)</Badge>;
            case 'client':
            default:
                return <Badge variant="default" size="md">KLIENT / CFO</Badge>;
        }
    }, [invitationData?.role]);

    return (
        <div className="dark min-h-screen bg-zinc-950 flex flex-col justify-between py-8 px-4 sm:px-6 lg:px-8 font-sans text-zinc-100">
            {/* Top Institutional Header */}
            <div className="w-full max-w-5xl mx-auto flex items-center justify-between pb-6 border-b border-zinc-800/80 text-xs text-zinc-400">
                <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="font-mono font-semibold text-zinc-300">FINBOARD TERMINAL</span>
                    <span className="text-zinc-600">|</span>
                    <span className="font-mono text-zinc-400">AKTYWACJA KONTA DEAL ADVISORY</span>
                </div>
                <div className="flex items-center gap-4 font-mono text-[11px]">
                    <span className="text-zinc-500">ZERO-TRUST PROTOCOL</span>
                    <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">TLS 1.3 / AES-256</span>
                </div>
            </div>

            {/* Central Content Area */}
            <div className="my-auto w-full max-w-lg mx-auto">
                {/* Brand Title */}
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-zinc-900 border border-zinc-700/80 text-zinc-100 font-bold text-xl mb-3 tracking-tighter shadow-lg font-mono">
                        FB
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-zinc-100">
                        Inicjalizacja Konta & Ustanowienie Hasła
                    </h1>
                    <p className="mt-1 text-xs text-zinc-400 font-mono">
                        Bezpieczna konfiguracja profilu w modelu Zero-Trust
                    </p>
                </div>

                {/* State: Verifying */}
                {verifying && (
                    <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-8 shadow-2xl text-center font-mono">
                        <div className="w-8 h-8 mx-auto mb-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></div>
                        <div className="text-xs text-zinc-300 uppercase tracking-wider">
                            Weryfikacja kryptograficznego tokenu zaproszenia...
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-2">
                            Sprawdzanie stanu uprawnień i terminu ważności
                        </p>
                    </div>
                )}

                {/* State: Verification Error */}
                {!verifying && verificationError && (
                    <div className="bg-zinc-900/90 border border-rose-900/70 rounded-lg p-7 shadow-2xl font-mono">
                        <div className="flex items-start gap-3.5 mb-5">
                            <div className="w-9 h-9 rounded bg-rose-950/80 border border-rose-800 flex items-center justify-center text-rose-400 shrink-0">
                                <AlertCircle className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-rose-300 uppercase tracking-wide">
                                    Nieprawidłowe lub wygasłe zaproszenie
                                </h2>
                                <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                                    {verificationError}
                                </p>
                            </div>
                        </div>

                        <div className="p-3 bg-zinc-950 border border-zinc-800 rounded text-[11px] text-zinc-400 leading-relaxed mb-5">
                            Jeżeli uważasz, że to błąd, skontaktuj się ze swoim doradcą M&A lub administratorem platformy FinBoard w celu wygenerowania nowego odnośnika.
                        </div>

                        <div className="flex justify-end">
                            <Button
                                variant="primary"
                                size="md"
                                icon={LogIn}
                                onClick={handleNavigateLogin}
                            >
                                Przejdź do strony logowania
                            </Button>
                        </div>
                    </div>
                )}

                {/* State: Activation Successful Banner */}
                {!verifying && activationSuccess && (
                    <div className="bg-zinc-900/90 border border-emerald-800/80 rounded-lg p-8 shadow-2xl text-center font-mono animate-in fade-in zoom-in-95 duration-200">
                        <div className="w-12 h-12 rounded-full bg-emerald-950/80 border border-emerald-700 flex items-center justify-center text-emerald-400 mx-auto mb-4">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-300 mb-2">
                            Konto Zostało Pomyślnie Aktywowane!
                        </h2>
                        <p className="text-xs text-zinc-300 mb-4">
                            Hasło zostało zapisane z solonym hashem argon2id/bcrypt. Następuje automatyczne logowanie do terminala Deal Advisory...
                        </p>
                        <div className="w-6 h-6 mx-auto border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}

                {/* State: Verified Invitation Form */}
                {!verifying && !verificationError && !activationSuccess && invitationData && (
                    <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-6 sm:p-7 shadow-2xl">
                        {/* Invitation Context Summary Box */}
                        <div className="bg-zinc-950 border border-zinc-800 rounded p-4 mb-5 font-mono space-y-2.5">
                            <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                                <span className="text-[10px] uppercase text-zinc-500">Adres zaproszenia</span>
                                <div className="flex items-center gap-1.5 text-xs text-zinc-200">
                                    <Mail className="w-3.5 h-3.5 text-zinc-400" />
                                    <span className="font-semibold">{invitationData.email}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                                <span className="text-[10px] uppercase text-zinc-500">Nadana rola</span>
                                <div>{roleBadge}</div>
                            </div>

                            {/* Company context for Client */}
                            {invitationData.company && (
                                <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                                    <span className="text-[10px] uppercase text-zinc-500">Spółka portfelowa</span>
                                    <div className="flex items-center gap-1.5 text-xs text-zinc-200 truncate max-w-[260px]">
                                        <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                        <span className="truncate">
                                            [{invitationData.company.code}] {invitationData.company.name}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Assigned companies for Advisor */}
                            {invitationData.assigned_companies && invitationData.assigned_companies.length > 0 && (
                                <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                                    <span className="text-[10px] uppercase text-zinc-500">Przypisane spółki</span>
                                    <span className="text-xs text-zinc-200 font-semibold">
                                        {invitationData.assigned_companies.length} {invitationData.assigned_companies.length === 1 ? 'spółka' : 'spółki'}
                                    </span>
                                </div>
                            )}

                            <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-0.5">
                                <div className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-zinc-600" />
                                    <span>Ważność tokenu do:</span>
                                </div>
                                <span className="text-zinc-400 font-mono">
                                    {formatExpiryDate(invitationData.expires_at)}
                                </span>
                            </div>
                        </div>

                        {/* Setup Form */}
                        <form onSubmit={handleSubmit} noValidate className="space-y-4">
                            {/* Full Name */}
                            <div>
                                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 font-mono">
                                    Imię i Nazwisko <span className="text-rose-400">*</span>
                                </label>
                                <div className="relative">
                                    <User className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        autoFocus
                                        required
                                        value={name}
                                        onChange={(e) => {
                                            setName(e.target.value);
                                            if (validationErrors.name) {
                                                setValidationErrors(prev => ({ ...prev, name: null }));
                                            }
                                        }}
                                        placeholder="Jan Kowalski"
                                        className={`w-full bg-zinc-950 border ${
                                            validationErrors.name ? 'border-rose-500' : 'border-zinc-700/80'
                                        } rounded-md pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors font-mono`}
                                    />
                                </div>
                                {validationErrors.name && (
                                    <p className="text-[10px] text-rose-400 mt-1 font-mono">{validationErrors.name}</p>
                                )}
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 font-mono">
                                    Nowe Hasło <span className="text-rose-400">*</span>
                                </label>
                                <div className="relative">
                                    <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={(e) => {
                                            setPassword(e.target.value);
                                            if (validationErrors.password) {
                                                setValidationErrors(prev => ({ ...prev, password: null }));
                                            }
                                        }}
                                        placeholder="••••••••••••"
                                        className={`w-full bg-zinc-950 border ${
                                            validationErrors.password ? 'border-rose-500' : 'border-zinc-700/80'
                                        } rounded-md pl-9 pr-10 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors font-mono`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                                        title={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {validationErrors.password && (
                                    <p className="text-[10px] text-rose-400 mt-1 font-mono">{validationErrors.password}</p>
                                )}
                            </div>

                            {/* Password Confirmation */}
                            <div>
                                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 font-mono">
                                    Powtórz Nowe Hasło <span className="text-rose-400">*</span>
                                </label>
                                <div className="relative">
                                    <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type={showPasswordConfirmation ? 'text' : 'password'}
                                        required
                                        value={passwordConfirmation}
                                        onChange={(e) => {
                                            setPasswordConfirmation(e.target.value);
                                            if (validationErrors.password_confirmation) {
                                                setValidationErrors(prev => ({ ...prev, password_confirmation: null }));
                                            }
                                        }}
                                        placeholder="••••••••••••"
                                        className={`w-full bg-zinc-950 border ${
                                            validationErrors.password_confirmation ? 'border-rose-500' : 'border-zinc-700/80'
                                        } rounded-md pl-9 pr-10 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors font-mono`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswordConfirmation(!showPasswordConfirmation)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                                        title={showPasswordConfirmation ? 'Ukryj hasło' : 'Pokaż hasło'}
                                    >
                                        {showPasswordConfirmation ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {validationErrors.password_confirmation && (
                                    <p className="text-[10px] text-rose-400 mt-1 font-mono">{validationErrors.password_confirmation}</p>
                                )}
                            </div>

                            {/* Password Security Checklist & Strength Meter */}
                            <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-2 font-mono text-[11px]">
                                <div className="flex items-center justify-between text-zinc-400">
                                    <span>Siła hasła:</span>
                                    <span className="font-semibold text-zinc-200">{passwordChecks.strengthLabel}</span>
                                </div>
                                <div className="w-full bg-zinc-800 h-1.5 rounded overflow-hidden">
                                    <div className={`h-full transition-all duration-300 ${passwordChecks.strengthColor} ${passwordChecks.strengthWidth}`}></div>
                                </div>

                                <div className="pt-1.5 space-y-1 text-[10px]">
                                    <div className="flex items-center gap-1.5">
                                        {passwordChecks.hasMinLength ? (
                                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                                        ) : (
                                            <X className="w-3.5 h-3.5 text-zinc-600" />
                                        )}
                                        <span className={passwordChecks.hasMinLength ? 'text-zinc-300' : 'text-zinc-500'}>
                                            Minimum 8 znaków
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {passwordChecks.hasUpper ? (
                                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                                        ) : (
                                            <X className="w-3.5 h-3.5 text-zinc-600" />
                                        )}
                                        <span className={passwordChecks.hasUpper ? 'text-zinc-300' : 'text-zinc-500'}>
                                            Co najmniej jedna wielka litera (A-Z)
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {passwordChecks.hasDigitOrSpecial ? (
                                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                                        ) : (
                                            <X className="w-3.5 h-3.5 text-zinc-600" />
                                        )}
                                        <span className={passwordChecks.hasDigitOrSpecial ? 'text-zinc-300' : 'text-zinc-500'}>
                                            Cyfra lub znak specjalny
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {passwordChecks.matchesConfirmation ? (
                                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                                        ) : (
                                            <X className="w-3.5 h-3.5 text-zinc-600" />
                                        )}
                                        <span className={passwordChecks.matchesConfirmation ? 'text-zinc-300' : 'text-zinc-500'}>
                                            Hasła są identyczne
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <div className="pt-2">
                                <Button
                                    type="submit"
                                    loading={submitting}
                                    icon={ShieldCheck}
                                    variant="primary"
                                    className="w-full py-2.5 text-xs font-bold uppercase tracking-wider bg-zinc-100 hover:bg-white text-zinc-950 border border-zinc-200 shadow-md hover:shadow-lg transition-all focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 focus:ring-offset-zinc-900 cursor-pointer"
                                >
                                    Aktywuj Konto i Zaloguj
                                </Button>
                            </div>

                            <div className="text-center pt-2">
                                <button
                                    type="button"
                                    onClick={handleNavigateLogin}
                                    className="text-[11px] text-zinc-400 hover:text-zinc-200 underline font-mono cursor-pointer"
                                >
                                    Posiadasz już aktywne hasło? Przejdź do logowania
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="mt-6 text-center">
                    <p className="text-[11px] text-zinc-500 leading-relaxed font-mono">
                        Dostęp wyłącznie dla upoważnionego personelu doradczego i zarządów spółek. Wszystkie operacje są audytowane.
                    </p>
                </div>
            </div>

            {/* Bottom corporate footer */}
            <div className="w-full max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-zinc-800/80 text-[11px] text-zinc-500 font-mono gap-2">
                <div>FinBoard Sp. z o.o. © 2026. Wszelkie prawa zastrzeżone.</div>
                <div className="flex items-center gap-3">
                    <span>SECURITY POLICY</span>
                    <span>•</span>
                    <span>AUDIT TRAIL COMPLIANT</span>
                </div>
            </div>
        </div>
    );
};
