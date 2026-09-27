import React, { useState, useEffect, useMemo, useCallback } from 'react';
import apiClient from '../../api/client';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Tooltip, InfoTooltip } from '../ui/Tooltip';
import {
    X,
    Building2,
    Hash,
    FileText,
    Users,
    Search,
    CheckSquare,
    Square,
    Info,
    AlertCircle,
    Plus
} from 'lucide-react';

export const CreateCompanyModal = ({
    isOpen,
    onClose,
    onSuccess,
}) => {
    const { success, error } = useNotification();
    const { refreshUser } = useAuth();

    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [taxId, setTaxId] = useState('');
    const [assignedAdvisorIds, setAssignedAdvisorIds] = useState([]);

    const [advisors, setAdvisors] = useState([]);
    const [advisorSearch, setAdvisorSearch] = useState('');
    const [loadingAdvisors, setLoadingAdvisors] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [validationErrors, setValidationErrors] = useState({});
    const [generalError, setGeneralError] = useState(null);

    const fetchAdvisorsList = useCallback(async () => {
        setLoadingAdvisors(true);
        try {
            const res = await apiClient.get('/admin/advisors');
            const list = res.data?.data || [];
            // Only advisors can be assigned (super_admins already have global access)
            setAdvisors(list.filter(a => a.role === 'advisor' && a.is_active));
        } catch (err) {
            setAdvisors([]);
        } finally {
            setLoadingAdvisors(false);
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        setName('');
        setCode('');
        setTaxId('');
        setAssignedAdvisorIds([]);
        setAdvisorSearch('');
        setValidationErrors({});
        setGeneralError(null);

        fetchAdvisorsList();
    }, [isOpen, fetchAdvisorsList]);

    // Handle ESC key press
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const filteredAdvisors = useMemo(() => {
        const query = advisorSearch.toLowerCase().trim();
        if (!query) return advisors;
        return advisors.filter(a =>
            a.name.toLowerCase().includes(query) ||
            a.email.toLowerCase().includes(query)
        );
    }, [advisors, advisorSearch]);

    const toggleAdvisor = (advisorId) => {
        setAssignedAdvisorIds(prev =>
            prev.includes(advisorId)
                ? prev.filter(id => id !== advisorId)
                : [...prev, advisorId]
        );
    };

    const handleSelectAllAdvisors = () => {
        setAssignedAdvisorIds(advisors.map(a => a.id));
    };

    const handleDeselectAllAdvisors = () => {
        setAssignedAdvisorIds([]);
    };

    const handleCodeChange = (e) => {
        const val = e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 16);
        setCode(val);
        if (validationErrors.code) {
            setValidationErrors(prev => ({ ...prev, code: null }));
        }
    };

    const validateForm = () => {
        const errors = {};
        const trimmedName = name.trim();
        const trimmedCode = code.trim();

        if (!trimmedName) {
            errors.name = 'Pełna nazwa spółki jest wymagana.';
        } else if (trimmedName.length < 2) {
            errors.name = 'Nazwa spółki musi zawierać co najmniej 2 znaki.';
        } else if (trimmedName.length > 255) {
            errors.name = 'Nazwa spółki nie może przekraczać 255 znaków.';
        }

        if (!trimmedCode) {
            errors.code = 'Kod identyfikacyjny (ticker) jest wymagany.';
        } else if (trimmedCode.length < 2) {
            errors.code = 'Kod spółki musi zawierać co najmniej 2 znaki.';
        } else if (trimmedCode.length > 16) {
            errors.code = 'Kod spółki nie może przekraczać 16 znaków.';
        } else if (!/^[A-Z0-9_-]+$/.test(trimmedCode)) {
            errors.code = 'Kod może zawierać wyłącznie wielkie litery, cyfry, myślniki i podkreślenia.';
        }

        if (taxId.trim() && taxId.trim().length > 32) {
            errors.tax_id = 'NIP / Identyfikator podatkowy nie może przekraczać 32 znaków.';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e) => {
        if (e && e.preventDefault) {
            e.preventDefault();
        }

        setGeneralError(null);

        if (!validateForm()) {
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                name: name.trim(),
                code: code.trim().toUpperCase(),
                tax_id: taxId.trim() || null,
                assigned_advisor_ids: assignedAdvisorIds,
            };

            const response = await apiClient.post('/admin/companies', payload);
            const newCompany = response.data?.data;

            if (refreshUser) {
                try {
                    await refreshUser();
                } catch (e) {
                    // non-blocking
                }
            }

            window.dispatchEvent(new CustomEvent('finboard:company-created', { detail: newCompany }));

            success(`Spółka [${newCompany.code}] ${newCompany.name} została pomyślnie zarejestrowana.`);
            if (onSuccess) {
                onSuccess(newCompany);
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
                const msg = resData?.message || 'Wystąpił błąd podczas dodawania spółki do portfela.';
                setGeneralError(msg);
                error(msg);
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-xs font-mono"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="bg-zinc-900 border border-zinc-750 rounded-lg shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-5 py-3.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                        <Tooltip content="Rejestracja nowego podmiotu gospodarczego w architekturze Multi-Tenant">
                            <div
                                tabIndex={0}
                                role="img"
                                aria-label="Rejestracja nowej spółki portfelowej"
                                className="w-7 h-7 rounded bg-zinc-850 border border-zinc-750 flex items-center justify-center text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                            >
                                <Building2 className="w-4 h-4 text-emerald-400" />
                            </div>
                        </Tooltip>
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-100">
                                Dodaj Nową Spółkę Portfelową
                            </h2>
                            <p className="text-[10px] text-zinc-500 mt-0.5">
                                REJESTRACJA PODMIOTU GOSPODARCZEGO & MULTI-TENANT ISOLATION
                            </p>
                        </div>
                    </div>
                    <Tooltip content="Zamknij (Esc)">
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
                            title="Zamknij (Esc)"
                            aria-label="Zamknij formularz rejestracji spółki"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </Tooltip>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} noValidate className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* General Error Banner */}
                    {generalError && (
                        <div className="p-3 rounded bg-rose-950/40 border border-rose-800/80 flex items-start gap-2.5">
                            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                            <div className="text-[11px] text-rose-200 leading-relaxed">
                                {generalError}
                            </div>
                        </div>
                    )}

                    {/* Information Strip */}
                    <div className="p-3 rounded bg-blue-950/30 border border-blue-800/60 flex items-start gap-2.5">
                        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                        <div className="text-[11px] text-zinc-300 leading-relaxed flex-1">
                            <span className="font-semibold text-blue-300">Izolacja Danych Najemcy: </span>
                            Nowo zarejestrowana spółka uzyska unikalny identyfikator portfelowy. Przypisani doradcy uzyskają natychmiastowy dostęp analityczny do jej sprawozdań i wskaźników.
                        </div>
                        <InfoTooltip
                            content="W modelu wielonajemczym FinBoard podmioty gospodarcze mają odseparowane rekordy finansowe, rejestry audytowe oraz dokumenty VDR. Doradca widzi wyłącznie spółki z aktywnym przypisaniem."
                            ariaLabel="Szczegóły o izolacji danych podmiotu portfelowego"
                            size="xs"
                        />
                    </div>

                    {/* Company Name */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                                Pełna Nazwa Podmiotu <span className="text-rose-400">*</span>
                            </label>
                            <InfoTooltip
                                content="Wprowadź oficjalną nazwę prawną podmiotu gospodarczego zarejestrowaną w KRS / CEIDG."
                                ariaLabel="Informacje o pełnej nazwie spółki"
                                size="xs"
                            />
                        </div>
                        <div className="relative">
                            <Building2 className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                autoFocus
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    if (validationErrors.name) {
                                        setValidationErrors(prev => ({ ...prev, name: null }));
                                    }
                                }}
                                placeholder="np. Acme Manufacturing S.A."
                                className={`w-full bg-zinc-950 border ${
                                    validationErrors.name ? 'border-rose-500' : 'border-zinc-750'
                                } rounded pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono`}
                            />
                        </div>
                        {validationErrors.name ? (
                            <p className="text-[10px] text-rose-400 mt-1">{validationErrors.name}</p>
                        ) : (
                            <p className="text-[10px] text-zinc-500 mt-1">
                                Oficjalna nazwa prawna podmiotu gospodarczego (2-255 znaków).
                            </p>
                        )}
                    </div>

                    {/* Grid for Code and Tax ID */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Company Code / Ticker */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                                    Kod / Ticker <span className="text-rose-400">*</span>
                                </label>
                                <InfoTooltip
                                    content="Unikalny identyfikator podmiotu (np. ACME), używany w raportach, tabelach przestawnych i selektorze spółek."
                                    ariaLabel="Informacje o kodzie spółki"
                                    size="xs"
                                />
                            </div>
                            <div className="relative">
                                <Hash className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={code}
                                    onChange={handleCodeChange}
                                    placeholder="np. ACME"
                                    maxLength={16}
                                    className={`w-full bg-zinc-950 border ${
                                        validationErrors.code ? 'border-rose-500' : 'border-zinc-750'
                                    } rounded pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono uppercase`}
                                />
                            </div>
                            {validationErrors.code ? (
                                <p className="text-[10px] text-rose-400 mt-1">{validationErrors.code}</p>
                            ) : (
                                <p className="text-[10px] text-zinc-500 mt-1">
                                    Unikalny identyfikator (2-16 znaków, A-Z, 0-9, _, -).
                                </p>
                            )}
                        </div>

                        {/* Tax ID (NIP) */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                                    NIP / Tax ID <span className="text-zinc-500 text-[10px] lowercase font-normal">(opcjonalny)</span>
                                </label>
                                <InfoTooltip
                                    content="Numer Identyfikacji Podatkowej (NIP / VAT-UE). Pomaga w automatycznym kojarzeniu wyciągów bankowych oraz integracjach zewnętrznych."
                                    ariaLabel="Informacje o NIP podmiotu"
                                    size="xs"
                                />
                            </div>
                            <div className="relative">
                                <FileText className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={taxId}
                                    onChange={(e) => {
                                        setTaxId(e.target.value);
                                        if (validationErrors.tax_id) {
                                            setValidationErrors(prev => ({ ...prev, tax_id: null }));
                                        }
                                    }}
                                    placeholder="np. PL5250011222"
                                    maxLength={32}
                                    className={`w-full bg-zinc-950 border ${
                                        validationErrors.tax_id ? 'border-rose-500' : 'border-zinc-750'
                                    } rounded pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono`}
                                />
                            </div>
                            {validationErrors.tax_id ? (
                                <p className="text-[10px] text-rose-400 mt-1">{validationErrors.tax_id}</p>
                            ) : (
                                <p className="text-[10px] text-zinc-500 mt-1">
                                    Numer identyfikacji podatkowej (max 32 znaki).
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Advisor Assignment Section */}
                    <div className="space-y-2 pt-1 border-t border-zinc-800">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                                    Początkowe Przypisanie Doradców M&A
                                </label>
                                <p className="text-[10px] text-zinc-500 mt-0.5">
                                    Opcjonalne natychmiastowe przypisanie doradców do spółki
                                </p>
                            </div>
                            {advisors.length > 0 && (
                                <div className="flex items-center gap-2 text-[10px]">
                                    <Tooltip content="Zaznacz wszystkich dostępnych doradców M&A">
                                        <button
                                            type="button"
                                            onClick={handleSelectAllAdvisors}
                                            aria-label="Przypisz wszystkich doradców"
                                            className="text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                                        >
                                            Wszyscy
                                        </button>
                                    </Tooltip>
                                    <span className="text-zinc-600">•</span>
                                    <Tooltip content="Wyczyść zaznaczenie doradców">
                                        <button
                                            type="button"
                                            onClick={handleDeselectAllAdvisors}
                                            aria-label="Odznacz wszystkich doradców"
                                            className="text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                                        >
                                            Wyczyść
                                        </button>
                                    </Tooltip>
                                </div>
                            )}
                        </div>

                        {/* Search advisors */}
                        {advisors.length > 3 && (
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={advisorSearch}
                                    onChange={(e) => setAdvisorSearch(e.target.value)}
                                    placeholder="Filtruj doradców po nazwisku lub emailu..."
                                    className="w-full bg-zinc-950 border border-zinc-750 rounded pl-9 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                                />
                            </div>
                        )}

                        {/* Advisors checklist */}
                        <div className="max-h-40 overflow-y-auto space-y-1 p-2 bg-zinc-950/60 border border-zinc-800 rounded">
                            {loadingAdvisors ? (
                                <div className="py-4 text-center text-xs text-zinc-500">
                                    Ładowanie listy doradców Deal Advisory...
                                </div>
                            ) : advisors.length === 0 ? (
                                <div className="py-4 text-center text-xs text-zinc-500">
                                    Brak dostępnych doradców M&A w systemie. Spółka może zostać przypisana w późniejszym terminie.
                                </div>
                            ) : filteredAdvisors.length === 0 ? (
                                <div className="py-4 text-center text-xs text-zinc-500">
                                    Brak doradców pasujących do wyszukiwania.
                                </div>
                            ) : (
                                filteredAdvisors.map((adv) => {
                                    const isChecked = assignedAdvisorIds.includes(adv.id);
                                    return (
                                        <Tooltip
                                            key={adv.id}
                                            content={isChecked
                                                ? `Doradca ${adv.name} jest przypisany. Kliknij, aby usunąć przypisanie.`
                                                : `Kliknij, aby przypisać doradcę ${adv.name} do tworzonej spółki.`
                                            }
                                        >
                                            <button
                                                type="button"
                                                onClick={() => toggleAdvisor(adv.id)}
                                                aria-label={`${adv.name} (${adv.email}) - ${isChecked ? 'przypisany' : 'nieprzypisany'}`}
                                                className={`w-full text-left p-2 rounded text-xs flex items-center justify-between cursor-pointer transition-colors ${
                                                    isChecked
                                                        ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                                                        : 'hover:bg-zinc-900 text-zinc-400 border border-transparent'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 truncate">
                                                    {isChecked ? (
                                                        <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                                    ) : (
                                                        <Square className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                                                    )}
                                                    <span className="font-semibold text-zinc-200 truncate">{adv.name}</span>
                                                    <span className="text-[10px] text-zinc-500 truncate hidden sm:inline">
                                                        ({adv.email})
                                                    </span>
                                                </div>
                                                {isChecked && (
                                                    <Badge variant="brand" size="sm">PRZYPISANY</Badge>
                                                )}
                                            </button>
                                        </Tooltip>
                                    );
                                })
                            )}
                        </div>
                        <div className="text-[10px] text-zinc-500 flex items-center justify-between">
                            <span>Wybrano doradców: <strong className="text-zinc-200 font-bold">{assignedAdvisorIds.length}</strong></span>
                            {validationErrors.assigned_advisor_ids && (
                                <span className="text-rose-400">{validationErrors.assigned_advisor_ids}</span>
                            )}
                        </div>
                    </div>

                    {/* Footer buttons */}
                    <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
                        <Tooltip content="Anuluj i zamknij bez rejestrowania spółki">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={onClose}
                                disabled={submitting}
                                aria-label="Anuluj rejestrację spółki"
                            >
                                Anuluj
                            </Button>
                        </Tooltip>
                        <Tooltip content="Zarejestruj nową spółkę w systemie FinBoard">
                            <span>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="sm"
                                    icon={Plus}
                                    loading={submitting}
                                    disabled={submitting || loadingAdvisors}
                                    aria-label="Utwórz Spółkę"
                                >
                                    Utwórz Spółkę
                                </Button>
                            </span>
                        </Tooltip>
                    </div>
                </form>
            </div>
        </div>
    );
};
