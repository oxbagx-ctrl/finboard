import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import apiClient from '../api/client';
import { Button } from '../components/ui/Button';
import { Lock, Mail, KeyRound } from 'lucide-react';

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

            login(
                response.data.token,
                response.data.user,
                response.data.available_companies || []
            );
            success(`Zalogowano pomyślnie jako ${response.data.user.name}`);
        } catch (err) {
            const msg = err.response?.data?.message || 'Błąd uwierzytelniania. Nieprawidłowe poświadczenia.';
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
        <div className="min-h-screen bg-zinc-950 flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-8 font-sans text-zinc-100">
            {/* Top institutional header */}
            <div className="w-full max-w-5xl mx-auto flex items-center justify-between pb-6 border-b border-zinc-800/80 text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="font-mono text-zinc-300">PORTAL DEAL ADVISORY & DATA ROOM</span>
                </div>
                <div className="flex items-center gap-4 font-mono text-[11px]">
                    <span className="text-zinc-500">TLS 1.3 / AES-256</span>
                    <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">SYS_V26.2</span>
                </div>
            </div>

            {/* Central Authentication Card */}
            <div className="my-auto w-full max-w-md mx-auto">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-zinc-900 border border-zinc-700/80 text-zinc-100 font-bold text-xl mb-4 tracking-tighter">
                        FB
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-zinc-100">
                        FinBoard Terminal
                    </h1>
                    <p className="mt-1 text-xs text-zinc-400">
                        Autoryzowany dostęp do portfela transakcyjnego Helvest Advisory
                    </p>
                </div>

                <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-7 shadow-2xl">
                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 font-mono">
                                Identyfikator służbowy (E-mail)
                            </label>
                            <div className="relative">
                                <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="analityk@helvest.com"
                                    className="w-full bg-zinc-950 border border-zinc-700/80 rounded-md pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400 transition-colors"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 font-mono">
                                Hasło dostępowe
                            </label>
                            <div className="relative">
                                <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••••••"
                                    className="w-full bg-zinc-950 border border-zinc-700/80 rounded-md pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400 transition-colors"
                                />
                            </div>
                        </div>

                        <div className="pt-2">
                            <Button
                                type="submit"
                                loading={loading}
                                className="w-full py-2.5 text-xs font-semibold uppercase tracking-wider bg-zinc-100 hover:bg-white text-zinc-950 border-0"
                                variant="primary"
                            >
                                Uwierzytelnij w portalu
                            </Button>
                        </div>
                    </form>

                    {/* Pre-configured authorization profiles for staging */}
                    <div className="mt-6 pt-5 border-t border-zinc-800">
                        <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                            <span className="flex items-center gap-1.5 font-mono">
                                <KeyRound className="w-3.5 h-3.5 text-zinc-400" />
                                Profile testowe (Staging)
                            </span>
                            <span className="text-[10px] text-zinc-600">1-KLIK</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => fillDemo('admin@helvest.com', 'password123')}
                                className="p-2.5 text-left rounded-md bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-colors"
                            >
                                <div className="text-xs font-medium text-zinc-200">Doradca M&A</div>
                                <div className="text-[10px] font-mono text-zinc-500 truncate mt-0.5">admin@helvest.com</div>
                            </button>

                            <button
                                type="button"
                                onClick={() => fillDemo('klient@acme.com', 'password123')}
                                className="p-2.5 text-left rounded-md bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-colors"
                            >
                                <div className="text-xs font-medium text-zinc-200">Klient / CFO</div>
                                <div className="text-[10px] font-mono text-zinc-500 truncate mt-0.5">klient@acme.com</div>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-6 text-center">
                    <p className="text-[11px] text-zinc-500 leading-relaxed font-mono">
                        Dostęp wyłącznie dla upoważnionego personelu doradczego i zarządów spółek. Wszystkie operacje są audytowane.
                    </p>
                </div>
            </div>

            {/* Bottom corporate footer */}
            <div className="w-full max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-zinc-800/80 text-[11px] text-zinc-500 font-mono gap-2">
                <div>Helvest Advisory Sp. z o.o. © 2026. Wszelkie prawa zastrzeżone.</div>
                <div className="flex items-center gap-3">
                    <span>SECURITY POLICY</span>
                    <span>•</span>
                    <span>AUDIT TRAIL COMPLIANT</span>
                </div>
            </div>
        </div>
    );
};
