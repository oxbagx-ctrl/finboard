import React, { useState, useEffect } from 'react';
import { X, Layers, Calendar, DollarSign, Tag, CheckSquare, Clock } from 'lucide-react';
import { Button } from '../ui/Button';
import { Tooltip, InfoTooltip } from '../ui/Tooltip';
import { KST_CLASSIFICATIONS } from '../../constants/kstClassifications';

export const CapexStageModal = ({
    isOpen,
    onClose,
    onSubmit,
    initialData = null,
    projectCurrency = 'PLN',
    projectStartDate = '',
}) => {
    const isEdit = !!initialData;
    const today = new Date().toISOString().split('T')[0];

    const [formData, setFormData] = useState({
        stage_name: '',
        net_amount: '',
        currency: projectCurrency || 'PLN',
        start_date: projectStartDate || today,
        duration_months: 6,
        kst_code: 'KST_1',
        is_grant_eligible: false,
        grant_eligible_amount: '',
        stage_order: 1,
    });

    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({
                stage_name: initialData.stage_name || '',
                net_amount: initialData.net_amount !== undefined && initialData.net_amount !== null ? String(initialData.net_amount) : '',
                currency: initialData.currency || projectCurrency || 'PLN',
                start_date: initialData.start_date || projectStartDate || today,
                duration_months: initialData.duration_months || 6,
                kst_code: initialData.kst_code || 'KST_1',
                is_grant_eligible: !!initialData.is_grant_eligible || !!initialData.eligible_for_grant,
                grant_eligible_amount: initialData.grant_eligible_amount !== undefined && initialData.grant_eligible_amount !== null
                    ? String(initialData.grant_eligible_amount)
                    : (initialData.eligible_for_grant || initialData.is_grant_eligible ? String(initialData.net_amount) : ''),
                stage_order: initialData.stage_order || initialData.order_index || 1,
            });
        } else {
            setFormData({
                stage_name: '',
                net_amount: '',
                currency: projectCurrency || 'PLN',
                start_date: projectStartDate || today,
                duration_months: 6,
                kst_code: 'KST_1',
                is_grant_eligible: false,
                grant_eligible_amount: '',
                stage_order: 1,
            });
        }
        setErrors({});
    }, [initialData, projectCurrency, projectStartDate, isOpen]);

    if (!isOpen) return null;

    const validate = () => {
        const errs = {};
        if (!formData.stage_name.trim()) {
            errs.stage_name = 'Nazwa etapu jest wymagana.';
        }

        const net = parseFloat(formData.net_amount);
        if (isNaN(net) || net <= 0) {
            errs.net_amount = 'Kwota nakładów netto musi być większa od zera.';
        }

        if (!formData.start_date) {
            errs.start_date = 'Data rozpoczęcia etapu jest wymagana.';
        }

        const duration = parseInt(formData.duration_months, 10);
        if (isNaN(duration) || duration < 1 || duration > 120) {
            errs.duration_months = 'Czas trwania etapu musi wynosić od 1 do 120 miesięcy.';
        }

        if (formData.is_grant_eligible) {
            const grantEligible = parseFloat(formData.grant_eligible_amount);
            if (!isNaN(grantEligible) && !isNaN(net) && grantEligible > net) {
                errs.grant_eligible_amount = 'Kwota kwalifikowana nie może przekraczać kwoty netto etapu.';
            }
        }

        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setSubmitting(true);
        setErrors({});

        try {
            const payload = {
                stage_name: formData.stage_name.trim(),
                net_amount: String(formData.net_amount),
                currency: formData.currency,
                start_date: formData.start_date,
                duration_months: parseInt(formData.duration_months, 10),
                kst_code: formData.kst_code,
                is_grant_eligible: Boolean(formData.is_grant_eligible),
                grant_eligible_amount: formData.is_grant_eligible && formData.grant_eligible_amount
                    ? String(formData.grant_eligible_amount)
                    : null,
                stage_order: parseInt(formData.stage_order, 10) || 1,
            };

            await onSubmit(payload);
            onClose();
        } catch (err) {
            if (err.response?.data?.errors) {
                setErrors(err.response.data.errors);
            } else {
                setErrors({ general: err.response?.data?.message || 'Wystąpił błąd podczas zapisywania etapu.' });
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-xs font-mono">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-100">
                            <Layers className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">
                                {isEdit ? 'Edycja Etapu CAPEX' : 'Nowy Etap Nakładów CAPEX'}
                            </h2>
                            <p className="text-[11px] text-zinc-400">
                                Parametryzacja kosztów, harmonogramu i stawek amortyzacji KŚT
                            </p>
                        </div>
                    </div>
                    <Tooltip content="Zamknij formularz etapu CAPEX">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            aria-label="Zamknij formularz etapu"
                            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded focus:outline-none focus:ring-1 focus:ring-zinc-400"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </Tooltip>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
                    {errors.general && (
                        <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded text-rose-300 text-xs">
                            {errors.general}
                        </div>
                    )}

                    {/* Stage Name */}
                    <div>
                        <div className="flex items-center gap-1.5 mb-1">
                            <label htmlFor="stage-name" className="text-xs font-semibold text-zinc-300 uppercase">
                                Nazwa Etapu CAPEX *
                            </label>
                            <InfoTooltip
                                content="Nazwa zadania inwestycyjnego, np. Roboty ziemne, Stan surowy, Przyłącze SN, Falowniki, Magazyn energii BESS."
                                ariaLabel="Informacje o nazwie etapu CAPEX"
                                size="xs"
                            />
                        </div>
                        <input
                            id="stage-name"
                            type="text"
                            value={formData.stage_name}
                            onChange={(e) => setFormData({ ...formData, stage_name: e.target.value })}
                            placeholder="np. Prace ziemne i fundamenty hali"
                            className={`w-full px-3 py-2 bg-zinc-950 border rounded text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${
                                errors.stage_name ? 'border-rose-600' : 'border-zinc-800'
                            }`}
                        />
                        {errors.stage_name && <p className="text-[10px] text-rose-400 mt-1">{errors.stage_name}</p>}
                    </div>

                    {/* Row: Net Amount & Currency & Order */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                            <div className="flex items-center gap-1.5 mb-1">
                                <label htmlFor="stage-net-amount" className="text-xs font-semibold text-zinc-300 uppercase">
                                    Kwota Netto ({formData.currency}) *
                                </label>
                                <InfoTooltip
                                    content="Całkowita wartość wydatków inwestycyjnych netto bez podatku od towarów i usług (VAT)."
                                    ariaLabel="Informacje o kwocie netto etapu"
                                    size="xs"
                                />
                            </div>
                            <input
                                id="stage-net-amount"
                                type="number"
                                step="any"
                                min="0"
                                value={formData.net_amount}
                                onChange={(e) => setFormData({ ...formData, net_amount: e.target.value })}
                                placeholder="np. 2500000"
                                className={`w-full px-3 py-2 bg-zinc-950 border rounded text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${
                                    errors.net_amount ? 'border-rose-600' : 'border-zinc-800'
                                }`}
                            />
                            {errors.net_amount && <p className="text-[10px] text-rose-400 mt-1">{errors.net_amount}</p>}
                        </div>

                        <div>
                            <div className="flex items-center gap-1.5 mb-1">
                                <label htmlFor="stage-order" className="text-xs font-semibold text-zinc-300 uppercase">
                                    Kolejność
                                </label>
                                <InfoTooltip
                                    content="Numer porządkowy etapu w harmonogramie rzeczowo-finansowym."
                                    ariaLabel="Informacje o kolejności etapu"
                                    size="xs"
                                />
                            </div>
                            <input
                                id="stage-order"
                                type="number"
                                min="1"
                                max="100"
                                value={formData.stage_order}
                                onChange={(e) => setFormData({ ...formData, stage_order: e.target.value })}
                                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                            />
                        </div>
                    </div>

                    {/* Row: Start Date & Duration */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <div className="flex items-center gap-1.5 mb-1">
                                <label htmlFor="stage-start-date" className="text-xs font-semibold text-zinc-300 uppercase">
                                    Data Rozpoczęcia *
                                </label>
                                <InfoTooltip
                                    content="Planowana data pierwszych wydatków lub rozpoczęcia prac budowlano-montażowych."
                                    ariaLabel="Informacje o dacie rozpoczęcia"
                                    size="xs"
                                />
                            </div>
                            <input
                                id="stage-start-date"
                                type="date"
                                value={formData.start_date}
                                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                className={`w-full px-3 py-2 bg-zinc-950 border rounded text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${
                                    errors.start_date ? 'border-rose-600' : 'border-zinc-800'
                                }`}
                            />
                            {errors.start_date && <p className="text-[10px] text-rose-400 mt-1">{errors.start_date}</p>}
                        </div>

                        <div>
                            <div className="flex items-center gap-1.5 mb-1">
                                <label htmlFor="stage-duration" className="text-xs font-semibold text-zinc-300 uppercase">
                                    Czas Trwania (Miesiące) *
                                </label>
                                <InfoTooltip
                                    content="Czas trwania etapu w miesiącach. Data zakończenia określa moment oddania środka trwałego do używania (OT)."
                                    ariaLabel="Informacje o czasie trwania etapu"
                                    size="xs"
                                />
                            </div>
                            <input
                                id="stage-duration"
                                type="number"
                                min="1"
                                max="120"
                                value={formData.duration_months}
                                onChange={(e) => setFormData({ ...formData, duration_months: e.target.value })}
                                className={`w-full px-3 py-2 bg-zinc-950 border rounded text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${
                                    errors.duration_months ? 'border-rose-600' : 'border-zinc-800'
                                }`}
                            />
                            {errors.duration_months && <p className="text-[10px] text-rose-400 mt-1">{errors.duration_months}</p>}
                        </div>
                    </div>

                    {/* KŚT Classification */}
                    <div>
                        <div className="flex items-center gap-1.5 mb-1">
                            <label htmlFor="stage-kst" className="text-xs font-semibold text-zinc-300 uppercase">
                                Klasyfikacja Środka Trwałego (KŚT) *
                            </label>
                            <InfoTooltip
                                content="Grupa KŚT determinująca urzędową stawkę amortyzacji bilansowej i podatkowej oraz rozpoczęcie odpisów od momentu OT."
                                ariaLabel="Informacje o klasyfikacji KŚT"
                                size="xs"
                            />
                        </div>
                        <select
                            id="stage-kst"
                            value={formData.kst_code}
                            onChange={(e) => setFormData({ ...formData, kst_code: e.target.value })}
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                        >
                            {KST_CLASSIFICATIONS.map((kst) => (
                                <option key={kst.code} value={kst.code} className="bg-zinc-900 text-zinc-100">
                                    {kst.code}: {kst.name} ({kst.rate}% rocznie)
                                </option>
                            ))}
                        </select>
                        <p className="text-[10px] text-zinc-500 mt-1">
                            Urzędowa stawka amortyzacji liniowej będzie stosowana od miesiąca oddania środka do używania (OT).
                        </p>
                    </div>

                    {/* Grant Eligibility Section */}
                    <div className="p-3 bg-zinc-950 border border-zinc-800 rounded space-y-2">
                        <div className="flex items-center gap-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.is_grant_eligible}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        is_grant_eligible: e.target.checked,
                                        grant_eligible_amount: e.target.checked && !formData.grant_eligible_amount
                                            ? formData.net_amount
                                            : formData.grant_eligible_amount,
                                    })}
                                    className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-emerald-500 focus:ring-0 focus:outline-none cursor-pointer"
                                />
                                <span className="text-xs font-semibold text-zinc-200 uppercase">
                                    Wydatki Kwalifikowane do Dotacji / Pomocy Publicznej
                                </span>
                            </label>
                            <InfoTooltip
                                content="Oznacz etap jako kwalifikujący się do refundacji w ramach dotacji unijnych lub krajowych programów pomocowych."
                                ariaLabel="Informacje o kwalifikowalności dotacyjnej"
                                size="xs"
                            />
                        </div>

                        {formData.is_grant_eligible && (
                            <div className="pt-2">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <label htmlFor="stage-grant-eligible-amount" className="text-[11px] font-semibold text-zinc-400 uppercase">
                                        Kwota Wydatków Kwalifikowanych ({formData.currency})
                                    </label>
                                    <InfoTooltip
                                        content="Część nakładów netto tego etapu kwalifikująca się do objęcia dofinansowaniem. Domyślnie 100% wartości etapu."
                                        ariaLabel="Informacje o kwocie wydatków kwalifikowanych"
                                        size="xs"
                                    />
                                </div>
                                <input
                                    id="stage-grant-eligible-amount"
                                    type="number"
                                    step="any"
                                    min="0"
                                    value={formData.grant_eligible_amount}
                                    onChange={(e) => setFormData({ ...formData, grant_eligible_amount: e.target.value })}
                                    placeholder="Domyślnie pełna kwota netto"
                                    className={`w-full px-3 py-1.5 bg-zinc-900 border rounded text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${
                                        errors.grant_eligible_amount ? 'border-rose-600' : 'border-zinc-800'
                                    }`}
                                />
                                {errors.grant_eligible_amount && (
                                    <p className="text-[10px] text-rose-400 mt-1">{errors.grant_eligible_amount}</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer buttons */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                        <Tooltip content="Odrzuć zmiany i zamknij okno dialogowe">
                            <span>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={onClose}
                                    disabled={submitting}
                                    aria-label="Anuluj edycję etapu"
                                >
                                    Anuluj
                                </Button>
                            </span>
                        </Tooltip>
                        <Tooltip content={isEdit ? 'Zapisz zaktualizowane parametry etapu CAPEX' : 'Zapisz i dodaj nowy etap do harmonogramu projektu'}>
                            <span>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    loading={submitting}
                                    aria-label={isEdit ? 'Zapisz Zmiany' : 'Dodaj Etap'}
                                >
                                    {isEdit ? 'Zapisz Zmiany' : 'Dodaj Etap'}
                                </Button>
                            </span>
                        </Tooltip>
                    </div>
                </form>
            </div>
        </div>
    );
};
