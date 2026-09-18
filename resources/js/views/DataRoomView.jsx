import React from 'react';
import { Card } from '../components/ui/Card';
import { FolderLock } from 'lucide-react';

export const DataRoomView = () => {
    return (
        <div className="space-y-6">
            <Card
                title="Wirtualny Pokój Danych (Virtual Data Room)"
                subtitle="Bezpieczne repozytorium dokumentów due diligence, audytów i umów"
            >
                <div className="py-12 text-center text-slate-400">
                    <FolderLock className="w-12 h-12 mx-auto text-brand-400 mb-3 opacity-80" />
                    <h4 className="text-base font-semibold text-slate-200">Katalog Dokumentów VDR</h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                        Przeglądarka plików z kategoryzacją, sumami kontrolnymi SHA-256 i bezpiecznym pobieraniem.
                    </p>
                </div>
            </Card>
        </div>
    );
};
