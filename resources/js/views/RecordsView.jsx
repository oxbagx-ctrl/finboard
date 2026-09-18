import React from 'react';
import { Card } from '../components/ui/Card';
import { TableProperties } from 'lucide-react';

export const RecordsView = () => {
    return (
        <div className="space-y-6">
            <Card
                title="Transakcje i Rekordy Finansowe"
                subtitle="Zestawienie operacji finansowych spółki"
            >
                <div className="py-12 text-center text-slate-400">
                    <TableProperties className="w-12 h-12 mx-auto text-brand-400 mb-3 opacity-80" />
                    <h4 className="text-base font-semibold text-slate-200">Rejestr Transakcji Finansowych</h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                        Widok tabelaryczny transakcji z filtrowaniem, paginacją i modalami CRUD zostanie wdrożony w dedykowanym etapie.
                    </p>
                </div>
            </Card>
        </div>
    );
};
