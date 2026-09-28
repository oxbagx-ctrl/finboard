import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
    X,
    User,
    Shield,
    Lock,
    Building2,
    Key,
    CheckCircle2,
    LogOut,
    AlertCircle
} from 'lucide-react';

export const UserProfileModal = ({ isOpen, onClose }) => {
    const { user, activeCompany, isAdmin, updateProfile, logout } = useAuth();
    const { success, error } = useNotification();

    const [activeTab, setActiveTab] = useState('general'); // 'general' | 'security'
    const [name, setName] = useState(user?.name || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [saving, setSaving] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});

    if (!isOpen) return null;

    const handleSaveGeneral = async (e) => {
        e.preventDefault();
        setSaving(true);
        setFieldErrors({});

        try {
            await updateProfile({ name });
            success('Imię i nazwisko zostało zaktualizowane.');
            onClose();
        } catch (err) {
            const msg = err.response?.data?.message || 'Nie udało się zaktualizować profilu.';
            error(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleSavePassword = async (e) => {
        e.preventDefault();
        setFieldErrors({});

        if (newPassword.length < 8) {
            setFieldErrors({ newPassword: 'Nowe hasło musi mieć co najmniej 8 znaków.' });
            return;
        }

        if (newPassword !== confirmPassword) {
            setFieldErrors({ confirmPassword: 'Nowe hasła nie są identyczne.' });
            return;
        }

        setSaving(true);
        try {
            await updateProfile({
                currentPassword,
                newPassword,
            });
            success('Hasło dostępowe zostało zmienione.');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            onClose();
        } catch (err) {
            const errData = err.response?.data;
            if (errData?.errors?.current_password) {
                setFieldErrors({ currentPassword: errData.errors.current_password[0] });
            } else {
                error(errData?.message || 'Nie udało się zmienić hasła.');
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 dark:bg-zinc-950/80 backdrop-blur-xs font-mono">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-750 rounded-lg shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Modal Header */}
                <div className="px-5 py-3.5 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-750 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                            <User className="w-3.5 h-3.5" />
                        </div>
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                                Profil Użytkownika & Bezpieczeństwo
                            </h2>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">ID: {user?.id}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-150 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Sub-tabs */}
                <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/50 text-xs">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`flex-1 py-2.5 px-4 text-center font-semibold transition-colors border-b-2 ${
                            activeTab === 'general'
                                ? 'border-zinc-900 dark:border-zinc-200 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900'
                                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                        }`}
                    >
                        DANE TOŻSAMOŚCI
                    </button>
                    <button
                        onClick={() => setActiveTab('security')}
                        className={`flex-1 py-2.5 px-4 text-center font-semibold transition-colors border-b-2 ${
                            activeTab === 'security'
                                ? 'border-zinc-900 dark:border-zinc-200 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900'
                                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                        }`}
                    >
                        ZMIANA HASŁA & AUDYT
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-5">
                    {activeTab === 'general' && (
                        <form onSubmit={handleSaveGeneral} className="space-y-4">
                            <div>
                                <label className="block text-[10px] uppercase font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                                    Imię i Nazwisko / Funkcja
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-750 rounded px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] uppercase font-semibold text-zinc-500 mb-1">
                                    Służbowy Adres E-mail (Login)
                                </label>
                                <input
                                    type="email"
                                    disabled
                                    value={user?.email || ''}
                                    className="w-full bg-zinc-100 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 text-xs text-zinc-500 cursor-not-allowed font-mono"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-1">
                                <div className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                                    <div className="text-[10px] text-zinc-500 uppercase">Rola w Systemie</div>
                                    <div className="mt-1 flex items-center gap-1.5">
                                        <Badge variant={isAdmin ? 'default' : 'brand'} size="sm">
                                            {isAdmin ? 'ADVISOR / ADMIN' : 'PORTFOLIO CLIENT'}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                                    <div className="text-[10px] text-zinc-500 uppercase">Przypisana Spółka</div>
                                    <div className="mt-1 text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                                        {activeCompany?.name || 'Wszystkie podmioty'}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                                <Button
                                    variant="danger"
                                    size="sm"
                                    icon={LogOut}
                                    onClick={() => {
                                        onClose();
                                        logout();
                                    }}
                                >
                                    Wyloguj
                                </Button>

                                <div className="flex gap-2">
                                    <Button variant="secondary" size="sm" onClick={onClose}>
                                        Anuluj
                                    </Button>
                                    <Button variant="primary" size="sm" type="submit" loading={saving}>
                                        Zapisz Dane
                                    </Button>
                                </div>
                            </div>
                        </form>
                    )}

                    {activeTab === 'security' && (
                        <form onSubmit={handleSavePassword} className="space-y-4">
                            <div>
                                <label className="block text-[10px] uppercase font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                                    Aktualne Hasło Dostępowe
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="••••••••••••"
                                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-750 rounded px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                                />
                                {fieldErrors.currentPassword && (
                                    <div className="text-[10px] text-rose-500 dark:text-rose-400 mt-1 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        {fieldErrors.currentPassword}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-[10px] uppercase font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                                    Nowe Hasło (Min. 8 znaków)
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="••••••••••••"
                                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-750 rounded px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                                />
                                {fieldErrors.newPassword && (
                                    <div className="text-[10px] text-rose-500 dark:text-rose-400 mt-1 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        {fieldErrors.newPassword}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-[10px] uppercase font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                                    Powtórz Nowe Hasło
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••••••"
                                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-750 rounded px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                                />
                                {fieldErrors.confirmPassword && (
                                    <div className="text-[10px] text-rose-500 dark:text-rose-400 mt-1 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        {fieldErrors.confirmPassword}
                                    </div>
                                )}
                            </div>

                            <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded text-[10px] text-zinc-600 dark:text-zinc-500 leading-normal space-y-1">
                                <div className="font-semibold text-zinc-700 dark:text-zinc-400 flex items-center gap-1.5">
                                    <Shield className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                    STANDARD BEZPIECZEŃSTWA SANCTUM
                                </div>
                                <p>
                                    Zmiana hasła automatycznie unieważnia wszystkie aktywne tokeny sesji oprócz bieżącego.
                                </p>
                            </div>

                            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
                                <Button variant="secondary" size="sm" onClick={onClose}>
                                    Anuluj
                                </Button>
                                <Button variant="primary" size="sm" type="submit" loading={saving}>
                                    Aktualizuj Hasło
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
