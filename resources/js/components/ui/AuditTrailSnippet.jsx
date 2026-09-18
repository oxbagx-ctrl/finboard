import React from 'react';
import { ShieldCheck, FileText, Download, Upload, Terminal } from 'lucide-react';

export const AuditTrailSnippet = ({ className = '' }) => {
    const logs = [
        {
            time: '15:24:12',
            action: 'VDR_FILE_DOWNLOAD',
            actor: 'admin@helvest.com',
            resource: 'Sprawozdanie_Finansowe_Audyt_2025.pdf',
            hash: '7f83b165...7fd6',
            ip: '192.168.10.45',
            status: 'SUCCESS',
        },
        {
            time: '14:52:08',
            action: 'CSV_ASYNC_INGEST',
            actor: 'klient@acme.com',
            resource: 'Wyciag_Bankowy_PKO_Q2_2026.csv',
            hash: 'a1b2c3d4...99ea',
            ip: '89.64.120.12',
            status: 'QUEUED',
        },
        {
            time: '13:10:45',
            action: 'METRICS_EVALUATE',
            actor: 'admin@helvest.com',
            resource: 'FinancialCalculator::computePnl()',
            hash: '—',
            ip: '192.168.10.45',
            status: 'COMPUTED',
        },
        {
            time: '11:05:19',
            action: 'DATA_ROOM_ACCESS',
            actor: 'klient@acme.com',
            resource: 'Folder: 01_FINANSE_I_AUDYT',
            hash: '—',
            ip: '89.64.120.12',
            status: 'VERIFIED',
        },
    ];

    return (
        <div className={`bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-sm ${className}`}>
            <div className="px-4 py-2.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2 text-zinc-300">
                    <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="font-semibold uppercase text-[11px]">Dziennik Audytowy Ścieżki Nadzoru (Live Audit Feed)</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>LOGGING ACTIVE // IMMUTABLE</span>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[11px] border-collapse">
                    <thead>
                        <tr className="bg-zinc-950/50 border-b border-zinc-850 text-[10px] text-zinc-500 uppercase">
                            <th className="py-2 px-4 font-semibold">Czas (CET)</th>
                            <th className="py-2 px-3 font-semibold">Zdarzenie / Akcja</th>
                            <th className="py-2 px-3 font-semibold">Użytkownik (Actor)</th>
                            <th className="py-2 px-3 font-semibold">Obiekt / Zasób</th>
                            <th className="py-2 px-3 font-semibold">Suma SHA-256</th>
                            <th className="py-2 px-4 font-semibold text-right">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850/80">
                        {logs.map((log, i) => (
                            <tr key={i} className="hover:bg-zinc-850/50 text-zinc-300 transition-colors">
                                <td className="py-2 px-4 text-zinc-500 tabular-nums">{log.time}</td>
                                <td className="py-2 px-3 font-semibold text-zinc-200">{log.action}</td>
                                <td className="py-2 px-3 text-zinc-400">{log.actor}</td>
                                <td className="py-2 px-3 text-zinc-300 max-w-xs truncate">{log.resource}</td>
                                <td className="py-2 px-3 text-zinc-500">{log.hash}</td>
                                <td className="py-2 px-4 text-right">
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-zinc-950 border border-zinc-800 text-emerald-400">
                                        {log.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
