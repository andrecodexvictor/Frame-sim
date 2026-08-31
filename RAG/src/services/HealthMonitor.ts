export interface HealthThresholds {
    maxCostUsd: number;
    maxTotalTokens: number;
    maxDurationMs: number;
    maxRiskIncidents: number;
    maxRiskScore?: number;
}

export interface HealthSample {
    costUsd?: number;
    totalTokens?: number;
    durationMs?: number;
    riskIncidents?: number;
    riskScore?: number;
    degraded?: boolean;
}

export type HealthAlertKind = 'cost' | 'tokens' | 'duration' | 'risk';
export type HealthAlertSeverity = 'warning' | 'critical';

export interface HealthAlert {
    kind: HealthAlertKind;
    severity: HealthAlertSeverity;
    code: string;
    value: number;
    threshold: number;
    message: string;
}

export interface HealthSnapshot {
    healthy: boolean;
    alerts: HealthAlert[];
    degraded: boolean;
}

const DEFAULT_THRESHOLDS: HealthThresholds = {
    maxCostUsd: 1,
    maxTotalTokens: 100_000,
    maxDurationMs: 90_000,
    maxRiskIncidents: 3,
    maxRiskScore: 80,
};

function threshold(value: unknown, fallback: number, name: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be a positive finite number`);
    return value || fallback;
}

function safe(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

export class HealthMonitor {
    readonly thresholds: HealthThresholds;
    private readonly snapshots: HealthSnapshot[] = [];

    constructor(config: Partial<HealthThresholds> = {}) {
        this.thresholds = {
            maxCostUsd: threshold(config.maxCostUsd ?? DEFAULT_THRESHOLDS.maxCostUsd, DEFAULT_THRESHOLDS.maxCostUsd, 'maxCostUsd'),
            maxTotalTokens: threshold(config.maxTotalTokens ?? DEFAULT_THRESHOLDS.maxTotalTokens, DEFAULT_THRESHOLDS.maxTotalTokens, 'maxTotalTokens'),
            maxDurationMs: threshold(config.maxDurationMs ?? DEFAULT_THRESHOLDS.maxDurationMs, DEFAULT_THRESHOLDS.maxDurationMs, 'maxDurationMs'),
            maxRiskIncidents: threshold(config.maxRiskIncidents ?? DEFAULT_THRESHOLDS.maxRiskIncidents, DEFAULT_THRESHOLDS.maxRiskIncidents, 'maxRiskIncidents'),
            maxRiskScore: config.maxRiskScore === undefined ? DEFAULT_THRESHOLDS.maxRiskScore : threshold(config.maxRiskScore, DEFAULT_THRESHOLDS.maxRiskScore!, 'maxRiskScore'),
        };
    }

    evaluate(sample: HealthSample): HealthSnapshot {
        const alerts: HealthAlert[] = [];
        const add = (kind: HealthAlertKind, value: number, limit: number, code: string, label: string) => {
            if (value < limit) return;
            const critical = value >= limit * 2;
            alerts.push({
                kind,
                severity: critical ? 'critical' : 'warning',
                code,
                value,
                threshold: limit,
                message: `${label} exceeded configured threshold (${value} >= ${limit})`,
            });
        };
        add('cost', safe(sample.costUsd), this.thresholds.maxCostUsd, 'COST_THRESHOLD', 'cost');
        add('tokens', safe(sample.totalTokens), this.thresholds.maxTotalTokens, 'TOKEN_THRESHOLD', 'tokens');
        add('duration', safe(sample.durationMs), this.thresholds.maxDurationMs, 'DURATION_THRESHOLD', 'duration');
        add('risk', safe(sample.riskIncidents), this.thresholds.maxRiskIncidents, 'RISK_INCIDENT_THRESHOLD', 'risk incidents');
        if (this.thresholds.maxRiskScore !== undefined) add('risk', safe(sample.riskScore), this.thresholds.maxRiskScore, 'RISK_SCORE_THRESHOLD', 'risk score');
        // `degraded` is the operational umbrella: provider fallbacks and breached
        // thresholds both mean the result needs attention. Alerts retain the
        // precise cause and severity.
        const degraded = sample.degraded === true || alerts.length > 0;
        return { healthy: !degraded, alerts, degraded };
    }

    record(sample: HealthSample): HealthSnapshot {
        const snapshot = this.evaluate(sample);
        this.snapshots.push(snapshot);
        return snapshot;
    }

    history(): HealthSnapshot[] {
        return this.snapshots.map(snapshot => ({ ...snapshot, alerts: snapshot.alerts.map(alert => ({ ...alert })) }));
    }
}
