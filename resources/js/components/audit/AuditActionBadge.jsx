import React from 'react';
import {
    PlusCircle,
    ArrowRightLeft,
    Trash2,
    Layers,
    Target,
    RotateCcw,
    FileSpreadsheet,
    AlertTriangle,
    Activity,
    UploadCloud,
    DownloadCloud,
    Archive,
    FileText,
    Database,
} from 'lucide-react';

/**
 * Audit action configuration with unified color palette, category, label and icon mapping.
 */
export const AUDIT_ACTION_CONFIG = {
    // Financial Record actions
    RECORD_CREATED: {
        label: 'Utworzenie rekordu finansowego',
        color: 'emerald',
        category: 'financial_record',
        icon: PlusCircle,
    },
    RECORD_UPDATED: {
        label: 'Modyfikacja rekordu finansowego',
        color: 'blue',
        category: 'financial_record',
        icon: ArrowRightLeft,
    },
    RECORD_DELETED: {
        label: 'Usunięcie rekordu finansowego',
        color: 'rose',
        category: 'financial_record',
        icon: Trash2,
    },
    RECORDS_BATCH_DELETED: {
        label: 'Masowe usunięcie rekordów finansowych',
        color: 'rose',
        category: 'financial_record',
        icon: Layers,
    },

    // Benchmark actions
    BENCHMARK_CONFIGURED: {
        label: 'Konfiguracja celu finansowego',
        color: 'indigo',
        category: 'benchmark',
        icon: Target,
    },
    BENCHMARK_RESET: {
        label: 'Reset celów benchmarkowych',
        color: 'amber',
        category: 'benchmark',
        icon: RotateCcw,
    },

    // CSV Import actions
    CSV_IMPORT_PROCESSED: {
        label: 'Asynchroniczny import danych CSV',
        color: 'cyan',
        category: 'import',
        icon: FileSpreadsheet,
    },
    CSV_IMPORT_FAILED: {
        label: 'Niepowodzenie importu CSV',
        color: 'red',
        category: 'import',
        icon: AlertTriangle,
    },

    // Analytics actions
    METRICS_EVALUATED: {
        label: 'Ewaluacja wskaźników KPI',
        color: 'violet',
        category: 'analytics',
        icon: Activity,
    },

    // VDR Document actions
    upload: {
        label: 'Upload',
        color: 'emerald',
        category: 'document',
        icon: UploadCloud,
    },
    download: {
        label: 'Pobranie',
        color: 'blue',
        category: 'document',
        icon: DownloadCloud,
    },
    update: {
        label: 'Modyfikacja',
        color: 'blue',
        category: 'document',
        icon: ArrowRightLeft,
    },
    destroy: {
        label: 'Usunięcie',
        color: 'rose',
        category: 'document',
        icon: Trash2,
    },
    delete: {
        label: 'Usunięcie',
        color: 'rose',
        category: 'document',
        icon: Trash2,
    },
    archive: {
        label: 'Archiwizacja',
        color: 'amber',
        category: 'document',
        icon: Archive,
    },
    unarchive: {
        label: 'Przywrócenie',
        color: 'zinc',
        category: 'document',
        icon: RotateCcw,
    },
};

/**
 * Category metadata for grouping audit events.
 */
export const AUDIT_CATEGORY_CONFIG = {
    financial_record: {
        label: 'Księga Finansowa',
        icon: Database,
        color: 'blue',
    },
    finance_records: {
        label: 'Księga Finansowa',
        icon: Database,
        color: 'blue',
    },
    benchmark: {
        label: 'Cele Benchmarkowe',
        icon: Target,
        color: 'indigo',
    },
    import: {
        label: 'Import Danych',
        icon: FileSpreadsheet,
        color: 'cyan',
    },
    analytics: {
        label: 'Analityka i KPI',
        icon: Activity,
        color: 'violet',
    },
    document: {
        label: 'Dokumenty VDR',
        icon: FileText,
        color: 'emerald',
    },
};

/**
 * Harmonized terminal-styled color palette for audit badges.
 */
export const getAuditBadgeColorClass = (color) => {
    switch (color) {
        case 'emerald':
            return 'bg-emerald-950/70 border-emerald-800 text-emerald-300';
        case 'blue':
            return 'bg-blue-950/70 border-blue-800 text-blue-300';
        case 'rose':
            return 'bg-rose-950/70 border-rose-800 text-rose-300';
        case 'red':
            return 'bg-red-950/70 border-red-800 text-red-300';
        case 'amber':
            return 'bg-amber-950/70 border-amber-800 text-amber-300';
        case 'indigo':
            return 'bg-indigo-950/70 border-indigo-800 text-indigo-300';
        case 'cyan':
            return 'bg-cyan-950/70 border-cyan-800 text-cyan-300';
        case 'violet':
            return 'bg-violet-950/70 border-violet-800 text-violet-300';
        case 'zinc':
        case 'gray':
        default:
            return 'bg-zinc-850 border-zinc-750 text-zinc-300';
    }
};

export const getActionBadgeClass = getAuditBadgeColorClass;

/**
 * Harmonized action badge component with icon, label, and terminal styling.
 */
export const AuditActionBadge = ({
    action,
    label,
    color,
    category,
    icon: CustomIcon,
    showIcon = true,
    testId,
    className = '',
}) => {
    const config = AUDIT_ACTION_CONFIG[action] || {};
    const effectiveColor = color || config.color || 'zinc';
    const effectiveLabel = label || config.label || action || 'Nieznana akcja';
    const IconComponent = CustomIcon || config.icon || FileText;

    const colorClasses = getAuditBadgeColorClass(effectiveColor);

    return (
        <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${colorClasses} ${className}`}
            data-testid={testId}
        >
            {showIcon && IconComponent && <IconComponent className="w-3 h-3 shrink-0" />}
            <span>{effectiveLabel}</span>
        </span>
    );
};

export default AuditActionBadge;
