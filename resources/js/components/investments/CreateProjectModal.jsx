import React, { useState, useEffect } from 'react';
import { X, Calculator, Calendar, DollarSign, FileText } from 'lucide-react';
import { Button } from '../ui/Button';

const getInitialFormData = () => ({
    name: '',
    description: '',
    start_date: new Date().toISOString().split('T')[0],
    planning_horizon_years: 15,
    currency: 'PLN',
    equity_contribution: '',
    bank_loan_principal: '',
});

export const CreateProjectModal = ({ isOpen, onClose, onSubmit }) => {
    const [formData, setFormData] = useState(getInitialFormData);
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    // Automatically reset state whenever modal is opened
    useEffect(() => {
        if (isOpen) {
            setFormData(getInitialFormData());
            setErrors({});
            setSubmitting(false);
        }
    }, [isOpen]);

    const handleClose = () => {
        if (submitting) return;
        setFormData(getInitialFormData());
        setErrors({});
        onClose();
    };

    if (!isOpen) return null;

    const validate = () => {
        const errs = {};
        if (!formData.name.trim()) {
            errs.name = 'Nazwa projektu jest wymagana.';
        }
        if (!formData.start_date) {
            errs.start_date = 'Data rozpoczęcia projektu jest wymagana.';
        }
        const horizon = parseInt(formData.planning_horizon_years, 10);
        if (isNaN(horizon) || horizon < 1 || horizon > 30) {
            errs.planning_horizon_years = 'Horyzont planowania musi wynosić od 1 do 30 lat.';
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
                name: formData.name.trim(),
                description: formData.description.trim() || null,
                start_date: formData.start_date,
                planning_horizon_years: parseInt(formData.planning_horizon_years, 10),
                currency: formData.currency,
                equity_contribution: formData.equity_contribution ? String(formData.equity_contribution) : null,
                bank_loan_principal: formData.bank_loan_principal ? String(formData.bank_loan_principal) : null,
            };

            await onSubmit(payload);
            setFormData(getInitialFormData());
            setErrors({});
            onClose();
        } catch (err) {
            if (err.response?.data?.errors) {
                setErrors(err.response.data.errors);
            } else {
                setErrors({ general: err.response?.data?.message || 'Wystąpił błąd podczas tworzenia projektu.' });
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
                            <Calculator className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">
                                Nowy Projekt Inwestycyjny
                            </h2>
                            <p className="text-[11px] text-zinc-400">
                                Inicjalizacja modelu Project Finance & CAPEX
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={submitting}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {errors.general && (
                        <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded text-rose-300 text-xs">
                            {errors.general}
                        </div>
                    )}

                    {/* Name */}
                    <div>
                        <label htmlFor="project-name" className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                            Nazwa Projektu *
                        </label>
                        <input
                            id="project-name"
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="np. Budowa Centrum Dystrybucyjnego Logistics Hub"
                            className={`w-full px-3 py-2 bg-zinc-950 border rounded text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${
                                errors.name ? 'border-rose-600' : 'border-zinc-800'
                            }`}
                        />
                        {errors.name && <p className="text-[10px] text-rose-400 mt-1">{errors.name}</p>}
                    </div>

                    {/* Row: Start Date, Horizon, Currency */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label htmlFor="project-start-date" className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                                Data Startu *
                            </label>
                            <input
                                id="project-start-date"
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
                            <label htmlFor="project-horizon" className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                                Horyzont (Lata)
                            </label>
                            <input
                                id="project-horizon"
                                type="number"
                                min="1"
                                max="30"
                                value={formData.planning_horizon_years}
                                onChange={(e) => setFormData({ ...formData, planning_horizon_years: e.target.value })}
                                className={`w-full px-3 py-2 bg-zinc-950 border rounded text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${
                                    errors.planning_horizon_years ? 'border-rose-600' : 'border-zinc-800'
                                }`}
                            />
                            {errors.planning_horizon_years && <p className="text-[10px] text-rose-400 mt-1">{errors.planning_horizon_years}</p>}
                        </div>

                        <div>
                            <label htmlFor="project-currency" className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                                Waluta
                            </label>
                            <select
                                id="project-currency"
                                value={formData.currency}
                                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                            >
                                <option value="PLN">PLN (złoty)</option>
                                <option value="EUR">EUR (euro)</option>
                                <option value="USD">USD (dolar)</option>
                                <option value="GBP">GBP (funt)</option>
                            </select>
                        </div>
                    </div>

                    {/* Row: Initial Equity & Debt (Optional) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                                Wkład Własny (Equity)
                            </label>
                            <input
                                type="number"
                                step="any"
                                min="0"
                                placeholder="np. 2000000"
                                value={formData.equity_contribution}
                                onChange={(e) => setFormData({ ...formData, equity_contribution: e.target.value })}
                                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                                Kredyt Bankowy (Dług)
                            </label>
                            <input
                                type="number"
                                step="any"
                                min="0"
                                placeholder="np. 5000000"
                                value={formData.bank_loan_principal}
                                onChange={(e) => setFormData({ ...formData, bank_loan_principal: e.target.value })}
                                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                            Opis / Założenia Strategiczne
                        </label>
                        <textarea
                            rows="3"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Zwięzły opis celu inwestycji, planowanej skali operacji oraz kluczowych ryzyk..."
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                        />
                    </div>

                    {/* Footer buttons */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={handleClose}
                            disabled={submitting}
                        >
                            Anuluj
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            loading={submitting}
                        >
                            Utwórz Projekt
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
