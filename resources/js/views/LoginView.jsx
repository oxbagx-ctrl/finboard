import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import apiClient from '../api/client';
import { Button } from '../components/ui/Button';
import { Shield, Lock, Mail, Building, Sparkles } from 'lucide-react';

export const LoginView = () => {
    const { login } = useAuth();
    const { success, error } = useNotification();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await apiClient.post('/auth/login', {
                email,
                password,
            });

            login(response.data.token, response.data.user);
            success(`Zalogowano pomyślnie jako ${response.data.user.name}`);
        } catch (err) {
            const msg = err.response?.data?.message || 'Błąd logowania. Sprawdź poprawność danych.';
            error(msg);
        } finally {
            setLoading(false);
        }
    };

    const fillDemo = (demoEmail, demoPassword) => {
        setEmail(demoEmail);
        setPassword(demoPassword);
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Background glowing orbs */}
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                <div className="flex justify-center mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white font-extrabold text-2xl shadow-xl shadow-brand-600/30">
                        F
                    </div>
                </div>
                <h2 className="text-center text-3xl font-extrabold tracking-tight text-white">
                    FinBoard Platform
                </h2>
                <p className="mt-2 text-center text-sm text-slate-400">
                    Financial Analytics & Virtual Data Room dla transakcji M&A
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                <div className="bg-slate-900/90 border border-slate-800/80 py-8 px-6 shadow-2xl rounded-3xl sm:px-10 backdrop-blur-xl">
                    <form className="space-y-5" onSubmit={handleSubmit}>
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                                Adres e-mail
                            </label>
                            <div className="relative">
                                <Mail className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="twoj.email@firma.pl"
                                    className="w-full bg-slate-800/70 border border-slate-700/80 rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                                Hasło dostępowe
                            </label>
                            <div className="relative">
                                <Lock className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••••••"
                                    className="w-full bg-slate-800/70 border border-slate-700/80 rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <Button
                                type="submit"
                                loading={loading}
                                className="w-full py-3"
                                variant="primary"
                            >
                                Zaloguj się do platformy
                            </Button>
                        </div>
                    </form>

                    {/* Quick demo accounts */}
                    <div className="mt-8 pt-6 border-t border-slate-800">
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                            Konta demonstracyjne (1-kliknięcie):
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                            <button
                                type="button"
                                onClick={() => fillDemo('admin@helvest.com', 'password123')}
                                className="p-3 text-left rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-brand-500/50 transition-all group"
                            >
                                <div className="text-xs font-semibold text-slate-200 group-hover:text-brand-300">
                                    Doradca M&A
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">Helvest Advisory</div>
                            </button>

                            <button
                                type="button"
                                onClick={() => fillDemo('klient@acme.com', 'password123')}
                                className="p-3 text-left rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-brand-500/50 transition-all group"
                            >
                                <div className="text-xs font-semibold text-slate-200 group-hover:text-brand-300">
                                    Klient / CFO
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">Acme Manufacturing</div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
