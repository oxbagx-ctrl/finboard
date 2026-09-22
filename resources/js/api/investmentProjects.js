import apiClient from './client';

export const investmentProjectsApi = {
    /**
     * Get list of investment projects for the active company context.
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    getProjects: (params = {}) => apiClient.get('/investment-projects', { params }),

    /**
     * Initialize a new investment project.
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    createProject: (data) => apiClient.post('/investment-projects', data),

    /**
     * Get single investment project details with financing structure and stages.
     * @param {string} id
     * @returns {Promise<Object>}
     */
    getProject: (id) => apiClient.get(`/investment-projects/${id}`),

    /**
     * Update investment project baseline parameters.
     * @param {string} id
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    updateProject: (id, data) => apiClient.put(`/investment-projects/${id}`, data),

    /**
     * Delete investment project.
     * @param {string} id
     * @returns {Promise<Object>}
     */
    deleteProject: (id) => apiClient.delete(`/investment-projects/${id}`),

    /**
     * Add CAPEX stage to an investment project.
     * @param {string} projectId
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    addCapexStage: (projectId, data) => apiClient.post(`/investment-projects/${projectId}/capex-stages`, data),

    /**
     * Update existing CAPEX stage.
     * @param {string} projectId
     * @param {string} stageId
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    updateCapexStage: (projectId, stageId, data) => apiClient.put(`/investment-projects/${projectId}/capex-stages/${stageId}`, data),

    /**
     * Delete CAPEX stage.
     * @param {string} projectId
     * @param {string} stageId
     * @returns {Promise<Object>}
     */
    deleteCapexStage: (projectId, stageId) => apiClient.delete(`/investment-projects/${projectId}/capex-stages/${stageId}`),

    /**
     * Get 15-year 3-statement financial model (Income Statement, Balance Sheet, Cash Flow, Depreciation).
     * @param {string} id
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    getThreeStatement: (id, params = {}) => apiClient.get(`/investment-projects/${id}/statements/three-statement`, { params }),

    /**
     * Get 15-year Income Statement.
     * @param {string} id
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    getIncomeStatement: (id, params = {}) => apiClient.get(`/investment-projects/${id}/statements/income-statement`, { params }),

    /**
     * Get 15-year Balance Sheet.
     * @param {string} id
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    getBalanceSheet: (id, params = {}) => apiClient.get(`/investment-projects/${id}/statements/balance-sheet`, { params }),

    /**
     * Get 15-year Cash Flow Statement.
     * @param {string} id
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    getCashFlowStatement: (id, params = {}) => apiClient.get(`/investment-projects/${id}/statements/cash-flow`, { params }),

    /**
     * Get fixed asset depreciation schedule.
     * @param {string} id
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    getDepreciationSchedule: (id, params = {}) => apiClient.get(`/investment-projects/${id}/statements/depreciation`, { params }),

    /**
     * Get DCF enterprise and equity appraisal metrics (NPV, Project/Equity IRR, MoIC, Payback).
     * @param {string} id
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    getAppraisal: (id, params = {}) => apiClient.get(`/investment-projects/${id}/appraisal`, { params }),

    /**
     * Run multi-tier Equity Waterfall simulation with optional target IRR solver.
     * @param {string} id
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    simulateWaterfall: (id, data = {}) => apiClient.post(`/investment-projects/${id}/waterfall`, data),
};

export default investmentProjectsApi;
