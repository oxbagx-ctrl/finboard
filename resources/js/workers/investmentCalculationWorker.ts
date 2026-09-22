/**
 * FinBoard Investment Calculation Web Worker
 * Phase 43 Commit 212: Background thread for real-time 15-year simulation
 */

import { WorkerRequestMessage, WorkerResponseMessage } from './types';
import { runSimulation } from './financialCalculations';

// Web Worker Global Scope listener
self.onmessage = (event: MessageEvent<WorkerRequestMessage>) => {
    const { type, requestId, payload } = event.data || {};

    if (type !== 'CALCULATE_SIMULATION') {
        return;
    }

    try {
        const { project, assumptions, overrides, horizonYears } = payload;

        const result = runSimulation(
            project,
            assumptions,
            overrides,
            horizonYears || 15
        );

        const response: WorkerResponseMessage = {
            type: 'SIMULATION_SUCCESS',
            requestId,
            data: result,
            executionTimeMs: result.executionTimeMs
        };

        self.postMessage(response);
    } catch (err: any) {
        const response: WorkerResponseMessage = {
            type: 'SIMULATION_ERROR',
            requestId,
            error: err?.message || 'Unknown error during simulation calculation.'
        };

        self.postMessage(response);
    }
};
