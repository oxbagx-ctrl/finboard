import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../api/client';
import { useNotification } from '../../context/NotificationContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Tooltip, InfoTooltip } from '../ui/Tooltip';
import {
    X,
    Building2,
    Search,
    Check,
    Briefcase,
    Shield,
    Users,
    Save,
    CheckSquare,
    Square
} from 'lucide-react';

export const AdvisorAssignmentModal = ({ isOpen, onClose, advisor, onSaved, companies: propCompanies = null }) => {
    const { success, error } = useNotification();
    const [companies, setCompanies] = useState([]);
    const [selectedCompanyIds, setSelectedCompanyIds] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen && advisor) {
            const initialIds = (advisor.assigned_companies || []).map(c => c.id);
            setSelectedCompanyIds(initialIds);
            if (propCompanies && propCompanies.length > 0) {
                setCompanies(propCompanies);
            }
            fetchCompanies();
        }
    }, [isOpen, advisor, propCompanies]);

    const fetchCompanies = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/admin/companies');
            setCompanies(res.data.data || []);
        } catch (err) {
            error('Nie udało się pobrać listy spółek z serwera.');
        } finally {
            setLoading(false);
        }
    };

    const filteredCompanies = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return companies;
        return companies.filter(c =>
            c.name.toLowerCase().includes(query) ||
            c.code.toLowerCase().includes(query) ||
            (c.tax_id && c.tax_id.toLowerCase().includes(query))
        );
    }, [companies, searchQuery]);

    const toggleCompany = (companyId) => {
        setSelectedCompanyIds(prev =>
            prev.includes(companyId)
                ? prev.filter(id => id !== companyId)
                : [...prev, companyId]
        );
    };

    const handleSelectAll = () => {
        const allIds = companies.map(c => c.id);
        setSelectedCompanyIds(allIds);
    };

    const handleDeselectAll = () => {
        setSelectedCompanyIds([]);
    };

    const handleSave = async () => {
        if (!advisor) return;
        setSaving(true);
        try {
            const response = await apiClient.put(`/admin/advisors/${advisor.id}/companies`, {
                company_ids: selectedCompanyIds,
            });
            success(`Przypisania dla doradcy ${advisor.name} zostały pomyślnie zaktualizowane.`);
            if (onSaved) {
                onSaved(response.data.data);
            }
            onClose();
        } catch (err) {
            const msg = err.response?.data?.message || 'Wystąpił błąd podczas zapisywania przypisań.';
            error(msg);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen || !advisor) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-xs font-mono">
            <div className="bg-zinc-900 border border-zinc-750 rounded-lg shadow-2xl max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-5 py-3.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                        <Tooltip content="Zarządzanie zakresem dostępu doradcy do spółek portfelowych">
                            <div
                                tabIndex={0}
                                role="img"
                                aria-label="Zarządzanie zakresem dostępu doradcy do spółek portfelowych"
                                className="w-7 h-7 rounded bg-zinc-850 border border-zinc-750 flex items-center justify-center text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                            >
                                <Briefcase className="w-4 h-4" />
                            </div>
                        </Tooltip>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-100">
                                    Przypisanie Spółek Portfelowych
                                </h2>
                                <Tooltip content={`Rola systemowa: ${advisor.role.toUpperCase()}`}>
                                    <span>
                                        <Badge variant={advisor.role === 'super_admin' ? 'purple' : 'brand'} size="sm">
                                            {advisor.role.toUpperCase()}
                                        </Badge>
                                    </span>
                                </Tooltip>
                            </div>
                            <p className="text-[10px] text-zinc-500 mt-0.5">
                                DORADCA: <span className="text-zinc-300 font-semibold">{advisor.name}</span> ({advisor.email})
                            </p>
                        </div>
                    </div>
                    <Tooltip content="Zamknij (Esc)">
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Zamknij"
                            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </Tooltip>
                </div>

                {/* Sub-bar: Search & Selection Controls */}
                <div className="p-3 bg-zinc-950/60 border-b border-zinc-800 space-y-2 shrink-0">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filtruj spółki po nazwie, tickerze lub NIP..."
                            className="w-full bg-zinc-950 border border-zinc-750 rounded pl-9 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                        />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-zinc-400">
                        <div className="flex items-center gap-2">
                            <span>ZAZNACZONO:</span>
                            <Tooltip content="Liczba spółek wybranych do przypisania dla tego doradcy">
                                <span tabIndex={0} className="font-bold text-zinc-100 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700 cursor-help focus:outline-none focus:ring-1 focus:ring-zinc-400">
                                    {selectedCompanyIds.length} / {companies.length}
                                </span>
                            </Tooltip>
                        </div>
                        <div className="flex items-center gap-2">
                            <Tooltip content="Przypisz wszystkie dostępne spółki portfelowe">
                                <button
                                    type="button"
                                    onClick={handleSelectAll}
                                    aria-label="Zaznacz wszystkie spółki"
                                    className="text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                                >
                                    Zaznacz wszystkie
                                </button>
                            </Tooltip>
                            <span>•</span>
                            <Tooltip content="Usuń przypisanie do wszystkich spółek">
                                <button
                                    type="button"
                                    onClick={handleDeselectAll}
                                    aria-label="Odznacz wszystkie spółki"
                                    className="text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                                >
                                    Odznacz wszystkie
                                </button>
                            </Tooltip>
                        </div>
                    </div>
                </div>

                {/* Companies Checklist List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-[220px]">
                    {loading ? (
                        <div className="py-12 text-center text-xs text-zinc-500">
                            Ładowanie podmiotów portfelowych...
                        </div>
                    ) : filteredCompanies.length === 0 ? (
                        <div className="py-12 text-center text-xs text-zinc-500">
                            Brak spółek spełniających kryteria filtra.
                        </div>
                    ) : (
                        filteredCompanies.map((comp) => {
                            const isSelected = selectedCompanyIds.includes(comp.id);

                            return (
                                <Tooltip
                                    key={comp.id}
                                    content={isSelected
                                        ? `Spółka ${comp.name} jest przypisana. Kliknij, aby usunąć przypisanie.`
                                        : `Kliknij, aby przypisać spółkę ${comp.name} do doradcy.`
                                    }
                                >
                                    <button
                                        type="button"
                                        onClick={() => toggleCompany(comp.id)}
                                        aria-label={`${comp.name} (${comp.code}) - ${isSelected ? 'przypisana' : 'nieprzypisana'}`}
                                        className={`w-full text-left p-2.5 rounded border transition-all flex items-center justify-between cursor-pointer ${
                                            isSelected
                                                ? 'bg-zinc-850/90 border-zinc-600 text-zinc-100 shadow-xs'
                                                : 'bg-zinc-950/40 border-zinc-800/80 text-zinc-400 hover:bg-zinc-900 hover:border-zinc-700'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="shrink-0 text-zinc-400">
                                                {isSelected ? (
                                                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                                                ) : (
                                                    <Square className="w-4 h-4 text-zinc-600" />
                                                )}
                                            </div>

                                            <div className="min-w-0">
                                                <div className="text-xs font-semibold flex items-center gap-2 truncate">
                                                    <span className="truncate text-zinc-100">{comp.name}</span>
                                                    <Badge variant="default" size="sm">{comp.code}</Badge>
                                                </div>
                                                <div className="text-[10px] text-zinc-500 flex items-center gap-2 mt-0.5">
                                                    <span>NIP: {comp.tax_id || 'Brak NIP'}</span>
                                                    <span>•</span>
                                                    <span>Doradców: {comp.assigned_advisors_count || 0}</span>
                                                    <span>•</span>
                                                    <span>Klientów: {comp.clients_count || 0}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {isSelected && (
                                            <Badge variant="success" size="sm">
                                                PRZYPISANA
                                            </Badge>
                                        )}
                                    </button>
                                </Tooltip>
                            );
                        })
                    )}
                </div>

                {/* Footer Controls */}
                <div className="px-5 py-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between shrink-0">
                    <Tooltip content="Wszelkie modyfikacje przypisań doradców są utrwalane w niezmiennym rejestrze audytowym WORM">
                        <div tabIndex={0} className="text-[10px] text-zinc-500 cursor-help focus:outline-none focus:underline">
                            AUDYT: Rejestracja zdarzeń Tenant / RBAC
                        </div>
                    </Tooltip>
                    <div className="flex items-center gap-2">
                        <Tooltip content="Odrzuć zmiany i zamknij okno">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onClose}
                                disabled={saving}
                                aria-label="Anuluj"
                            >
                                Anuluj
                            </Button>
                        </Tooltip>
                        <Tooltip content="Zapisz zaktualizowane przypisania spółek w bazie">
                            <span>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    icon={Save}
                                    onClick={handleSave}
                                    loading={saving}
                                    disabled={loading || saving}
                                    aria-label={`Zapisz przypisania (${selectedCompanyIds.length})`}
                                >
                                    Zapisz przypisania ({selectedCompanyIds.length})
                                </Button>
                            </span>
                        </Tooltip>
                    </div>
                </div>
            </div>
        </div>
    );
};
