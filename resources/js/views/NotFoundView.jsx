import React from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, LayoutDashboard, LogIn, Terminal, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../constants/routes';

export const NotFoundView = () => {
    let auth = {};
    try {
        auth = useAuth();
    } catch {
        auth = { isAuthenticated: false, activeCompany: null };
    }

    let location = null;
    let navigate = null;
    try {
        location = useLocation();
        navigate = useNavigate();
    } catch {
        location = typeof window !== 'undefined' ? window.location : { pathname: '/unknown' };
        navigate = (to) => {
            if (typeof to === 'number' && typeof window !== 'undefined') {
                window.history.back();
            } else if (typeof window !== 'undefined') {
                window.location.href = to;
            }
        };
    }

    const requestedPath = location?.pathname || (typeof window !== 'undefined' ? window.location.pathname : 'N/A');
    const { isAuthenticated, activeCompany } = auth;

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between p-6 sm:p-12 font-mono selection:bg-zinc-700 selection:text-white">
            {/* Top Institutional Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-zinc-100 flex items-center justify-center text-zinc-950 font-black text-xs tracking-tighter">
                        FB
                    </div>
                    <div>
                        <div className="font-bold text-xs tracking-wider uppercase text-zinc-100">
                            FinBoard
                        </div>
                        <div className="text-[10px] text-zinc-500">HELVEST ADVISORY GROUP</div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        HTTP 404 // NOT_FOUND
                    </span>
                </div>
            </div>

            {/* Central Terminal / 404 Display */}
            <div className="max-w-2xl w-full mx-auto my-12 space-y-6">
                <div className="flex items-center gap-3 text-amber-500">
                    <ShieldAlert className="w-8 h-8 text-amber-400 shrink-0" />
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-wider text-zinc-100">
                            404: Zasób Nie Został Odnaleziony
                        </h1>
                        <p className="text-xs text-zinc-400 mt-1">
                            Żądana ścieżka URI nie jest powiązana z żadnym aktywnym modułem platformy transakcyjnej.
                        </p>
                    </div>
                </div>

                {/* Diagnostics Terminal Card */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2 text-[11px] text-zinc-400">
                        <span className="flex items-center gap-1.5 font-semibold text-zinc-300">
                            <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                            DIAGNOSTYKA ROUTINGU SPA
                        </span>
                        <span className="text-zinc-500">ERR_ROUTE_NOT_REGISTERED</span>
                    </div>

                    <div className="space-y-2 text-xs font-mono">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-zinc-850">
                            <span className="text-zinc-500">ŻĄDANY ADRES (URI):</span>
                            <span className="text-amber-400 break-all font-semibold" data-testid="404-requested-path">
                                {requestedPath}
                            </span>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-zinc-850">
                            <span className="text-zinc-500">STATUS SESJI:</span>
                            <span className={isAuthenticated ? 'text-emerald-400' : 'text-zinc-400'}>
                                {isAuthenticated ? 'UWIERZYTELNIONY (AUTH_OK)' : 'GOŚĆ (ANONYMOUS)'}
                            </span>
                        </div>

                        {activeCompany && (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-zinc-850">
                                <span className="text-zinc-500">AKTYWNY PODMIOT:</span>
                                <span className="text-zinc-200">
                                    {activeCompany.code} – {activeCompany.name}
                                </span>
                            </div>
                        )}

                        <div className="p-3 bg-zinc-950 rounded border border-zinc-800/80 text-[11px] text-zinc-400 space-y-1">
                            <div className="text-zinc-500"># Konsola diagnostyczna jądra React Router:</div>
                            <div className="text-zinc-300">
                                $ finboard route:match --uri="{requestedPath}"
                            </div>
                            <div className="text-rose-400">
                                [FAIL] Żadna reguła routingu nie pasuje do wzorca ścieżki.
                            </div>
                        </div>
                    </div>

                    {/* Navigation Actions */}
                    <div className="pt-2 flex flex-wrap items-center gap-3">
                        {isAuthenticated ? (
                            <Link
                                to={ROUTES.DASHBOARD}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-bold uppercase transition-colors"
                            >
                                <LayoutDashboard className="w-4 h-4" />
                                Pulpit Zarządczy
                            </Link>
                        ) : (
                            <Link
                                to={ROUTES.LOGIN}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-bold uppercase transition-colors"
                            >
                                <LogIn className="w-4 h-4" />
                                Ekran Logowania
                            </Link>
                        )}

                        <button
                            type="button"
                            onClick={() => {
                                if (navigate) navigate(-1);
                                else if (typeof window !== 'undefined') window.history.back();
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-200 text-xs font-semibold uppercase transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Powrót do Poprzedniej Strony
                        </button>
                    </div>
                </div>
            </div>

            {/* Institutional Footer */}
            <div className="border-t border-zinc-800 pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-zinc-500 uppercase">
                <span>FinBoard Deal Advisory System // Wersja Enterprise</span>
                <span>Identyfikator incydentu: RES-404-SPA</span>
            </div>
        </div>
    );
};

export default NotFoundView;
