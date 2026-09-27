import React from 'react';
import { Shield, ShieldAlert, ShieldCheck, Eye, Download, Lock, Key } from 'lucide-react';

export const VdrPermissionBadge = ({ level = 'view', size = 'sm' }) => {
    const configs = {
        none: {
            label: 'Brak dostępu',
            icon: Lock,
            cls: 'bg-rose-950/70 border-rose-800 text-rose-300',
        },
        view: {
            label: 'Tylko podgląd',
            icon: Eye,
            cls: 'bg-cyan-950/70 border-cyan-800 text-cyan-300',
        },
        download: {
            label: 'Pobieranie',
            icon: Download,
            cls: 'bg-emerald-950/70 border-emerald-800 text-emerald-300',
        },
        manage: {
            label: 'Zarządzanie',
            icon: Key,
            cls: 'bg-purple-950/70 border-purple-800 text-purple-300',
        },
    };

    const config = configs[level] || configs.view;
    const Icon = config.icon;

    return (
        <span
            className={`inline-flex items-center gap-1 font-mono font-semibold rounded border px-2 py-0.5 uppercase tracking-wider ${
                size === 'xs' ? 'text-[9px]' : 'text-[10px]'
            } ${config.cls}`}
            title={`Poziom uprawnień VDR: ${config.label}`}
        >
            <Icon className={size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
            <span>{config.label}</span>
        </span>
    );
};

export const WatermarkBadge = ({ required = true, size = 'sm' }) => {
    if (!required) {
        return null;
    }

    return (
        <span
            className={`inline-flex items-center gap-1 font-mono font-bold rounded border px-1.5 py-0.5 bg-amber-950/60 border-amber-700/80 text-amber-300 shrink-0 ${
                size === 'xs' ? 'text-[9px]' : 'text-[10px]'
            }`}
            title="Dokument objęty dynamicznym znakiem wodnym (identyfikator użytkownika, IP, znacznik czasu)"
        >
            <ShieldAlert className={size === 'xs' ? 'w-2.5 h-2.5 text-amber-400' : 'w-3 h-3 text-amber-400'} />
            <span>ZNAK WODNY</span>
        </span>
    );
};
