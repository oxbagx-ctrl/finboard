import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Tooltip, InfoTooltip } from '../ui/Tooltip';
import {
    X,
    UserPlus,
    Mail,
    Building2,
    Shield,
    Clock,
    Search,
    CheckSquare,
    Square,
    Info,
    CheckCircle2
} from 'lucide-react';

export const InviteUserModal = ({
    isOpen,
    onClose,
    onSuccess,
    defaultRole = 'client',
    defaultCompanyId = null,
    companies: propCompanies = null,
}) => {
    const { user: currentUser, isAdmin, isSuperAdmin, isAdvisor, activeCompany, availableCompanies } = useAuth();
    const { success, error } = useNotification();

    const [email, setEmail] = useState('');
    const [role, setRole] = useState(defaultRole);
    const [companyId, setCompanyId] = useState(defaultCompanyId || activeCompany?.id || '');
    const [assignedCompanyIds, setAssCompanyIds] = useState([]);
    const [validityHours, setValidityHours] = useState(48);
    const [companySearch, setCompanySearch] = useState('');
    const [allCompanies, setAllCompanies] = useState([]);
    const [loadingCompanies, setLoadingCompanies] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [validationErrors, setValidationErrors] = useState({});

    const canAccessAllCompanies = isSuperAdmin || isAdmin || !isAdvisor;

    // Reactively update selectable companies when propCompanies changes
    useEffect(() => {
        if (propCompanies && propCompanies.length > 0) {
            setAllCompanies(propCompanies);
        }
    }, [propCompanies]);

    // Listen to global company-created event for instant cross-component updates
    useEffect(() => {
        const handleCompanyCreated = (e) => {
            if (e?.detail) {
                setAllCompanies(prev => {
                    if (prev.some(c => c.id === e.detail.id)) return prev;
                    return [e.detail, ...prev];
                });
            }
            if (canAccessAllCompanies) {
                fetchAllCompanies();
            }
        };

        window.addEventListener("finboard:company-created", handleCompanyCreated);
        return () => window.removeEventListener("finboard:company-created", handleCompanyCreated);
    }, [canAccessAllCompanies]);

    // Determine selectable companies:
    // Advisors can only invite clients to their assigned companies.
    // Admins and SuperAdmins can choose from all companies in the system.
    useEffect(() => {
        if (!isOpen) return;

        setEmail("");
        setRole(isAdvisor ? "client" : defaultRole);

        const initialCompanies = (propCompanies && propCompanies.length > 0)
            ? propCompanies
            : (availableCompanies || []);

        setCompanyId(
            defaultCompanyId ||
            activeCompany?.id ||
            initialCompanies[0]?.id ||
            ""
        );
        setAssCompanyIds([]);
        setValidityHours(48);
        setCompanySearch("");
        setValidationErrors({});

        if (initialCompanies.length > 0) {
            setAllCompanies(initialCompanies);
        }

        if (canAccessAllCompanies) {
            fetchAllCompanies();
        } else {
            setAllCompanies(initialCompanies);
        }
    }, [isOpen, defaultRole, defaultCompanyId, activeCompany, availableCompanies, isAdvisor, canAccessAllCompanies, propCompanies]);

    const fetchAllCompanies = async () => {
        setLoadingCompanies(true);
        try {
            const res = await apiClient.get("/admin/companies");
            const fetched = res.data.data || [];
            setAllCompanies(fetched);

            setCompanyId(prev => {
                if (defaultCompanyId) return defaultCompanyId;
                if (prev && fetched.some(c => c.id === prev)) return prev;
                if (activeCompany && fetched.some(c => c.id === activeCompany.id)) return activeCompany.id;
                return fetched[0]?.id || "";
            });
        } catch (err) {
            setAllCompanies(propCompanies || availableCompanies || []);
        } finally {
            setLoadingCompanies(false);
        }
    };

    const filteredAssignedCompanies = useMemo(() => {
        const query = companySearch.toLowerCase().trim();
        if (!query) return allCompanies;
        return allCompanies.filter(c =>
            c.name.toLowerCase().includes(query) ||
            c.code.toLowerCase().includes(query) ||
            (c.tax_id && c.tax_id.toLowerCase().includes(query))
        );
    }, [allCompanies, companySearch]);

    const toggleAssignedCompany = (cid) => {
        setAssCompanyIds(prev =>
            prev.includes(cid)
                ? prev.filter(id => id !== cid)
                : [...prev, cid]
        );
    };

    const handleSelectAllCompanies = () => {
        setAssCompanyIds(allCompanies.map(c => c.id));
    };

    const handleDeselectAllCompanies = () => {
        setAssCompanyIds([]);
    };

    const validateForm = () => {
        const errors = {};
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email.trim()) {
            errors.email = 'Adres e-mail jest wymagany.';
        } else if (!emailRegex.test(email.trim())) {
            errors.email = 'Wprowadź prawidłowy adres e-mail.';
        }

        if (role === 'client' && !companyId) {
            errors.company_id = 'Wybór spółki jest wymagany dla konta klienta.';
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
            const payload = {
                email: email.trim().toLowerCase(),
                role,
                validity_hours: Number(validityHours),
            };

            if (role === 'client') {
                payload.company_id = companyId;
            } else if (role === 'advisor') {
                payload.assigned_company_ids = assignedCompanyIds;
            }

            const response = await apiClient.post('/invitations', payload);
            const invitation = response.data.data;

            success(`Zaproszenie zostało pomyślnie wysłane na adres: ${invitation.email}`);
            if (onSuccess) {
                onSuccess(invitation);
            }
            onClose();
        } catch (err) {
            const resData = err.response?.data;
            if (resData?.errors) {
                const serverErrors = {};
                for (const key in resData.errors) {
                    serverErrors[key] = resData.errors[key][0];
                }
                setValidationErrors(serverErrors);
            } else {
                const msg = resData?.message || 'Wystąpił błąd podczas wysyłania zaproszenia.';
                error(msg);
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-xs font-mono">
            <div className="bg-zinc-900 border border-zinc-750 rounded-lg shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-5 py-3.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                        <Tooltip content="Generowanie zaproszenia i jednorazowego tokenu aktywacyjnego">
                            <div
                                tabIndex={0}
                                role="img"
                                aria-label="Zaproś nowego użytkownika"
                                className="w-7 h-7 rounded bg-zinc-850 border border-zinc-750 flex items-center justify-center text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                            >
                                <UserPlus className="w-4 h-4 text-emerald-400" />
                            </div>
                        </Tooltip>
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-100">
                                Zaproś Nowego Użytkownika
                            </h2>
                            <p className="text-[10px] text-zinc-500 mt-0.5">
                                BEZPIECZNA INICJALIZACJA KONTA PRZEZ JEDNORAZOWY TOKEN
                            </p>
                        </div>
                    </div>
                    <Tooltip content="Zamknij (Esc)">
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Zamknij"
                            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </Tooltip>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} noValidate className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* Security Info Notice */}
                    <div className="p-3 rounded bg-blue-950/30 border border-blue-800/60 flex items-start gap-2.5">
                        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                        <div className="text-[11px] text-zinc-300 leading-relaxed flex-1">
                            <span className="font-semibold text-blue-300">Zasada zerowego zaufania (Zero-Trust): </span>
                            Hasła nie są ustawiane ręcznie przez administratorów. Zaproszony użytkownik otrzyma szyfrowany link aktywacyjny, za pomocą którego samodzielnie ustawi silne hasło.
                        </div>
                        <InfoTooltip
                            content="Zero-Trust zapobiega przesyłaniu haseł w otwartym tekście przez administratorów. Użytkownik aktywuje konto przy użyciu kryptograficznego tokenu unieważnianego po jednorazowym użyciu lub upływie czasu ważności."
                            ariaLabel="Szczegóły o zasadzie zerowego zaufania"
                            size="xs"
                        />
                    </div>

                    {/* Email Input */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                                Adres E-mail Odbiorcy <span className="text-rose-400">*</span>
                            </label>
                            <InfoTooltip
                                content="Na ten adres e-mail system wyśle zaproszenie z bezpiecznym linkiem aktywacyjnym."
                                ariaLabel="Informacje o adresie e-mail odbiorcy"
                                size="xs"
                            />
                        </div>
                        <div className="relative">
                            <Mail className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="email"
                                autoFocus
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    if (validationErrors.email) {
                                        setValidationErrors(prev => ({ ...prev, email: null }));
                                    }
                                }}
                                placeholder="cfo@spolka-portfelowa.pl"
                                className={`w-full bg-zinc-950 border ${
                                    validationErrors.email ? 'border-rose-500' : 'border-zinc-750'
                                } rounded pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono`}
                            />
                        </div>
                        {validationErrors.email && (
                            <p className="text-[10px] text-rose-400 mt-1">{validationErrors.email}</p>
                        )}
                    </div>

                    {/* Role Selection */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                                Rola Systemowa & Uprawnienia <span className="text-rose-400">*</span>
                            </label>
                            <InfoTooltip
                                content="Wybierz poziom uprawnień w modelu RBAC. Klient widzi wyłącznie swoją spółkę, doradca wybrane spółki, a Super Admin zarządza całym portfelem."
                                ariaLabel="Informacje o rolach systemowych"
                                size="xs"
                            />
                        </div>
                        {isAdvisor ? (
                            <Tooltip content="Doradca może zapraszać wyłącznie użytkowników po stronie klienta do przypisanych sobie spółek">
                                <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="default" size="sm">KLIENT / CFO</Badge>
                                        <span className="text-xs text-zinc-300">Klient podmiotu portfelowego</span>
                                    </div>
                                    <span className="text-[10px] text-zinc-500 italic">Uprawnienia doradcy</span>
                                </div>
                            </Tooltip>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <Tooltip content="Dostęp ograniczony do wybranej pojedynczej spółki portfelowej (izolacja najemcy)">
                                    <button
                                        type="button"
                                        onClick={() => setRole('client')}
                                        aria-label="Rola: Klient / CFO (dostęp do 1 spółki)"
                                        className={`p-2.5 rounded text-left border transition-all cursor-pointer ${
                                            role === 'client'
                                                ? 'bg-zinc-800 border-zinc-600 text-zinc-100 shadow-xs'
                                                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                        }`}
                                    >
                                        <div className="text-xs font-bold text-zinc-200">Klient / CFO</div>
                                        <div className="text-[10px] text-zinc-500 mt-0.5">Dostęp do 1 spółki</div>
                                    </button>
                                </Tooltip>

                                <Tooltip content="Dostęp analityczny do wyznaczonych spółek portfelowych w procesach M&A">
                                    <button
                                        type="button"
                                        onClick={() => setRole('advisor')}
                                        aria-label="Rola: Doradca M&A (przypisane spółki)"
                                        className={`p-2.5 rounded text-left border transition-all cursor-pointer ${
                                            role === 'advisor'
                                                ? 'bg-zinc-800 border-zinc-600 text-zinc-100 shadow-xs'
                                                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                        }`}
                                    >
                                        <div className="text-xs font-bold text-zinc-200">Doradca M&A</div>
                                        <div className="text-[10px] text-zinc-500 mt-0.5">Przypisane spółki</div>
                                    </button>
                                </Tooltip>

                                <Tooltip content="Globalny dostęp administracyjny do wszystkich spółek i konfiguracji platformy">
                                    <button
                                        type="button"
                                        onClick={() => setRole('super_admin')}
                                        aria-label="Rola: Super Admin (globalny partner)"
                                        className={`p-2.5 rounded text-left border transition-all cursor-pointer ${
                                            role === 'super_admin'
                                                ? 'bg-zinc-800 border-zinc-600 text-zinc-100 shadow-xs'
                                                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                        }`}
                                    >
                                        <div className="text-xs font-bold text-zinc-200">Super Admin</div>
                                        <div className="text-[10px] text-zinc-500 mt-0.5">Globalny partner</div>
                                    </button>
                                </Tooltip>
                            </div>
                        )}
                    </div>

                    {/* Company Selection for Client Role */}
                    {role === 'client' && (
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                                    Przypisana Spółka Portfelowa <span className="text-rose-400">*</span>
                                </label>
                                <InfoTooltip
                                    content="Klient otrzyma dostęp wyłącznie do danych tej wybranej spółki. Pozostałe podmioty będą dla niego całkowicie niewidoczne."
                                    ariaLabel="Informacje o spółce klienta"
                                    size="xs"
                                />
                            </div>
                            <div className="relative">
                                <Building2 className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                <select
                                    value={companyId}
                                    onChange={(e) => {
                                        setCompanyId(e.target.value);
                                        if (validationErrors.company_id) {
                                            setValidationErrors(prev => ({ ...prev, company_id: null }));
                                        }
                                    }}
                                    className={`w-full bg-zinc-950 border ${
                                        validationErrors.company_id ? 'border-rose-500' : 'border-zinc-750'
                                    } rounded pl-9 pr-3 py-2 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono`}
                                >
                                    <option value="">-- Wybierz spółkę z rejestru --</option>
                                    {allCompanies.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            [{c.code}] {c.name} {c.tax_id ? `(NIP: ${c.tax_id})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {validationErrors.company_id && (
                                <p className="text-[10px] text-rose-400 mt-1">{validationErrors.company_id}</p>
                            )}
                            <p className="text-[10px] text-zinc-500 mt-1">
                                Klient otrzyma dostęp wyłącznie do wybranej powyżej spółki (Multi-Tenant Isolation).
                            </p>
                        </div>
                    )}

                    {/* Multi-Company Checklist for Advisor Role */}
                    {role === 'advisor' && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                                    Początkowe Przypisanie Spółek Portfelowych
                                </label>
                                <div className="flex items-center gap-2 text-[10px]">
                                    <Tooltip content="Zaznacz wszystkie spółki portfelowe">
                                        <button
                                            type="button"
                                            onClick={handleSelectAllCompanies}
                                            aria-label="Zaznacz wszystkie spółki"
                                            className="text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                                        >
                                            Wszystkie
                                        </button>
                                    </Tooltip>
                                    <span>•</span>
                                    <Tooltip content="Wyczyść zaznaczone spółki">
                                        <button
                                            type="button"
                                            onClick={handleDeselectAllCompanies}
                                            aria-label="Odznacz wszystkie spółki"
                                            className="text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                                        >
                                            Wyczyść
                                        </button>
                                    </Tooltip>
                                </div>
                            </div>

                            <div className="relative">
                                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={companySearch}
                                    onChange={(e) => setCompanySearch(e.target.value)}
                                    placeholder="Filtruj spółki..."
                                    className="w-full bg-zinc-950 border border-zinc-750 rounded pl-9 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                                />
                            </div>

                            <div className="max-h-40 overflow-y-auto space-y-1 p-2 bg-zinc-950/60 border border-zinc-800 rounded">
                                {filteredAssignedCompanies.length === 0 ? (
                                    <div className="py-4 text-center text-xs text-zinc-500">
                                        Brak spółek do wyboru.
                                    </div>
                                ) : (
                                    filteredAssignedCompanies.map((c) => {
                                        const isChecked = assignedCompanyIds.includes(c.id);
                                        return (
                                            <Tooltip
                                                key={c.id}
                                                content={isChecked
                                                    ? `Spółka ${c.name} jest wybrana. Kliknij, aby odznaczyć.`
                                                    : `Kliknij, aby przypisać spółkę ${c.name} do doradcy.`
                                                }
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => toggleAssignedCompany(c.id)}
                                                    aria-label={`${c.name} (${c.code}) - ${isChecked ? 'przypisana' : 'nieprzypisana'}`}
                                                    className={`w-full text-left p-2 rounded text-xs flex items-center justify-between cursor-pointer ${
                                                        isChecked
                                                            ? 'bg-zinc-800 text-zinc-100'
                                                            : 'hover:bg-zinc-900 text-zinc-400'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 truncate">
                                                        {isChecked ? (
                                                            <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                                        ) : (
                                                            <Square className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                                                        )}
                                                        <span className="font-semibold text-zinc-200">[{c.code}]</span>
                                                        <span className="truncate">{c.name}</span>
                                                    </div>
                                                    {isChecked && (
                                                        <Badge variant="success" size="sm">DODANA</Badge>
                                                    )}
                                                </button>
                                            </Tooltip>
                                        );
                                    })
                                )}
                            </div>
                            <div className="text-[10px] text-zinc-500">
                                Wybrano spółek dla doradcy: <span className="text-zinc-200 font-bold">{assignedCompanyIds.length}</span>
                            </div>
                        </div>
                    )}

                    {/* Global access notice for SuperAdmin role */}
                    {role === 'super_admin' && (
                        <div className="p-3 rounded bg-purple-950/30 border border-purple-800/60 text-[11px] text-purple-200 flex items-start gap-2">
                            <Shield className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                            <span>Rola Super Admin otrzymuje globalny dostęp do wszystkich spółek w systemie FinBoard oraz uprawnienia do zarządzania zespołem doradców.</span>
                        </div>
                    )}

                    {/* Validity Expiration Period */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                                Czas Ważności Tokenu Zaproszenia
                            </label>
                            <InfoTooltip
                                content="Po upływie zdefiniowanego czasu token aktywacyjny wygasa i użytkownik nie będzie mógł ustawić hasła bez ponownego zaproszenia."
                                ariaLabel="Informacje o czasie ważności tokenu zaproszenia"
                                size="xs"
                            />
                        </div>
                        <div className="relative">
                            <Clock className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <select
                                value={validityHours}
                                onChange={(e) => setValidityHours(Number(e.target.value))}
                                className="w-full bg-zinc-950 border border-zinc-750 rounded pl-9 pr-3 py-2 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                            >
                                <option value={24}>24 godziny (1 dzień)</option>
                                <option value={48}>48 godzin (Domyślnie - 2 dni)</option>
                                <option value={72}>72 godziny (3 dni)</option>
                                <option value={168}>168 godzin (7 dni)</option>
                            </select>
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-1">
                            Po upływie tego czasu link aktywacyjny wygaśnie i wymagane będzie ponowne przesłanie zaproszenia.
                        </p>
                    </div>

                    {/* Footer buttons */}
                    <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
                        <Tooltip content="Anuluj i zamknij okno zaproszenia">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={onClose}
                                disabled={submitting}
                                aria-label="Anuluj"
                            >
                                Anuluj
                            </Button>
                        </Tooltip>
                        <Tooltip content="Wyślij bezpieczne zaproszenie z linkiem aktywacyjnym">
                            <span>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="sm"
                                    icon={UserPlus}
                                    loading={submitting}
                                    disabled={submitting || loadingCompanies}
                                    aria-label="Wyślij Zaproszenie E-mail"
                                >
                                    Wyślij Zaproszenie E-mail
                                </Button>
                            </span>
                        </Tooltip>
                    </div>
                </form>
            </div>
        </div>
    );
};
