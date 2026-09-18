import React from 'react';
import { Card } from '../components/ui/Card';
import { TrendingUp, BarChart3 } from 'lucide-react';

export const AnalyticsView = () => {
    return (
        <div className="space-y-6">
            <Card
                title="Moduł Analityki Finansowej & Wykresów"
                subtitle="Trendy przychodów, EBITDA, struktura OPEX oraz płynność"
            >
                <div className="py-12 text-center text-slate-400">
                    <TrendingUp className="w-12 h-12 mx-auto text-brand-400 mb-3 opacity-80" />
                    <h4 className="text-base font-semibold text-slate-200">Podgląd Modułu Analityki</h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                        Moduł analityki finansowej i interaktywne wykresy Recharts zostaną wdrożone w dedykowanych zadaniach Fazy 6.
                    </p>
                </div>
            </Card>
        </div>
    );
};
