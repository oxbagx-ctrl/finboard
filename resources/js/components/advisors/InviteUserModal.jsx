import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
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
}) => {
    const { user: currentUser, isSuperAdmin, isAdvisor, activeCompany, availableCompanies } = useAuth();
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

    // Determine selectable companies:
    // Advisors can only invite clients to their assigned companies.
    // SuperAdmins can choose from all companies in the system.
    useEffect(() => {
        if (!isOpen) return;

        setEmail('');
        setRole(isAdvisor ? 'client' : defaultRole);
        setCompanyId(defaultCompanyId || activeCompany?.id || (availableCompanies[0]?.id ?? ''));
        setAssCompanyIds([]);
        setValidityHours(48);
        setCompanySearch('');
        setValidationErrors({});

        if (isSuperAdmin) {
            fetchAllCompanies();
        } else {
            setAllCompanies(availableCompanies || []);
        }
    }, [isOpen, defaultRole, defaultCompanyId, activeCompany, availableCompanies, isAdvisor, isSuperAdmin]);

    const fetchAllCompanies = async () => {
        setLoadingCompanies(true);
        try {
            const res = await apiClient.get('/admin/companies');
            setAllCompanies(res.data.data || []);
        } catch (err) {
            setAllCompanies(availableCompanies || []);
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
                        <div className="w-7 h-7 rounded bg-zinc-850 border border-zinc-750 flex items-center justify-center text-zinc-300">
                            <UserPlus className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-100">
                                Zaproś Nowego Użytkownika
                            </h2>
                            <p className="text-[10px] text-zinc-500 mt-0.5">
                                BEZPIECZNA INICJALIZACJA KONTA PRZEZ JEDNORAZOWY TOKEN
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} noValidate className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* Security Info Notice */}
                    <div className="p-3 rounded bg-blue-950/30 border border-blue-800/60 flex items-start gap-2.5">
                        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                        <div className="text-[11px] text-zinc-300 leading-relaxed">
                            <span className="font-semibold text-blue-300">Zasada zerowego zaufania (Zero-Trust): </span>
                            Hasła nie są ustawiane ręcznie przez administratorów. Zaproszony użytkownik otrzyma szyfrowany link aktywacyjny, za pomocą którego samodzielnie ustawi silne hasło.
                        </div>
                    </div>

                    {/* Email Input */}
                    <div>
                        <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                            Adres E-mail Odbiorcy <span className="text-rose-400">*</span>
                        </label>
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
                        <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                            Rola Systemowa & Uprawnienia <span className="text-rose-400">*</span>
                        </label>
                        {isAdvisor ? (
                            <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Badge variant="default" size="sm">KLIENT / CFO</Badge>
                                    <span className="text-xs text-zinc-300">Klient podmiotu portfelowego</span>
                                </div>
                                <span className="text-[10px] text-zinc-500 italic">Uprawnienia doradcy</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setRole('client')}
                                    className={`p-2.5 rounded text-left border transition-all cursor-pointer ${
                                        role === 'client'
                                            ? 'bg-zinc-800 border-zinc-600 text-zinc-100 shadow-xs'
                                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                    }`}
                                >
                                    <div className="text-xs font-bold text-zinc-200">Klient / CFO</div>
                                    <div className="text-[10px] text-zinc-500 mt-0.5">Dostęp do 1 spółki</div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setRole('advisor')}
                                    className={`p-2.5 rounded text-left border transition-all cursor-pointer ${
                                        role === 'advisor'
                                            ? 'bg-zinc-800 border-zinc-600 text-zinc-100 shadow-xs'
                                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                    }`}
                                >
                                    <div className="text-xs font-bold text-zinc-200">Doradca M&A</div>
                                    <div className="text-[10px] text-zinc-500 mt-0.5">Przypisane spółki</div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setRole('super_admin')}
                                    className={`p-2.5 rounded text-left border transition-all cursor-pointer ${
                                        role === 'super_admin'
                                            ? 'bg-zinc-800 border-zinc-600 text-zinc-100 shadow-xs'
                                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                    }`}
                                >
                                    <div className="text-xs font-bold text-zinc-200">Super Admin</div>
                                    <div className="text-[10px] text-zinc-500 mt-0.5">Globalny partner</div>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Company Selection for Client Role */}
                    {role === 'client' && (
                        <div>
                            <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                                Przypisana Spółka Portfelowa <span className="text-rose-400">*</span>
                            </label>
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
                                    <button
                                        type="button"
                                        onClick={handleSelectAllCompanies}
                                        className="text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                                    >
                                        Wszystkie
                                    </button>
                                    <span>•</span>
                                    <button
                                        type="button"
                                        onClick={handleDeselectAllCompanies}
                                        className="text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                                    >
                                        Wyczyść
                                    </button>
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
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => toggleAssignedCompany(c.id)}
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
                        <div className="p-3 rounded bg-purple-950/30 border border-purple-800/60 text-[11px] text-purple-200">
                            Rola Super Admin otrzymuje globalny dostęp do wszystkich spółek w systemie FinBoard oraz uprawnienia do zarządzania zespołem doradców.
                        </div>
                    )}

                    {/* Validity Expiration Period */}
                    <div>
                        <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                            Czas Ważności Tokenu Zaproszenia
                        </label>
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
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onClose}
                            disabled={submitting}
                        >
                            Anuluj
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                            icon={UserPlus}
                            loading={submitting}
                            disabled={submitting || loadingCompanies}
                        >
                            Wyślij Zaproszenie E-mail
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
