import type { SimulationOutput } from '../types';
import type { ExperimentAssignment } from './experimentProtocol';
export interface FailedCondition { label: string; experiment: ExperimentAssignment; errorCode: string }
export interface PlannedInteractiveRun { label: string; experiment: ExperimentAssignment; run: () => Promise<SimulationOutput> }
export async function collectInteractiveRuns(planned: PlannedInteractiveRun[]): Promise<{ outputs: SimulationOutput[]; failures: FailedCondition[] }> {
    const settled = await Promise.allSettled(planned.map(item => item.run()));
    const outputs: SimulationOutput[] = [], failures: FailedCondition[] = [];
    settled.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            const output = result.value;
            outputs.push(output.manifest?.protocol ? { ...output, manifest: { ...output.manifest, protocol: { ...output.manifest.protocol, conditionIndex: index } } } : output);
        } else failures.push({ label: planned[index].label, experiment: { ...planned[index].experiment, conditionIndex: index }, errorCode: result.reason instanceof Error ? result.reason.name : 'SimulationError' });
    });
    return { outputs, failures };
}
