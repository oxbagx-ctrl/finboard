import React, { useState, useEffect } from 'react';
import { X, Layers, Calendar, DollarSign, Tag, CheckSquare, Clock } from 'lucide-react';
import { Button } from '../ui/Button';
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
                net_amount: initialData.net_amount !== undefined ? String(initialData.net_amount) : '',
                currency: initialData.currency || projectCurrency || 'PLN',
                start_date: initialData.start_date || projectStartDate || today,
                duration_months: initialData.duration_months || 6,
                kst_code: initialData.kst_code || 'KST_1',
                is_grant_eligible: !!initialData.is_grant_eligible || !!initialData.eligible_for_grant,
                grant_eligible_amount: initialData.grant_eligible_amount !== undefined
                    ? String(initialData.grant_eligible_amount)
                    : (initialData.eligible_for_grant ? String(initialData.net_amount) : ''),
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
                    <button
                        onClick={onClose}
                        disabled={submitting}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                    >
                        <X className="w-4 h-4" />
                    </button>
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
                        <label htmlFor="stage-name" className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                            Nazwa Etapu CAPEX *
                        </label>
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
                            <label htmlFor="stage-net-amount" className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                                Kwota Netto ({formData.currency}) *
                            </label>
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
                            <label htmlFor="stage-order" className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                                Kolejność
                            </label>
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
                            <label htmlFor="stage-start-date" className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                                Data Rozpoczęcia *
                            </label>
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
                            <label htmlFor="stage-duration" className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                                Czas Trwania (Miesiące) *
                            </label>
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
                        <label htmlFor="stage-kst" className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                            Klasyfikacja Środka Trwałego (KŚT) *
                        </label>
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

                        {formData.is_grant_eligible && (
                            <div className="pt-2">
                                <label htmlFor="stage-grant-eligible-amount" className="block text-[11px] font-semibold text-zinc-400 uppercase mb-1">
                                    Kwota Wydatków Kwalifikowanych ({formData.currency})
                                </label>
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
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            disabled={submitting}
                        >
                            Anuluj
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            loading={submitting}
                        >
                            {isEdit ? 'Zapisz Zmiany' : 'Dodaj Etap'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
