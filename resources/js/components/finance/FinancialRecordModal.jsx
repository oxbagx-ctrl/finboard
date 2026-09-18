import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useNotification } from '../../context/NotificationContext';
import { useDeal } from '../../context/DealContext';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
    X,
    FileText,
    DollarSign,
    Calendar,
    Tag,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';

export const FinancialRecordModal = ({
    isOpen,
    onClose,
    onSuccess,
    categories = [],
    recordToEdit = null
}) => {
    const { success, error } = useNotification();
    const { currency: defaultCurrency } = useDeal();

    const isEdit = !!recordToEdit;

    const [categoryId, setCategoryId] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState(defaultCurrency || 'PLN');
    const [recordDate, setRecordDate] = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (recordToEdit) {
            setCategoryId(recordToEdit.category_id || recordToEdit.category?.id || '');
            setAmount(recordToEdit.amount ? String(recordToEdit.amount) : '');
            setCurrency(recordToEdit.currency || defaultCurrency || 'PLN');
            setRecordDate(recordToEdit.record_date || new Date().toISOString().split('T')[0]);
            setDescription(recordToEdit.description || '');
        } else {
            setCategoryId(categories.length > 0 ? categories[0].id : '');
            setAmount('');
            setCurrency(defaultCurrency || 'PLN');
            setRecordDate(new Date().toISOString().split('T')[0]);
            setDescription('');
        }
        setErrors({});
    }, [recordToEdit, isOpen, categories, defaultCurrency]);

    if (!isOpen) return null;

    const validate = () => {
        const errs = {};
        if (!categoryId) errs.categoryId = 'Kategoria finansowa jest wymagana.';
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            errs.amount = 'Wprowadź prawidłową kwotę dodatnią większą od zera.';
        }
        if (!recordDate) errs.recordDate = 'Data księgowania jest wymagana.';
        if (!description || description.trim().length === 0) {
            errs.description = 'Opis operacji jest wymagany.';
        }
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setSaving(true);
        setErrors({});

        try {
            const payload = {
                category_id: categoryId,
                amount: parseFloat(amount),
                currency,
                record_date: recordDate,
                description: description.trim(),
                source: 'manual',
            };

            if (isEdit) {
                await apiClient.put(`/finance/records/${recordToEdit.id}`, payload);
                success('Zaktualizowano zapis księgowy.');
            } else {
                await apiClient.post('/finance/records', payload);
                success('Pomyślnie dodano nowy zapis księgowy.');
            }

            onSuccess();
            onClose();
        } catch (err) {
            const errData = err.response?.data;
            if (errData?.errors) {
                setErrors(errData.errors);
            } else {
                error(errData?.message || 'Wystąpił błąd podczas zapisu operacji.');
            }
        } finally {
            setSaving(false);
        }
    };

    // Group categories by type
    const groupedCategories = categories.reduce((acc, cat) => {
        const type = cat.type || 'OTHER';
        if (!acc[type]) acc[type] = [];
        acc[type].push(cat);
        return acc;
    }, {});

    const typeLabels = {
        'INCOME': 'PRZYCHODY (INCOME)',
        'EXPENSE': 'KOSZTY I OPEX (EXPENSE)',
        'ASSET': 'AKTYWA (ASSETS)',
        'LIABILITY': 'PASYWA I ZOBOWIĄZANIA (LIABILITIES)',
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-xs font-mono">
            <div className="bg-zinc-900 border border-zinc-750 rounded-lg shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Modal Header */}
                <div className="px-5 py-3.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-zinc-850 border border-zinc-750 flex items-center justify-center text-zinc-300">
                            <FileText className="w-3.5 h-3.5" />
                        </div>
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-100">
                                {isEdit ? 'Edycja Zapisów Księgowych' : 'Nowy Zapis Księgowy'}
                            </h2>
                            <p className="text-[10px] text-zinc-500">
                                {isEdit ? `ID: ${recordToEdit?.id}` : 'REJESTRACJA OPERACJI W KSIĘDZE GŁÓWNEJ'}
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
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Category Selection */}
                    <div>
                        <label className="block text-[10px] uppercase font-semibold text-zinc-400 mb-1 flex items-center gap-1.5">
                            <Tag className="w-3 h-3 text-zinc-500" />
                            Kategoria Finansowa
                        </label>
                        <select
                            value={categoryId}
                            onChange={(e) => setCategoryId(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-750 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                        >
                            {Object.entries(groupedCategories).map(([typeKey, cats]) => (
                                <optgroup key={typeKey} label={typeLabels[typeKey] || typeKey} className="bg-zinc-900 text-zinc-400">
                                    {cats.map((c) => (
                                        <option key={c.id} value={c.id} className="bg-zinc-950 text-zinc-100">
                                            [{c.code}] {c.name}
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                        {errors.categoryId && (
                            <div className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {errors.categoryId}
                            </div>
                        )}
                    </div>

                    {/* Amount and Currency */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                            <label className="block text-[10px] uppercase font-semibold text-zinc-400 mb-1 flex items-center gap-1.5">
                                <DollarSign className="w-3 h-3 text-zinc-500" />
                                Kwota Transakcji
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                required
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-zinc-950 border border-zinc-750 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono text-right tabular-nums"
                            />
                            {errors.amount && (
                                <div className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {errors.amount}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-[10px] uppercase font-semibold text-zinc-400 mb-1">
                                Waluta
                            </label>
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-750 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                            >
                                <option value="PLN">PLN</option>
                                <option value="EUR">EUR</option>
                                <option value="USD">USD</option>
                                <option value="GBP">GBP</option>
                            </select>
                        </div>
                    </div>

                    {/* Date */}
                    <div>
                        <label className="block text-[10px] uppercase font-semibold text-zinc-400 mb-1 flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 text-zinc-500" />
                            Data Księgowania (YYYY-MM-DD)
                        </label>
                        <input
                            type="date"
                            required
                            value={recordDate}
                            onChange={(e) => setRecordDate(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-750 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                        />
                        {errors.recordDate && (
                            <div className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {errors.recordDate}
                            </div>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-[10px] uppercase font-semibold text-zinc-400 mb-1">
                            Tytuł / Opis Operacji (Kontrahent, Faktura, Ref.)
                        </label>
                        <textarea
                            rows={3}
                            required
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="np. FV/2026/01/992 - Dostawa komponentów produkcyjnych od ABC Logistyka"
                            className="w-full bg-zinc-950 border border-zinc-750 rounded px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono resize-none"
                        />
                        {errors.description && (
                            <div className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {errors.description}
                            </div>
                        )}
                    </div>

                    {/* Audit Notice */}
                    <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded text-[10px] text-zinc-500 font-mono">
                        Zapis zostanie trwale zarejestrowany w dzienniku zdarzeń audytowych z podpisem operatora.
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-2 border-t border-zinc-800 flex items-center justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={onClose} type="button">
                            Anuluj
                        </Button>
                        <Button variant="primary" size="sm" type="submit" loading={saving}>
                            {isEdit ? 'Zapisz Zmiany' : 'Utwórz Zapis'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
