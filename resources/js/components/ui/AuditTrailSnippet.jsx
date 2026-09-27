import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { Terminal, ShieldCheck, Activity } from 'lucide-react';
import { Tooltip, InfoTooltip } from './Tooltip';

export const AuditTrailSnippet = ({ className = '', logs: propLogs = null }) => {
    const [logs, setLogs] = useState(propLogs || []);
    const [loading, setLoading] = useState(!propLogs);

    useEffect(() => {
        if (propLogs) {
            setLogs(propLogs);
            setLoading(false);
            return;
        }

        let isMounted = true;
        const fetchAuditLogs = async () => {
            try {
                const response = await apiClient.get('/finance/audit-logs', {
                    params: { per_page: 5 },
                });
                if (isMounted) {
                    setLogs(response.data?.data || []);
                }
            } catch (err) {
                // Silently fallback to empty array on network/auth error
                if (isMounted) {
                    setLogs([]);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchAuditLogs();
        return () => {
            isMounted = false;
        };
    }, [propLogs]);

    const formatTime = (dateStr) => {
        if (!dateStr) return '—';
        try {
            const d = new Date(dateStr);
            return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } catch {
            return dateStr;
        }
    };

    const getBadgeStyle = (color) => {
        switch (color) {
            case 'emerald':
                return 'text-emerald-400 bg-emerald-950/60 border-emerald-800/80';
            case 'sky':
                return 'text-sky-400 bg-sky-950/60 border-sky-800/80';
            case 'amber':
                return 'text-amber-400 bg-amber-950/60 border-amber-800/80';
            case 'rose':
                return 'text-rose-400 bg-rose-950/60 border-rose-800/80';
            case 'purple':
                return 'text-purple-400 bg-purple-950/60 border-purple-800/80';
            default:
                return 'text-zinc-400 bg-zinc-800 border-zinc-700';
        }
    };

    return (
        <div className={`bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-sm ${className}`}>
            <div className="px-4 py-2.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2 text-zinc-300">
                    <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="font-semibold uppercase text-[11px]">Dziennik Audytowy Ścieżki Nadzoru (Live Audit Feed)</span>
                    <InfoTooltip
                        content="Niezmienny rejestr zdarzeń transakcyjnych i operacji finansowych (WORM - Write Once, Read Many). Rejestruje modyfikacje, pobrania oraz zdarzenia kontrolne."
                        ariaLabel="Informacje o dzienniku audytowym"
                        size="xs"
                    />
                </div>
                <Tooltip content="Rejestr WORM: wpisy są kryptograficznie zabezpieczone przed usunięciem lub modyfikacją">
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 cursor-help">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>LOGGING ACTIVE // IMMUTABLE</span>
                    </div>
                </Tooltip>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[11px] border-collapse">
                    <thead>
                        <tr className="bg-zinc-950/50 border-b border-zinc-850 text-[10px] text-zinc-500 uppercase">
                            <th className="py-2 px-4 font-semibold">Czas (CET)</th>
                            <th className="py-2 px-3 font-semibold">Zdarzenie / Akcja</th>
                            <th className="py-2 px-3 font-semibold">Użytkownik (Actor)</th>
                            <th className="py-2 px-3 font-semibold">Opis / Zasób</th>
                            <th className="py-2 px-3 font-semibold">Identyfikator</th>
                            <th className="py-2 px-4 font-semibold text-right">Kategoria</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850/80">
                        {loading ? (
                            <tr>
                                <td colSpan="6" className="py-6 text-center text-zinc-500">
                                    Ładowanie zdarzeń ścieżki audytowej...
                                </td>
                            </tr>
                        ) : logs.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="py-6 text-center text-zinc-500">
                                    Brak zarejestrowanych operacji audytowych dla bieżącej spółki.
                                </td>
                            </tr>
                        ) : (
                            logs.map((log, i) => {
                                const timeStr = log.created_at ? formatTime(log.created_at) : (log.time || '—');
                                const actionText = log.action_label || log.action;
                                const actorText = log.user?.name || log.user?.email || log.actor || 'System';
                                const resourceText = log.description || log.resource || log.entity_type;
                                const entityIdText = log.entity_id ? `${log.entity_id.substring(0, 8)}...` : (log.hash || '—');
                                const categoryText = log.action_category || log.status || 'AUDIT';
                                const badgeClass = getBadgeStyle(log.action_color);

                                return (
                                    <tr key={log.id || i} className="hover:bg-zinc-850/50 text-zinc-300 transition-colors">
                                        <td className="py-2 px-4 text-zinc-500 tabular-nums whitespace-nowrap">{timeStr}</td>
                                        <td className="py-2 px-3 font-semibold text-zinc-200 whitespace-nowrap">{actionText}</td>
                                        <td className="py-2 px-3 text-zinc-400 whitespace-nowrap">{actorText}</td>
                                        <td className="py-2 px-3 text-zinc-300 max-w-xs truncate">
                                            {resourceText ? (
                                                <Tooltip content={resourceText}>
                                                    <span className="truncate block cursor-default">{resourceText}</span>
                                                </Tooltip>
                                            ) : '—'}
                                        </td>
                                        <td className="py-2 px-3 text-zinc-500 tabular-nums">
                                            {log.entity_id ? (
                                                <Tooltip content={`Identyfikator encji: ${log.entity_id}`}>
                                                    <span className="cursor-help">{entityIdText}</span>
                                                </Tooltip>
                                            ) : (
                                                entityIdText
                                            )}
                                        </td>
                                        <td className="py-2 px-4 text-right whitespace-nowrap">
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase border ${badgeClass}`}>
                                                {categoryText}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
