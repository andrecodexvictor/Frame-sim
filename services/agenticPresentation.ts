import type { SimulationConfig, SimulationOutput } from '../types';
import type { SimulationState } from '../RAG/src/types/index';
import type { ROIResult } from '../RAG/src/types/index';

export interface AgenticResult { state: SimulationState; roi?: Partial<ROIResult> }

/** Presentation of the canonical run, with no inference or second factual trajectory. */
export function presentAgenticResult(result: AgenticResult, config: SimulationConfig): SimulationOutput {
    const { state, roi } = result;
    const people = state.funcionarios ?? [];
    const byTurn = new Map(state.historico.map(output => [output.turno, output.metricas_atualizadas]));
    const models = state.manifest?.models.filter(model => model.status === 'completed') ?? [];
    return {
        frameworkName: config.frameworks[0]?.name || 'Framework', timeUnit: 'turn',
        manifest: state.manifest, personaTraces: state.personaTraces, individualEvaluations: state.individualEvaluations,
        summary: { finalAdoption: null, totalRoi: roi?.roi_final ?? null, maturityScore: null, monthsToComplete: null },
        implementationNarrative: state.scratchpad,
        sentimentBreakdown: [
            { group: 'Promotores', value: people.filter(person => person.humor > 20).length },
            { group: 'Neutros', value: people.filter(person => person.humor >= -20 && person.humor <= 20).length },
            { group: 'Detratores', value: people.filter(person => person.humor < -20).length },
        ], resourceAllocation: [], departmentReadiness: [],
        timeline: [...byTurn].map(([turn, metrics]) => ({ month: turn, adoptionRate: null, compliance: null, roi: null, efficiency: metrics.velocidade_sprint })),
        keyPersonas: people.map(person => ({ id: person.personaId, name: person.nome, role: person.cargo, archetype: 'synthetic profile', sentiment: (person.humor + 100) / 2, impact: person.reflexao || person.decisoes.join(' · '), status: person.status, stress: person.estresse, energy: person.energia, engagement: person.engajamento })),
        emergentEvents: (state.personaTraces ?? []).flatMap(trace => trace.events.filter(event => event.kind === 'decision' || event.kind === 'collaboration').map(event => ({ month: trace.turnId, persona: trace.after.nome, type: event.type, event: event.text }))),
        risks: (state.degraded_reasons ?? []).map((reason, index) => ({ id: `unavailable-${index}`, category: 'Dados indisponíveis', description: reason, mitigation: 'Revisar a disponibilidade do provedor e repetir a condição.' })),
        recommendations: [],
        execution: { mode: state.degraded ? 'degraded' : 'live', provider: models.map(model => model.provider).filter((provider, index, all) => all.indexOf(provider) === index).join(', ') || 'unknown', model: models.map(model => model.resolvedModel).filter((model, index, all) => all.indexOf(model) === index).join(', ') || 'unknown', attempts: models.length, seed: state.manifest?.scenarioSeed,
            warning: 'Origem sintética. Adoção, maturidade e duração de implantação não foram medidas. O eixo temporal representa turnos; ROI é uma projeção de equipe.' },
        agenticMetrics: state.metricas_agenticas,
    };
}
