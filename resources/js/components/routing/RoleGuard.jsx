import React, { useEffect, useRef } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { ROUTES } from '../../constants/routes';

/**
 * RoleGuard Component
 * Restricts access to routes based on user role authorization (RBAC).
 * Defaults to privileged roles: super_admin, admin, advisor.
 * Redirects unauthorized users to DASHBOARD with an informative warning notification.
 */
export const RoleGuard = ({ allowedRoles = ['super_admin', 'admin', 'advisor'], children }) => {
    const { user, isSuperAdmin, isAdmin, isAdvisor } = useAuth();
    const { warning } = useNotification();
    const hasWarnedRef = useRef(false);

    const hasPermission =
        isSuperAdmin ||
        isAdmin ||
        isAdvisor ||
        (user?.role && allowedRoles.includes(user.role));

    useEffect(() => {
        if (!hasPermission && !hasWarnedRef.current) {
            hasWarnedRef.current = true;
            warning('Brak uprawnień do przeglądania wybranego modułu.', 'Odmowa Dostępu');
        }
    }, [hasPermission, warning]);

    if (!hasPermission) {
        return <Navigate to={ROUTES.DASHBOARD} replace />;
    }

    return children ? children : <Outlet />;
};

export default RoleGuard;
