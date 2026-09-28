import axios from 'axios';
import { ROUTES } from '../constants/routes';

const apiClient = axios.create({
    baseURL: '/api/v1',
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    },
});

apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('finboard_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    const companyId = localStorage.getItem('finboard_active_company_id');
    if (companyId) {
        config.headers['X-Company-Id'] = companyId;
    }

    return config;
}, (error) => {
    return Promise.reject(error);
});

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('finboard_token');
            localStorage.removeItem('finboard_user');
            localStorage.removeItem('finboard_active_company');
            localStorage.removeItem('finboard_active_company_id');
            localStorage.removeItem('finboard_available_companies');
            if (typeof window !== 'undefined' && window.location.pathname !== ROUTES.LOGIN) {
                window.location.href = ROUTES.LOGIN;
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;
