import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { ROUTES } from '../constants/routes';
import { CsvDropzone } from '../components/import/CsvDropzone';
import { CsvPreviewTable } from '../components/import/CsvPreviewTable';
import { ImportJobProgress } from '../components/import/ImportJobProgress';
import { ImportHistoryTable } from '../components/import/ImportHistoryTable';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Tooltip, InfoTooltip } from '../components/ui/Tooltip';
import {
    FileSpreadsheet,
    Server,
    ShieldCheck,
    Layers,
    ArrowRight
} from 'lucide-react';

export const ImportView = () => {
    const { activeCompany } = useAuth();
    const { success, error, info } = useNotification();

    let navigate = null;
    try {
        navigate = useNavigate();
    } catch {
        navigate = (to) => {
            if (typeof window !== 'undefined') window.location.href = to;
        };
    }

    // Workflow states
    const [file, setFile] = useState(null);
    const [validating, setValidating] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [importing, setImporting] = useState(false);
    const [activeImportJob, setActiveImportJob] = useState(null);

    // History state
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Fetch import history
    const fetchHistory = useCallback(async () => {
        setLoadingHistory(true);
        try {
            const res = await apiClient.get('/finance/imports/history');
            setHistory(res.data.data || []);
        } catch (e) {
            console.error('Failed to load import history', e);
        } finally {
            setLoadingHistory(false);
        }
    }, [activeCompany?.id]);

    useEffect(() => {
        fetchHistory();

        const handleCompanyChange = () => {
            setFile(null);
            setPreviewData(null);
            setActiveImportJob(null);
            fetchHistory();
        };
        window.addEventListener('finboard:company-changed', handleCompanyChange);
        return () => window.removeEventListener('finboard:company-changed', handleCompanyChange);
    }, [fetchHistory]);

    // Handle file selection & trigger preview
    const handleFileSelected = async (selectedFile) => {
        setFile(selectedFile);
        setValidating(true);
        setPreviewData(null);

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);

            const res = await apiClient.post('/finance/imports/preview', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setPreviewData(res.data);
            if (res.data.valid) {
                info(`Zweryfikowano ${res.data.total_rows} wierszy. Plik gotowy do importu.`);
            } else {
                error(`Wykryto ${res.data.error_count} błędów w pliku CSV.`);
            }
        } catch (err) {
            error(err.response?.data?.message || 'Błąd podczas weryfikacji pliku CSV.');
            setFile(null);
        } finally {
            setValidating(false);
        }
    };

    const handleClearFile = () => {
        setFile(null);
        setPreviewData(null);
        setActiveImportJob(null);
    };

    // Execute background import
    const handleConfirmImport = async () => {
        if (!file) return;

        setImporting(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await apiClient.post('/finance/imports', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            success('Zadanie importu zostało zarejestrowane w kolejce Redis.');
            setActiveImportJob(res.data.data);
            setPreviewData(null);
            setFile(null);
            fetchHistory();
        } catch (err) {
            error(err.response?.data?.message || 'Nie udało się zakolejkować zadania importu.');
        } finally {
            setImporting(false);
        }
    };

    // Download sample template
    const handleDownloadTemplate = () => {
        const sampleCsv = `kategoria,kwota,data,waluta,opis\ncat-revenue,54200.00,2026-06-01,PLN,Przychody z kontraktu doradczego\ncat-payroll,18500.00,2026-06-05,PLN,Wynagrodzenia zespołu inżynierskiego\ncat-office,3200.00,2026-06-10,PLN,Wynajem powierzchni biurowej\ncat-marketing,4500.00,2026-06-12,PLN,Kampania digital performance marketing\ncat-it,2800.00,2026-06-15,PLN,Infrastruktura chmurowa AWS i licencje SaaS\ncat-cogs,12000.00,2026-06-18,PLN,Zakup surowców i podzespołów\ncat-financial,1450.00,2026-06-20,PLN,Obsługa zadłużenia bankowego (odsetki)`;

        const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `szablon_finboard_import.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        info('Pobrano wzorcowy szablon CSV.');
    };

    const handleNavigateRecords = () => {
        if (navigate) {
            navigate(ROUTES.RECORDS);
        } else if (typeof window !== 'undefined') {
            window.location.href = ROUTES.RECORDS;
        }
    };

    return (
        <div className="space-y-6 font-mono">
            {/* Header Strip */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <div className="flex items-center gap-3">
                    <Tooltip content="Moduł wsadowego importu wyciągów bankowych i zbiorów danych CSV">
                        <div className="w-8 h-8 rounded bg-zinc-850 border border-zinc-750 flex items-center justify-center text-zinc-300 cursor-help">
                            <FileSpreadsheet className="w-4 h-4" />
                        </div>
                    </Tooltip>
                    <div>
                        <div className="text-xs font-bold text-zinc-100 flex items-center gap-2">
                            <span>Asynchroniczny Import Danych CSV</span>
                            <Tooltip content={`Podmiot docelowy importu: ${activeCompany?.name || 'Spółka portfelowa'} (${activeCompany?.code || 'PODMIOT'})`}>
                                <span>
                                    <Badge variant="default" size="sm">{activeCompany?.code || 'PODMIOT'}</Badge>
                                </span>
                            </Tooltip>
                            <InfoTooltip
                                size="xs"
                                title="Asynchroniczny Import Danych CSV"
                                ariaLabel="Więcej informacji o module importu CSV"
                                content="Moduł umożliwia bezpieczne masowe ładowanie wyciągów bankowych i zestawień operacji. Dane podlegają weryfikacji Dry-Run, po czym przetwarzane są w tle przez asynchroniczną kolejkę Redis Worker."
                            />
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                            Kolejkowanie asynchroniczne Redis (financial-imports) | Podmiot docelowy: {activeCompany?.name}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <Tooltip content="Kolejka asynchroniczna Redis Worker (financial-imports) jest aktywna i gotowa do przetwarzania wsadowego">
                        <span className="flex items-center gap-1 cursor-help">
                            <Server className="w-3.5 h-3.5 text-emerald-400" />
                            Worker: Aktywny
                        </span>
                    </Tooltip>
                    <span>•</span>
                    <Tooltip content="Każdy plik CSV jest wstępnie weryfikowany bez modyfikacji bazy danych pod kątem poprawności nagłówków, kwot i kategorii">
                        <span className="flex items-center gap-1 cursor-help">
                            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                            Walidacja Dry-Run
                        </span>
                    </Tooltip>
                </div>
            </div>

            {/* Main Upload / Progress Box */}
            {activeImportJob ? (
                <ImportJobProgress
                    importJob={activeImportJob}
                    onComplete={() => fetchHistory()}
                    onReset={() => setActiveImportJob(null)}
                    onNavigateRecords={handleNavigateRecords}
                />
            ) : (
                <div className="space-y-4">
                    <CsvDropzone
                        selectedFile={file}
                        onFileSelected={handleFileSelected}
                        onClearFile={handleClearFile}
                        onDownloadTemplate={handleDownloadTemplate}
                        loading={validating || importing}
                    />

                    {validating && (
                        <div className="p-8 bg-zinc-900 border border-zinc-800 rounded-lg text-center space-y-2">
                            <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
                            <div className="text-xs font-bold text-zinc-200 flex items-center justify-center gap-1.5">
                                <span>Weryfikacja struktury pliku CSV (Dry-Run Preview)...</span>
                                <InfoTooltip
                                    size="xs"
                                    title="Weryfikacja Dry-Run"
                                    ariaLabel="Informacje o weryfikacji Dry-Run"
                                    content="Proces symulacyjny testuje integralność danych, mapowanie kolumn, formaty numeryczne i istnienie kategorii w planie kont przed zaksięgowaniem."
                                />
                            </div>
                            <p className="text-[10px] text-zinc-500">
                                Parsowanie nagłówków, formatów walutowych oraz poprawności identyfikatorów kategorii
                            </p>
                        </div>
                    )}

                    {previewData && !validating && (
                        <CsvPreviewTable
                            previewData={previewData}
                            onConfirmImport={handleConfirmImport}
                            importing={importing}
                            onCancel={handleClearFile}
                        />
                    )}
                </div>
            )}

            {/* Import History / Audit Trail */}
            <ImportHistoryTable
                history={history}
                loading={loadingHistory}
                onRefresh={fetchHistory}
            />
        </div>
    );
};
