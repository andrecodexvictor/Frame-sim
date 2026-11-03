import React, { useId, useState } from 'react';
import type { SimulationOutput } from '../types';
import type { EvidenceMetric } from '../RAG/src/types/evaluation';

const LABELS: Record<string, string> = { delivery: 'Entrega aceita', quality: 'Qualidade sem retrabalho', 'lead-time': 'Tempo de entrega (mediana)', adaptation: 'Adaptação', 'stress-context': 'Estresse médio', 'energy-context': 'Energia média' };
const sourceLabel = (source: string) => source === 'observed' ? 'Dados observados' : source === 'expert_labeled' ? 'Rótulos de especialistas' : 'Dados sintéticos';
const valueLabel = (value: number | null) => value === null ? 'Indisponível' : value.toLocaleString('pt-BR', { maximumFractionDigits: 5 });

export const IndividualEvaluationPanel: React.FC<{ data: SimulationOutput; darkMode?: boolean }> = ({ data, darkMode = true }) => {
    const id = useId();
    const evaluations = data.individualEvaluations ?? [];
    const traces = data.personaTraces ?? [];
    const [personaId, setPersonaId] = useState(evaluations[0]?.personaId ?? '');
    const [role, setRole] = useState('all');
    const [turn, setTurn] = useState('all');
    const visiblePeople = evaluations.filter(person => role === 'all' || person.role === role);
    const selected = visiblePeople.find(person => person.personaId === personaId) ?? visiblePeople[0];
    const selectedTraces = traces.filter(trace => trace.personaId === selected?.personaId);
    const shownTraces = selectedTraces.filter(trace => turn === 'all' || trace.turnId === Number(turn));
    const nameFor = (personId: string) => data.keyPersonas.find(person => person.id === personId)?.name || traces.find(trace => trace.personaId === personId)?.after.nome || personId;
    const surface = darkMode ? 'bg-[#18181b] border-zinc-700 text-zinc-100' : 'bg-white border-zinc-300 text-zinc-900';
    const field = `rounded border px-3 py-2 text-sm min-h-11 w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500 ${surface}`;
    const metricsTable = (metrics: EvidenceMetric[]) => <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
            <thead><tr className="border-b border-zinc-500/40"><th scope="col" className="py-3 pr-4">Dimensão</th><th scope="col" className="pr-4">Medida</th><th scope="col" className="pr-4">Unidade / denominador</th><th scope="col">Cobertura</th></tr></thead>
            <tbody>{metrics.map(metric => <tr key={metric.id} data-metric-id={metric.id} className="border-b border-zinc-500/20 align-top">
                <th scope="row" className="py-3 pr-4 font-medium">{LABELS[metric.id] || metric.id}</th>
                <td className="py-3 pr-4 font-mono tabular-nums whitespace-nowrap">{valueLabel(metric.value)}</td>
                <td className="py-3 pr-4"><span>{metric.unit}</span>{metric.denominator !== undefined && <span className="block font-mono text-xs mt-1">{metric.numerator} / {metric.denominator}</span>}{metric.missingReason && <span className="block text-xs mt-1 max-w-prose">{metric.missingReason}</span>}</td>
                <td className="py-3 font-mono tabular-nums whitespace-nowrap">{Math.round(metric.coverage * 100)}%<span className="block text-xs font-sans mt-1">{metric.evidenceIds.length} evidência(s)</span></td>
            </tr>)}</tbody>
        </table>
    </div>;
    return <section aria-label="Avaliação individual" className={`rounded border p-5 md:p-6 space-y-6 ${surface}`}>
        <header className="space-y-2"><h3 className="font-bold text-lg">Avaliação individual</h3><p className="text-sm max-w-prose">Medidas com atribuição por pessoa e evidências por turno. Validação empírica pendente: estes resultados ainda não foram confrontados com um conjunto observado independente.</p></header>
        {!evaluations.length ? <p className="text-sm">Esta execução não contém traços individuais. Execute uma simulação com registro de evidências para avaliar pessoas; os totais da equipe não permitem atribuição individual.</p> : <>
            <div className="grid gap-4 md:grid-cols-[1fr_2fr_1fr]">
                <label htmlFor={`${id}-role`} className="space-y-2 text-sm font-medium"><span>Papel</span><select id={`${id}-role`} className={field} value={role} onChange={event => { setRole(event.target.value); setTurn('all'); }}><option value="all">Todos os papéis</option>{[...new Set(evaluations.map(person => person.role))].map(item => <option key={item} value={item}>{item}</option>)}</select></label>
                <label htmlFor={`${id}-persona`} className="space-y-2 text-sm font-medium"><span>Pessoa</span><select id={`${id}-persona`} data-testid="individual-persona" className={field} value={selected?.personaId ?? ''} onChange={event => { setPersonaId(event.target.value); setTurn('all'); }}>{visiblePeople.map(person => <option key={person.personaId} value={person.personaId}>{nameFor(person.personaId)} · {person.personaId}</option>)}</select></label>
                <label htmlFor={`${id}-turn`} className="space-y-2 text-sm font-medium"><span>Turno da trajetória</span><select id={`${id}-turn`} data-testid="individual-turn" className={field} value={turn} onChange={event => setTurn(event.target.value)}><option value="all">Todos os turnos</option>{selectedTraces.map(trace => <option key={trace.turnId} value={trace.turnId}>Turno {trace.turnId}</option>)}</select></label>
            </div>
            {selected && <>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm"><span className="font-medium">{sourceLabel(selected.source)}</span><span>{selected.role}</span><span>{selectedTraces.length} turno(s) registrado(s)</span><span>Sem comparação entre papéis</span></div>
                <div><h4 className="font-semibold mb-2">Medidas de desempenho · execução completa</h4>{data.manifest?.taskModel?.scope === 'sampled-work-block' && <p className="text-sm mb-3 max-w-prose">Blocos de trabalho sintéticos amostrados por turno, com política registrada no manifesto. Não representam produção mensal total. Pendências e rejeições são censuradas no fim do bloco; a mediana de tempo inclui apenas tarefas aceitas.</p>}{metricsTable(selected.metrics.filter(metric => !metric.id.endsWith('-context')))}</div>
                {!!selected.leadTimeByClass?.length && <details className="text-sm border-t border-zinc-500/30 pt-4"><summary className="cursor-pointer focus-visible:outline">Distribuição do tempo por classe de tarefa</summary><p className="mt-3 max-w-prose">A mediana considera tarefas aceitas com duração registrada. As censuradas ficam fora dessa mediana; contagens de tarefas não são réplicas independentes.</p><div className="space-y-4 mt-4">{selected.leadTimeByClass.map(distribution => <div key={distribution.classId}><h4 className="font-semibold break-all">{distribution.classId}</h4><p>Mediana: {valueLabel(distribution.median)} h · {distribution.nAccepted} aceita(s) · {distribution.nCensored} censurada(s) · {distribution.nMissingTiming} aceita(s) sem duração</p><ol className="space-y-2 mt-2">{distribution.observations.map(observation => <li key={observation.taskId} className="break-all"><code>{observation.taskId}</code> · {valueLabel(observation.hours)} h · {observation.censored === true ? 'censurada' : observation.accepted === true || observation.censored === false ? 'aceita' : 'censura não informada'}<span className="block text-xs">Evidências: {observation.evidenceIds.join(', ')}</span></li>)}</ol></div>)}</div></details>}
                <div><h4 className="font-semibold mb-2">Contexto simulado · execução completa</h4><p className="text-sm mb-3 max-w-prose">Estresse e energia descrevem o estado do modelo humano. Não são notas de desempenho nem diagnósticos de saúde.</p>{metricsTable(selected.metrics.filter(metric => metric.id.endsWith('-context')))}</div>
                <div className="border-t border-zinc-500/30 pt-4"><h4 className="font-semibold mb-2">Julgamento semântico de colaboração</h4>{selected.semantic.collaboration ? <>
                    <p className="text-sm"><strong>{selected.semantic.collaboration.status === 'evaluated' ? 'Avaliado pela política de desenvolvimento' : selected.semantic.collaboration.status === 'abstained' ? 'Abstenção' : 'Indisponível'}</strong> · {selected.semantic.collaboration.reason || 'Aceito pela política registrada.'}</p>
                    {selected.semantic.collaboration.score !== undefined && <p className="text-sm mt-2">Julgamento bruto exploratório: {valueLabel(selected.semantic.collaboration.score)} · modelo {selected.semantic.collaboration.model}. A concentração da distribuição não é probabilidade de acerto.</p>}
                    <details className="mt-3 text-sm"><summary className="cursor-pointer focus-visible:outline">Rubrica, distribuições e uso</summary><pre className="mt-2 whitespace-pre-wrap break-all text-xs font-mono">{JSON.stringify(selected.semantic.collaboration, null, 2)}</pre></details>
                </> : <p className="text-sm">Sem julgamento semântico nesta execução.</p>}</div>
                <div className="border-t border-zinc-500/30 pt-4"><h4 className="font-semibold mb-3">Trajetória e evidências</h4><div className="space-y-2">{shownTraces.map(trace => <details key={trace.turnId} className="border-b border-zinc-500/20 pb-2">
                    <summary className="cursor-pointer py-2 text-sm focus-visible:outline">Turno {trace.turnId} · {trace.events.length} evento(s) · {trace.after.status}</summary>
                    <dl className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm py-3"><div><dt>Estresse</dt><dd className="font-mono">{valueLabel(trace.before.estresse)} → {valueLabel(trace.after.estresse)}</dd></div><div><dt>Energia</dt><dd className="font-mono">{valueLabel(trace.before.energia)} → {valueLabel(trace.after.energia)}</dd></div><div><dt>Engajamento</dt><dd className="font-mono">{valueLabel(trace.before.engajamento)} → {valueLabel(trace.after.engajamento)}</dd></div></dl>
                    <ol className="space-y-3 py-2">{trace.events.map(event => <li key={event.eventId} className="text-sm"><code className="text-xs break-all">{event.eventId}</code><p className="mt-1 max-w-prose">{event.text}</p><span className="text-xs">{sourceLabel(event.source)} · {event.kind}</span></li>)}</ol>
                </details>)}</div></div>
                <details className="text-sm border-t border-zinc-500/30 pt-4"><summary className="cursor-pointer focus-visible:outline">Limitações desta avaliação</summary><ul className="list-disc pl-5 space-y-2 mt-3">{selected.limitations.map(item => <li key={item}>{item}</li>)}</ul></details>
            </>}
        </>}
    </section>;
};
