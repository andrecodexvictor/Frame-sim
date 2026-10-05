import type { EmployeeBrainState } from '../core/employeeBrainCore.js';
import type { ExperimentAssignment } from '../core/experimentProtocol.js';
import type { SyntheticWorkPolicy } from '../core/syntheticWork.js';

export type EvidenceSource = 'synthetic' | 'expert_labeled' | 'observed';
export interface ModelObservation {
    role: 'persona' | 'narrative' | 'critique' | 'semantic-evaluation' | 'longitudinal-review';
    provider: string;
    requestedModel: string;
    resolvedModel: string;
    temperature?: number;
    modelSeed?: number;
    status: 'completed' | 'unavailable';
}
export interface RunManifest {
    taskModel?: { policy: SyntheticWorkPolicy; policyHash: string; source: 'synthetic'; scope: 'sampled-work-block' };
    protocol?: ExperimentAssignment;
    schemaVersion: 1;
    runId: string;
    experimentId: string;
    replicaId: string;
    scenarioId: string;
    scenarioSeed: number;
    interventionId: string;
    configHash: string;
    datasetHash: string;
    codeRevision: string;
    codeStateHash?: string;
    startedAt: string;
    completedAt?: string;
    dataSource: EvidenceSource;
    empiricalValidation: 'pending' | 'validated';
    executionMode: 'live' | 'degraded' | 'fixture' | 'failed';
    models: ModelObservation[];
    rubricVersion: string;
    rubricHash: string;
    memoryPolicy: 'interactive' | 'isolated';
}
export interface TraceEvent {
    eventId: string;
    personaId: string;
    turnId: number;
    type: string;
    text: string;
    source: EvidenceSource;
    kind: 'state-transition' | 'decision' | 'narrative' | 'task-observation' | 'collaboration' | 'exogenous';
    relatedPersonaIds?: string[];
}
export interface TaskObservation {
    classId?: string;
    modelVersion?: string;
    assignedTurnId?: number;
    status?: 'accepted' | 'rejected' | 'pending';
    censored?: boolean;
    taskId: string;
    opportunityUnits: number;
    deliveredUnits: number;
    acceptedUnits: number;
    reworkUnits: number;
    leadTimeHours?: number;
    evidenceIds: string[];
    source: EvidenceSource;
}
export interface PersonaTrace {
    runId: string;
    personaId: string;
    turnId: number;
    role: string;
    before: EmployeeBrainState;
    after: EmployeeBrainState;
    events: TraceEvent[];
    tasks: TaskObservation[];
    source: EvidenceSource;
}
export interface EvidenceMetric {
    id: string;
    value: number | null;
    numerator?: number;
    denominator?: number;
    unit: string;
    evidenceIds: string[];
    coverage: number;
    missingReason?: string;
}
export interface SemanticDimension {
    policyVersion?: string;
    calibrationDatasetHash?: string;
    questionCount?: number;
    requestCount?: number;
    inputTokens?: number;
    outputTokens?: number;
    latencyMs?: number;
    estimatedCostUSD?: number | null;
    requestedModel?: string;
    status: 'evaluated' | 'abstained' | 'unavailable';
    evidenceIds: string[];
    rubricVersion: string;
    model?: string;
    score?: number;
    probabilities?: Record<string, number>;
    confidence?: number;
    noul?: number;
    choice?: string;
    choiceProbabilities?: Record<string, number>;
    choiceConfidence?: number;
    legend?: Record<string, string>;
    reason?: string;
}
export interface IndividualEvaluation {
    personaId: string;
    runId: string;
    role: string;
    source: EvidenceSource;
    empiricalValidation: 'pending';
    metrics: EvidenceMetric[];
    leadTimeByClass?: Array<{ classId: string; unit: 'hours'; median: number | null; nAccepted: number; nCensored: number; nMissingTiming: number; observations: Array<{ taskId: string; hours: number | null; accepted?: boolean; censored: boolean | null; evidenceIds: string[] }> }>;
    semantic: Record<string, SemanticDimension>;
    limitations: string[];
}
