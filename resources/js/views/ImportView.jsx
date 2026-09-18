import React from 'react';
import { Card } from '../components/ui/Card';
import { FileSpreadsheet } from 'lucide-react';

export const ImportView = () => {
    return (
        <div className="space-y-6">
            <Card
                title="Asynchroniczny Import Danych CSV"
                subtitle="Szybkie ładowanie plików finansowych z podglądem weryfikacji i paskiem postępu kolejki Redis"
            >
                <div className="py-12 text-center text-slate-400">
                    <FileSpreadsheet className="w-12 h-12 mx-auto text-brand-400 mb-3 opacity-80" />
                    <h4 className="text-base font-semibold text-slate-200">Kreator Importu CSV</h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                        Moduł przeciągania plików (drag & drop), walidacji na żywo i monitorowania zadań workera zostanie wdrożony w dedykowanym etapie Fazy 6.
                    </p>
                </div>
            </Card>
        </div>
    );
};
