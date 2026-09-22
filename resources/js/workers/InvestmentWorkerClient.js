/**
 * FinBoard Investment Worker Client
 * Abstraction layer over the investmentCalculationWorker with correlation IDs and synchronous fallback.
 */

import { runSimulation } from './financialCalculations';

export class InvestmentWorkerClient {
    constructor() {
        this.worker = null;
        this.currentRequestId = 0;
        this.pendingRequests = new Map();
        this.isSupported = typeof Worker !== 'undefined';

        this.initWorker();
    }

    initWorker() {
        if (!this.isSupported) {
            return;
        }

        try {
            this.worker = new Worker(
                new URL('./investmentCalculationWorker.ts', import.meta.url),
                { type: 'module' }
            );

            this.worker.onmessage = (event) => {
                const { type, requestId, data, error, executionTimeMs } = event.data || {};
                const resolver = this.pendingRequests.get(requestId);

                if (!resolver) {
                    return; // Stale or cancelled request
                }

                this.pendingRequests.delete(requestId);

                if (type === 'SIMULATION_SUCCESS') {
                    resolver.resolve({ ...data, executionTimeMs });
                } else {
                    resolver.reject(new Error(error || 'Worker simulation error'));
                }
            };

            this.worker.onerror = (err) => {
                // Reject all pending requests on uncaught worker error
                for (const [reqId, resolver] of this.pendingRequests.entries()) {
                    resolver.reject(err);
                }
                this.pendingRequests.clear();
            };
        } catch (e) {
            console.warn('[InvestmentWorkerClient] Web Worker initialization failed, falling back to synchronous execution:', e);
            this.worker = null;
            this.isSupported = false;
        }
    }

    /**
     * Run 15-year simulation in background worker (or synchronous fallback)
     *
     * @param {Object} project - InvestmentProject model data
     * @param {Object} [assumptions] - Operating assumptions override
     * @param {Object} [overrides] - What-If sensitivity sliders
     * @param {number} [horizonYears=15] - Planning horizon in years
     * @returns {Promise<Object>} Simulation result with 15-year statements and appraisal metrics
     */
    simulate(project, assumptions, overrides, horizonYears = 15) {
        const requestId = ++this.currentRequestId;

        // If worker is not available or disabled, execute synchronously
        if (!this.worker || !this.isSupported) {
            return new Promise((resolve, reject) => {
                try {
                    const result = runSimulation(project, assumptions, overrides, horizonYears);
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            });
        }

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, { resolve, reject });

            this.worker.postMessage({
                type: 'CALCULATE_SIMULATION',
                requestId,
                payload: {
                    project,
                    assumptions,
                    overrides,
                    horizonYears
                }
            });
        });
    }

    /**
     * Clean up worker thread resources
     */
    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.pendingRequests.clear();
    }
}

// Default singleton instance
let defaultClient = null;

export function getInvestmentWorkerClient() {
    if (!defaultClient) {
        defaultClient = new InvestmentWorkerClient();
    }
    return defaultClient;
}
