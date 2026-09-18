import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);

    const removeNotification = useCallback((id) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, []);

    const notify = useCallback((type, message, title = '') => {
        const id = Math.random().toString(36).substring(2, 9);
        const newNotification = { id, type, message, title };

        setNotifications((prev) => [...prev, newNotification]);

        setTimeout(() => {
            removeNotification(id);
        }, 5000);
    }, [removeNotification]);

    const success = useCallback((message, title = 'Sukces') => notify('success', message, title), [notify]);
    const error = useCallback((message, title = 'Błąd') => notify('error', message, title), [notify]);
    const info = useCallback((message, title = 'Informacja') => notify('info', message, title), [notify]);
    const warning = useCallback((message, title = 'Ostrzeżenie') => notify('warning', message, title), [notify]);

    return (
        <NotificationContext.Provider value={{ success, error, info, warning, removeNotification }}>
            {children}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
                {notifications.map((n) => (
                    <div
                        key={n.id}
                        className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-right-5 ${
                            n.type === 'success'
                                ? 'bg-slate-900/95 border-emerald-500/50 text-emerald-300'
                                : n.type === 'error'
                                ? 'bg-slate-900/95 border-rose-500/50 text-rose-300'
                                : n.type === 'warning'
                                ? 'bg-slate-900/95 border-amber-500/50 text-amber-300'
                                : 'bg-slate-900/95 border-brand-500/50 text-brand-300'
                        }`}
                    >
                        <div className="mt-0.5 shrink-0">
                            {n.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                            {n.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400" />}
                            {n.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                            {n.type === 'info' && <Info className="w-5 h-5 text-brand-400" />}
                        </div>
                        <div className="flex-1 text-sm">
                            {n.title && <div className="font-semibold text-slate-100">{n.title}</div>}
                            <div className="text-slate-300 text-xs mt-0.5">{n.message}</div>
                        </div>
                        <button
                            onClick={() => removeNotification(n.id)}
                            className="text-slate-400 hover:text-slate-200 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};
