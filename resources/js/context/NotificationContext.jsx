import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export const NotificationContext = createContext(null);

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

    const success = useCallback((message, title = 'Potwierdzenie') => notify('success', message, title), [notify]);
    const error = useCallback((message, title = 'Błąd operacji') => notify('error', message, title), [notify]);
    const info = useCallback((message, title = 'Komunikat') => notify('info', message, title), [notify]);
    const warning = useCallback((message, title = 'Ostrzeżenie') => notify('warning', message, title), [notify]);

    return (
        <NotificationContext.Provider value={{ success, error, info, warning, removeNotification }}>
            {children}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
                {notifications.map((n) => (
                    <div
                        key={n.id}
                        className={`pointer-events-auto flex items-start gap-2.5 p-3 rounded-md border shadow-lg transition-all duration-200 ${
                            n.type === 'success'
                                ? 'bg-zinc-900 border-emerald-800 text-zinc-100'
                                : n.type === 'error'
                                ? 'bg-zinc-900 border-rose-800 text-zinc-100'
                                : n.type === 'warning'
                                ? 'bg-zinc-900 border-amber-800 text-zinc-100'
                                : 'bg-zinc-900 border-zinc-700 text-zinc-100'
                        }`}
                    >
                        <div className="mt-0.5 shrink-0">
                            {n.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                            {n.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
                            {n.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                            {n.type === 'info' && <Info className="w-4 h-4 text-blue-400" />}
                        </div>
                        <div className="flex-1 text-xs">
                            {n.title && <div className="font-semibold text-zinc-200 uppercase font-mono tracking-wider">{n.title}</div>}
                            <div className="text-zinc-400 mt-0.5">{n.message}</div>
                        </div>
                        <button
                            onClick={() => removeNotification(n.id)}
                            className="text-zinc-500 hover:text-zinc-300 p-0.5"
                        >
                            <X className="w-3.5 h-3.5" />
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
