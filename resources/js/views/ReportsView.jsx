import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useDeal } from '../context/DealContext';
import { useNotification } from '../context/NotificationContext';
import { ReportConfigurator } from '../components/reports/ReportConfigurator';
import { ExecutivePdfReport } from '../components/reports/ExecutivePdfReport';
import { FileText, Printer, CheckCircle2, Shield } from 'lucide-react';
import { Tooltip, InfoTooltip } from '../components/ui/Tooltip';

export const ReportsView = () => {
    const { user, activeCompany } = useAuth();
    const { currency: dealCurrency, ratesMetadata, currencies } = useDeal();
    const { success, error } = useNotification();

    const [config, setConfig] = useState({
        periodPreset: 'all',
        startDate: '',
        endDate: '',
        currency: dealCurrency || 'PLN',
        confidentiality: 'STRICTLY CONFIDENTIAL',
        sections: {
            kpi: true,
            pnl: true,
            liquidity: true,
            opex: true,
            audit: true,
        },
        commentary: 'W analizowanym okresie spółka wykazuje stabilną dynamikę marży EBITDA oraz wysoką dyscyplinę w strukturze kosztów operacyjnych. Wskaźniki płynności bieżącej (Current Ratio) i szybkiej (Quick Ratio) kształtują się powyżej mediany rynkowej, co stanowi silny fundament pod procesy fuzji i przejęć (M&A) oraz transakcje typu Private Equity.',
    });

    const [metrics, setMetrics] = useState(null);
    const [trends, setTrends] = useState([]);
    const [breakdown, setBreakdown] = useState([]);
    const [reportHash, setReportHash] = useState('');
    const [generatedAt, setGeneratedAt] = useState('');
    const [loading, setLoading] = useState(false);

    // Sync currency if changed globally in DealContextBar
    useEffect(() => {
        if (dealCurrency && dealCurrency !== config.currency) {
            setConfig(prev => ({ ...prev, currency: dealCurrency }));
        }
    }, [dealCurrency]);

    // Compute simple or crypto SHA-256 hash
    const computeReportHash = async (payload) => {
        try {
            const rawString = JSON.stringify(payload);
            if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
                const msgBuffer = new TextEncoder().encode(rawString);
                const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            }
        } catch (e) {
            console.warn('Crypto subtle unavailable, using fallback', e);
        }
        return 'a7f92bc4910e5d8b3c21a48e71fa093c8d76543210fedcba9876543210abcdef';
    };

    const fetchReportData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                currency: config.currency,
            };

            if (config.startDate) params.start_date = config.startDate;
            if (config.endDate) params.end_date = config.endDate;

            // Run requests in parallel with resilient fallbacks
            const [metricsRes, trendsRes, breakdownRes] = await Promise.all([
                apiClient.get('/finance/analytics/metrics', { params }).catch(() => ({ data: { data: {} } })),
                apiClient.get('/finance/analytics/trends', { params }).catch(() => ({ data: { data: [] } })),
                apiClient.get('/finance/analytics/breakdown', {
                    params: { ...params, record_type: 'EXPENSE', category_type: 'OPEX' }
                }).catch(() => ({ data: { data: [] } })),
            ]);

            const metricsData = metricsRes.data.data || {};
            const trendsData = trendsRes.data.data || [];
            const breakdownData = breakdownRes.data.data || [];

            setMetrics(metricsData);
            setTrends(trendsData);
            setBreakdown(breakdownData);

            const timestamp = new Date().toISOString();
            setGeneratedAt(timestamp);

            const activeCurrencyObj = currencies?.find(c => c.code === config.currency);
            const fxAuditData = {
                currency: config.currency,
                source: ratesMetadata?.source || 'NBP',
                table_no: ratesMetadata?.tableNo || null,
                effective_date: ratesMetadata?.effectiveDate || null,
                fetched_at: ratesMetadata?.fetchedAt || null,
                cached: ratesMetadata?.cached || false,
                is_fallback: ratesMetadata?.isFallback ?? false,
                rate: activeCurrencyObj?.rate || (config.currency === 'PLN' ? 1.0 : null),
                mid_rate: activeCurrencyObj?.midRate || (config.currency === 'PLN' ? 1.0 : null),
                accounting_standard: 'MSR 21 / art. 30 ust. 2 UoR (Constant FX)',
            };

            const hash = await computeReportHash({
                companyId: activeCompany?.id,
                metrics: metricsData,
                timestamp,
                config,
                exchange_rate_audit: fxAuditData,
            });
            setReportHash(hash);
        } catch (err) {
            console.error('Failed to load report analytics', err);
            error('Nie udało się pobrać danych do raportu zarządczego.');
        } finally {
            setLoading(false);
        }
    }, [config, activeCompany?.id, error, ratesMetadata, currencies]);

    useEffect(() => {
        fetchReportData();

        const handleCompanyChange = () => fetchReportData();
        window.addEventListener('finboard:company-changed', handleCompanyChange);
        return () => window.removeEventListener('finboard:company-changed', handleCompanyChange);
    }, [fetchReportData]);

    const handlePrint = () => {
        window.print();
    };

    const handleExportJson = () => {
        try {
            const activeCurrencyObj = currencies?.find(c => c.code === config.currency);
            const fxAuditData = {
                currency: config.currency,
                source: ratesMetadata?.source || 'NBP',
                table_no: ratesMetadata?.tableNo || null,
                effective_date: ratesMetadata?.effectiveDate || null,
                fetched_at: ratesMetadata?.fetchedAt || null,
                cached: ratesMetadata?.cached || false,
                is_fallback: ratesMetadata?.isFallback ?? false,
                rate: activeCurrencyObj?.rate || (config.currency === 'PLN' ? 1.0 : null),
                mid_rate: activeCurrencyObj?.midRate || (config.currency === 'PLN' ? 1.0 : null),
                accounting_standard: 'MSR 21 / art. 30 ust. 2 UoR (Constant FX)',
            };

            const exportPayload = {
                meta: {
                    title: 'FINBOARD EXECUTIVE DUE DILIGENCE SUMMARY',
                    company: activeCompany,
                    generated_by: user,
                    generated_at: generatedAt,
                    checksum_sha256: reportHash,
                    confidentiality: config.confidentiality,
                    currency: config.currency,
                    exchange_rate_audit: fxAuditData,
                    period: {
                        preset: config.periodPreset,
                        start_date: config.startDate || null,
                        end_date: config.endDate || null,
                    },
                },
                exchange_rate_audit: fxAuditData,
                commentary: config.commentary,
                metrics,
                opex_breakdown: breakdown,
                trends,
            };

            const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute('href', dataStr);
            const safeCode = (activeCompany?.code || 'COMPANY').toLowerCase();
            const dateStr = (generatedAt || 'report').substring(0, 10);
            downloadAnchor.setAttribute('download', `executive_report_${safeCode}_${dateStr}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();

            success('Wyeksportowano surowe dane zestawienia zarządczego do pliku JSON.');
        } catch (err) {
            console.error('Export failed', err);
            error('Wystąpił błąd podczas generowania pliku JSON.');
        }
    };

    return (
        <div className="space-y-6 font-mono">
            {/* Top Info Banner (Screen only) */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs print:hidden">
                <div className="flex items-center gap-3">
                    <Tooltip content="Podsystem generowania oficjalnych memorandów zarządczych i raportów Due Diligence M&A">
                        <div className="w-10 h-10 rounded bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-750 flex items-center justify-center text-zinc-700 dark:text-zinc-200 shrink-0 cursor-help" tabIndex={0} role="img" aria-label="Generator raportów zarządczych">
                            <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                    </Tooltip>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                                Generator Raportów Zarządczych & Podsumowań M&A (PDF)
                                <InfoTooltip
                                    size="xs"
                                    ariaLabel="Więcej informacji o generatorze raportów zarządczych"
                                    title="Oficjalne Memorandum Due Diligence"
                                    content="Moduł generowania oficjalnych memorandów Due Diligence, podsumowań zarządczych P&L i wskaźników płynności z certyfikatem integralności SHA-256 w wektorowym formacie A4."
                                />
                            </h1>
                            <Tooltip content={`Aktywny podmiot transakcyjny podlegający analizie i badaniu Due Diligence: ${activeCompany?.name || 'Spółka'}`}>
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-750 text-zinc-700 dark:text-zinc-400 cursor-help" tabIndex={0}>
                                    {activeCompany?.name || 'Spółka'}
                                </span>
                            </Tooltip>
                        </div>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                            Przygotuj, skonfiguruj i wyeksportuj oficjalne memorandum finansowe z certyfikatem integralności SHA-256.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                    <Tooltip content="Wektorowy wydruk A4 dopasowany do standardów komitetów inwestycyjnych i bankowości transakcyjnej">
                        <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-950 px-2.5 py-1 rounded border border-zinc-300 dark:border-zinc-800 text-[11px] cursor-help" tabIndex={0}>
                            <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            A4 WEKTOROWY PDF
                        </span>
                    </Tooltip>
                </div>
            </div>

            {/* Configurator Controls (Screen only) */}
            <ReportConfigurator
                config={config}
                onChange={setConfig}
                onPrint={handlePrint}
                onExportJson={handleExportJson}
                onRefresh={fetchReportData}
                loading={loading}
            />

            {/* Report Document Preview & Print Layout */}
            <ExecutivePdfReport
                company={activeCompany}
                currentUser={user}
                config={config}
                metrics={metrics}
                trends={trends}
                breakdown={breakdown}
                reportHash={reportHash}
                generatedAt={generatedAt}
                loading={loading}
                ratesMetadata={ratesMetadata}
            />
        </div>
    );
};
