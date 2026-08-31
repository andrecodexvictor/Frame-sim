
import React, { useState } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ComposedChart, Line, BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';
import { SimulationOutput, SimulationConfig } from '../types';
import { BrutalButton } from './ui/BrutalButton';
import { Download, Sun, Moon, User, Activity, AlertCircle, CheckCircle, PieChart as PieIcon, BarChart as BarIcon, BookOpen, TrendingUp, TrendingDown } from 'lucide-react';

const EVENT_LABELS: Record<string, { label: string; tone: 'critical' | 'warning' | 'positive' | 'info' }> = {
  pedido_demissao: { label: 'Pedido de demissão', tone: 'critical' },
  burnout: { label: 'Burnout / afastamento', tone: 'critical' },
  licenca: { label: 'Licença', tone: 'warning' },
  resistencia_passiva: { label: 'Resistência passiva', tone: 'warning' },
  confronto_lideranca: { label: 'Confronto com liderança', tone: 'critical' },
  fofoca: { label: 'Contágio social', tone: 'warning' },
  apoiar_mudanca: { label: 'Apoio à mudança', tone: 'positive' },
  pedir_ajuda: { label: 'Pedido de ajuda', tone: 'info' },
  evento_rh: { label: 'Evento de RH', tone: 'info' },
};

const getEventMeta = (type: string) => EVENT_LABELS[type] || {
  label: type.replace(/_/g, ' '),
  tone: 'info' as const,
};

const getSentimentLabel = (sentiment: number) => {
  if (sentiment >= 70) return 'Apoia';
  if (sentiment < 40) return 'Resiste';
  return 'Neutro';
};

const stableRunHash = (data: SimulationOutput, config: SimulationConfig): string => {
  const input = `${data.frameworkName}:${data.execution?.seed ?? 0}:${data.summary.totalRoi}:${data.summary.finalAdoption}:${config.economicScenarioId ?? 'base'}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
};

interface DashboardProps {
  data: SimulationOutput;
  config: SimulationConfig;
  onReset: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ data, config, onReset }) => {
  const [darkMode, setDarkMode] = useState(true);

  const downloadReport = () => {
    const report = JSON.stringify({ generatedAt: new Date().toISOString(), config, result: data }, null, 2);
    const url = URL.createObjectURL(new Blob([report], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `framesim-${data.frameworkName.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'report'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  // Solid, Minimalist Theme configuration
  const theme = {
    bg: darkMode ? 'bg-[#09090b]' : 'bg-[#f4f4f5]',
    text: darkMode ? 'text-zinc-100' : 'text-zinc-900',
    card: darkMode ? 'bg-[#18181b] border-zinc-800' : 'bg-white border-zinc-200',
    border: darkMode ? 'border-zinc-800' : 'border-zinc-300',
    gridColor: darkMode ? '#27272a' : '#e4e4e7',
    axisColor: darkMode ? '#71717a' : '#a1a1aa',
  };

  const COLORS = ['#00C49F', '#FFBB28', '#FF8042', '#0088FE', '#8884d8'];
  const SENTIMENT_COLORS: Record<string, string> = { "Promotores": "#10b981", "Neutros": "#f59e0b", "Detratores": "#ef4444" };

  const getValidityColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Safe validity value
  const validityScore = data.summary.scenarioValidity ?? 0;

  // Clean Framework Name (remove .AI or extra spaces)
  const cleanTitle = data.frameworkName.replace(/\.AI$/i, '').trim();

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto ${theme.bg} ${theme.text} transition-colors duration-300 custom-scrollbar`}>
      <div className="relative z-10 max-w-[1600px] mx-auto p-6 md:p-10 space-y-10">

        {/* Navigation */}
        <nav className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b ${theme.border} pb-6`}>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">
              FrameSim<span className={darkMode ? 'text-emerald-500' : 'text-zinc-900'}></span>
            </h1>
            <div className={`hidden md:flex px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest border ${theme.border} rounded bg-opacity-50`}>
              Deep Simulation Kernel v3.2 (RAG Enabled)
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setDarkMode(!darkMode)}
              aria-label={darkMode ? 'Ativar tema claro' : 'Ativar tema escuro'}
              title={darkMode ? 'Ativar tema claro' : 'Ativar tema escuro'}
              className={`p-2 rounded border ${theme.border} hover:bg-zinc-500/10 transition-colors`}>
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <BrutalButton variant="secondary" className="text-xs h-9 px-4" onClick={onReset}>
              Reiniciar
            </BrutalButton>
            <BrutalButton variant="primary" className="text-xs h-9 px-4" onClick={downloadReport}>
              <Download className="w-3 h-3 mr-2" /> Relatório
            </BrutalButton>
          </div>
        </nav>

        {data.execution && (
          <div
            className={`border p-4 text-sm ${data.execution.mode === 'live' ? `${theme.border} opacity-80` : 'border-amber-500 bg-amber-500/10 text-amber-100'}`}
            role={data.execution.mode === 'live' ? 'status' : 'alert'}
          >
            <strong>{data.execution.mode === 'live' ? 'Execução ao vivo' : 'Resultado degradado'}:</strong>{' '}
            {data.execution.mode === 'fixture'
              ? 'os provedores não responderam; estes dados são uma demonstração local e não devem embasar decisões.'
              : data.execution.mode === 'degraded'
                ? 'a execução terminou com uma resposta de contingência; trate os números como aproximações e valide antes de decidir.'
                : `${data.execution.provider}/${data.execution.model}, ${data.execution.attempts} tentativa(s).`}
            {data.execution.warning && <span className="block mt-1">Motivo: {data.execution.warning}</span>}
            {typeof data.execution.seed === 'number' && <span className="block mt-1 font-mono text-xs">Semente do modelo humano: {data.execution.seed} · repete seleção/estado com a mesma entrada; texto do provedor pode variar.</span>}
          </div>
        )}

        <details className={`border-b ${theme.border} pb-4 text-sm`}>
          <summary className="cursor-pointer font-mono font-bold uppercase text-xs tracking-wide focus-visible:outline">Como interpretar esta simulação</summary>
          <div className="mt-3 max-w-3xl space-y-2 leading-relaxed opacity-85">
            <p><strong>Agentes e personas:</strong> cada perfil fornece contexto, vieses e estado humano para orientar a reação. A engine agrega essas respostas para narrar adoção, riscos e impactos; isso não é uma pesquisa com sua equipe.</p>
            <p><strong>Sinais emergentes:</strong> leia-os como alertas para investigar — não como previsões. Um evento sinalizado indica uma possibilidade no cenário e merece validação com dados e pessoas reais.</p>
            <p><strong>Reprodutibilidade:</strong> a semente, quando exibida acima, fixa a seleção e a evolução determinística do modelo humano. Mesmo assim, respostas de LLM e camadas de fallback podem mudar o texto ou os números; compare execuções pelo contexto completo.</p>
            <p><strong>Modo degradado:</strong> o aviso acima identifica quando a execução usou contingência ou fixture local. Nesses casos, use a tela para depuração e aprendizado, não para aprovar investimento ou mudança organizacional.</p>
          </div>
        </details>

        {/* Header Data */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-end">
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-xs font-mono text-emerald-500 uppercase tracking-widest block">Simulação Finalizada</span>
              {data.summary.scenarioValidity !== undefined && (
                <span className={`text-xs font-mono uppercase tracking-widest flex items-center gap-1 ${getValidityColor(validityScore)}`}>
                  {validityScore >= 50 ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  Validação de Cenário: {validityScore}%
                </span>
              )}
            </div>
            <h2 className="text-5xl md:text-7xl font-black uppercase leading-[0.9] tracking-tighter">
              {cleanTitle}
            </h2>
            <div className="flex flex-wrap gap-4 text-xs font-mono opacity-60 border-l-2 border-emerald-500 pl-4">
              <span>ALVO: {config.companySize} FTEs</span>
              <span>//</span>
              <span>ORÇAMENTO: {config.budgetLevel.toUpperCase()}</span>
              <span>//</span>
              <span>ECONOMIA: {config.economicProfileId?.toUpperCase().replace(/_/g, ' ') || 'DEFAULT'}</span>
              <span>//</span>
              <span>MACRO: {(config.economicScenarioId || 'base').toUpperCase()}</span>
              <span>//</span>
              <span>CULTURA: {(config.employeeArchetypes || []).slice(0, 2).join(' + ').toUpperCase()}...</span>
            </div>
          </div>
          <div className="bg-emerald-500/10 p-6 border-l-4 border-emerald-500 rounded-r-lg">
            <div className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-1">ROI Acumulado</div>
            <div className={`text-6xl font-black font-mono flex items-baseline gap-2 ${data.summary.totalRoi >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {data.summary.totalRoi > 0 ? '+' : ''}{data.summary.totalRoi}%
            </div>
            <div className="text-[10px] uppercase font-mono mt-2 opacity-70">Projeção Financeira Realista</div>
          </div>
        </div>

      {/* Agentic Metrics Panel (New) */}
      {data.agenticMetrics && (
        <div className={`p-4 rounded border ${theme.border} ${theme.card} relative overflow-hidden`}>
          <div className="absolute top-0 right-0 p-2 opacity-50">
            <span className="text-[10px] uppercase font-mono border border-zinc-500 px-1 rounded">TELEMETRIA DO CICLO</span>
          </div>
          <h3 className="font-bold text-sm uppercase flex items-center gap-2 tracking-widest mb-4 text-purple-500">
            <Activity className="w-4 h-4" /> Métricas Agênticas
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3 bg-zinc-500/5 rounded border border-zinc-500/10">
              <div className="text-[10px] uppercase opacity-60">Qualidade (QPC)</div>
              <div className={`text-xl font-black font-mono ${data.agenticMetrics.quality_per_cycle > 80 ? 'text-emerald-500' : 'text-yellow-500'}`}>
                {data.agenticMetrics.quality_per_cycle}%
              </div>
            </div>
            <div className="p-3 bg-zinc-500/5 rounded border border-zinc-500/10">
              <div className="text-[10px] uppercase opacity-60">Latência (TTS)</div>
              <div className="text-xl font-black font-mono">
                {(data.agenticMetrics.time_to_solve_ms / 1000).toFixed(2)}s
              </div>
            </div>
            <div className="p-3 bg-zinc-500/5 rounded border border-zinc-500/10">
              <div className="text-[10px] uppercase opacity-60">Custo Estimado</div>
              <div className="text-xl font-black font-mono text-emerald-500">
                ${data.agenticMetrics.cost_estimate_usd.toFixed(4)}
              </div>
            </div>
            <div className="p-3 bg-zinc-500/5 rounded border border-zinc-500/10">
              <div className="text-[10px] uppercase opacity-60">Total Tokens</div>
              <div className="text-xl font-black font-mono text-blue-500">
                {data.agenticMetrics.total_tokens}
              </div>
            </div>
            <div className="p-3 bg-zinc-500/5 rounded border border-zinc-500/10">
              <div className="text-[10px] uppercase opacity-60">Incidência de risco (TIR)</div>
              <div className={`text-xl font-black font-mono ${data.agenticMetrics.tir > 25 ? 'text-red-500' : 'text-emerald-500'}`}>
                {data.agenticMetrics.tir.toFixed(1)}%
              </div>
              <div className="text-[10px] opacity-60">{data.agenticMetrics.risk_incidents} incidentes</div>
            </div>
            <div className="p-3 bg-zinc-500/5 rounded border border-zinc-500/10">
              <div className="text-[10px] uppercase opacity-60">Replanejamentos</div>
              <div className="text-xl font-black font-mono">{data.agenticMetrics.replan_count}</div>
            </div>
            <div className="p-3 bg-zinc-500/5 rounded border border-zinc-500/10">
              <div className="text-[10px] uppercase opacity-60">Router Engine</div>
              <div className="text-xs font-black font-mono uppercase mt-1">
                {data.agenticMetrics.router_choice}
              </div>
            </div>
            <div className="p-3 bg-zinc-500/5 rounded border border-zinc-500/10">
              <div className="text-[10px] uppercase opacity-60">Proveniência</div>
              <div className={`text-xs font-black font-mono uppercase mt-1 ${data.agenticMetrics.degraded ? 'text-amber-500' : 'text-emerald-500'}`}>
                {data.agenticMetrics.degraded ? 'DEGRADADA' : 'COMPLETA'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Emerging human signals */}
      <section className={`p-6 rounded border ${theme.border} ${theme.card}`} aria-labelledby="emerging-signals-title">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 id="emerging-signals-title" className="font-bold text-sm uppercase flex items-center gap-2 tracking-widest text-amber-400">
              <AlertCircle className="w-4 h-4" aria-hidden="true" /> Sinais emergentes
            </h3>
            <p className="text-xs opacity-70 mt-2 max-w-2xl">Alertas do modelo sobre possibilidades humanas, como resistência, afastamentos e apoio à mudança. Use-os para investigar por que a adoção pode mudar; não são previsões nem fatos sobre sua equipe.</p>
          </div>
          <span className="shrink-0 text-xs font-mono opacity-70">{data.emergentEvents?.length || 0} eventos</span>
        </div>
        {data.emergentEvents && data.emergentEvents.length > 0 ? (
          <ol className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
            {data.emergentEvents.map((event, idx) => {
              const meta = getEventMeta(event.type);
              const toneClass = meta.tone === 'critical' ? 'border-red-500/60 bg-red-500/10' : meta.tone === 'warning' ? 'border-amber-500/60 bg-amber-500/10' : meta.tone === 'positive' ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-blue-500/60 bg-blue-500/10';
              return (
                <li key={`${event.month}-${event.persona}-${event.type}-${idx}`} className={`border p-3 ${toneClass}`}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="font-mono font-bold">Mês {event.month}</span>
                    <span className="font-bold uppercase">{meta.label}</span>
                    <span className="opacity-75">Pessoa: {event.persona === '-' ? 'Equipe' : event.persona}</span>
                  </div>
                  <p className="text-sm mt-1 leading-relaxed">{event.event}</p>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="border border-dashed border-zinc-600 p-4 text-sm opacity-70">Nenhum sinal emergente foi registrado neste cenário. Isso não significa risco zero; consulte os pontos de ruptura abaixo.</p>
        )}
      </section>

      {/* Implementation Narrative (New Section) */}
      {data.implementationNarrative && (
        <div className={`p-6 rounded border ${theme.border} ${theme.card}`}>
          <h3 className="font-bold text-sm uppercase flex items-center gap-2 tracking-widest mb-4 text-emerald-500">
            <BookOpen className="w-4 h-4" /> Narrativa da Implantação
          </h3>
          <p className="text-sm md:text-base leading-relaxed opacity-90 font-medium">
            {data.implementationNarrative}
          </p>
        </div>
      )}

      {/* ROI Analysis Section */}
      {(data as any).roiAnalysis && (
        <div className={`p-6 rounded border ${theme.border} ${theme.card}`}>
          <h3 className="font-bold text-sm uppercase flex items-center gap-2 tracking-widest mb-4">
            {(data as any).roiAnalysis.verdict === 'POSITIVO' ? (
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
            <span className={(data as any).roiAnalysis.verdict === 'POSITIVO' ? 'text-emerald-500' : 'text-red-500'}>
              Análise de ROI: {(data as any).roiAnalysis.verdict}
            </span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <h4 className="text-xs font-bold uppercase opacity-60 mb-2">Fatores Principais</h4>
              <div className="space-y-2">
                {(data as any).roiAnalysis.mainFactors?.map((factor: any, idx: number) => (
                  <div key={idx} className={`flex items-start gap-2 p-2 rounded ${factor.impact === 'POSITIVO' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${factor.impact === 'POSITIVO' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <div>
                      <span className="text-xs font-bold">{factor.factor}</span>
                      <p className="text-xs opacity-70">{factor.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className={`p-3 rounded ${theme.card} border ${theme.border}`}>
                <span className="text-xs font-mono uppercase opacity-60">Break-Even</span>
                <div className="text-xl font-bold">
                  {(data as any).roiAnalysis.breakEvenMonth > 0
                    ? `Mês ${(data as any).roiAnalysis.breakEvenMonth}`
                    : 'Não atingido'}
                </div>
              </div>
              <div className={`p-3 rounded ${theme.card} border ${theme.border}`}>
                <span className="text-xs font-mono uppercase opacity-60">Recomendação</span>
                <p className="text-sm font-medium mt-1">{(data as any).roiAnalysis.recommendation}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Business Metrics Panel (Phase 5) */}
      {data.businessMetrics && (
        <div className={`p-6 rounded border ${theme.border} ${theme.card}`}>
          <h3 className="font-bold text-sm uppercase flex items-center gap-2 tracking-widest mb-4 text-blue-500">
            <BarIcon className="w-4 h-4" /> Métricas de Desempenho
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-4 bg-emerald-500/10 rounded border border-emerald-500/30 text-center">
              <div className="text-3xl font-black text-emerald-500">+{data.businessMetrics.efficiencyGain}%</div>
              <div className="text-[10px] uppercase opacity-70 mt-1 font-mono">Ganho Eficiência</div>
            </div>
            <div className="p-4 bg-yellow-500/10 rounded border border-yellow-500/30 text-center">
              <div className="text-3xl font-black text-yellow-500">-{data.businessMetrics.reworkReduction}%</div>
              <div className="text-[10px] uppercase opacity-70 mt-1 font-mono">Redução Retrabalho</div>
            </div>
            <div className="p-4 bg-purple-500/10 rounded border border-purple-500/30 text-center">
              <div className="text-3xl font-black text-purple-500">+{data.businessMetrics.processAgility}%</div>
              <div className="text-[10px] uppercase opacity-70 mt-1 font-mono">Agilidade Processos</div>
            </div>
            <div className="p-4 bg-blue-500/10 rounded border border-blue-500/30 text-center">
              <div className="text-3xl font-black text-blue-500">-{data.businessMetrics.timeToMarket}%</div>
              <div className="text-[10px] uppercase opacity-70 mt-1 font-mono">Time-to-Market</div>
            </div>
            <div className="p-4 bg-zinc-500/10 rounded border border-zinc-500/30 text-center">
              <div className="text-3xl font-black">{data.businessMetrics.qualityScore}</div>
              <div className="text-[10px] uppercase opacity-70 mt-1 font-mono">Score Qualidade</div>
            </div>
          </div>
        </div>
      )}

      {/* Company Evolution Panel (Phase 5) */}
      {data.companyEvolution && (
        <div className={`p-6 rounded border ${theme.border} ${theme.card}`}>
          <h3 className="font-bold text-sm uppercase flex items-center gap-2 tracking-widest mb-4 text-cyan-500">
            <TrendingUp className="w-4 h-4" /> Evolução da Empresa
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="p-4 bg-cyan-500/10 rounded border border-cyan-500/30">
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-[10px] uppercase opacity-60 font-mono">Time Inicial</div>
                  <div className="text-2xl font-black">{data.companyEvolution.initialTeamSize}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase opacity-60 font-mono">Time Final</div>
                  <div className="text-2xl font-black text-cyan-500">{data.companyEvolution.finalTeamSize}</div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-green-500/10 rounded border border-green-500/30 text-center">
              <div className="text-2xl font-black text-green-500">+{data.companyEvolution.newHires}</div>
              <div className="text-[10px] uppercase opacity-70 mt-1 font-mono">Novas Contratações</div>
            </div>
            <div className="p-4 bg-red-500/10 rounded border border-red-500/30 text-center">
              <div className="text-2xl font-black text-red-500">{data.companyEvolution.turnover}%</div>
              <div className="text-[10px] uppercase opacity-70 mt-1 font-mono">Turnover</div>
            </div>
            <div className="p-4 bg-amber-500/10 rounded border border-amber-500/30 text-center">
              <div className="text-2xl font-black text-amber-500">{data.companyEvolution.promotions}</div>
              <div className="text-[10px] uppercase opacity-70 mt-1 font-mono">Promoções</div>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-purple-500/10 rounded border border-purple-500/30 text-center">
              <div className="text-2xl font-black text-purple-500">+{data.companyEvolution.capacityGrowth}%</div>
              <div className="text-[10px] uppercase opacity-70 mt-1 font-mono">Crescimento Capacidade</div>
            </div>
            <div className={`p-4 rounded border text-center ${data.companyEvolution.breakEvenProjection > 0 ? 'bg-blue-500/10 border-blue-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
              <div className={`text-2xl font-black ${data.companyEvolution.breakEvenProjection > 0 ? 'text-blue-500' : 'text-red-500'}`}>
                {data.companyEvolution.breakEvenProjection > 0 ? `Mês ${data.companyEvolution.breakEvenProjection}` : 'Não Projetado'}
              </div>
              <div className="text-[10px] uppercase opacity-70 mt-1 font-mono">Break-Even Previsto</div>
            </div>
            <div className="p-4 bg-zinc-500/10 rounded border border-zinc-500/30 text-center">
              <div className="flex justify-center items-center gap-2">
                <span className="text-xl font-black opacity-50">{data.companyEvolution.maturityLevelBefore}</span>
                <span className="text-xl">→</span>
                <span className="text-xl font-black text-emerald-500">{data.companyEvolution.maturityLevelAfter}</span>
              </div>
              <div className="text-[10px] uppercase opacity-70 mt-1 font-mono">Maturidade (1-5)</div>
            </div>
            <div className={`p-4 rounded border text-center ${data.companyEvolution.culturalShift === 'ENTUSIASTA' ? 'bg-emerald-500/10 border-emerald-500/30' :
              data.companyEvolution.culturalShift === 'FAVORÁVEL' ? 'bg-green-500/10 border-green-500/30' :
                data.companyEvolution.culturalShift === 'NEUTRO' ? 'bg-yellow-500/10 border-yellow-500/30' :
                  'bg-red-500/10 border-red-500/30'
              }`}>
              <div className={`text-lg font-black ${data.companyEvolution.culturalShift === 'ENTUSIASTA' ? 'text-emerald-500' :
                data.companyEvolution.culturalShift === 'FAVORÁVEL' ? 'text-green-500' :
                  data.companyEvolution.culturalShift === 'NEUTRO' ? 'text-yellow-500' :
                    'text-red-500'
                }`}>{data.companyEvolution.culturalShift}</div>
              <div className="text-[10px] uppercase opacity-70 mt-1 font-mono">Mudança Cultural</div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

        {/* Main Chart - Dual Axis (Timeline) */}
        <div className={`md:col-span-8 p-6 rounded border ${theme.border} ${theme.card} relative min-h-[400px]`}>
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-bold text-sm uppercase flex items-center gap-2 tracking-widest">
              <Activity className="w-4 h-4 text-emerald-500" />
              Dinâmica Financeira e Operacional
            </h3>
            <div className="flex gap-4 text-[10px] font-mono uppercase">
              <div className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-500"></div> Adoção (%)</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 bg-purple-500"></div> ROI (Var)</div>
            </div>
          </div>

          <div className="h-[320px] w-full">
            <p className="sr-only">
              Evolução mensal de adoção e ROI, do mês {data.timeline[0]?.month ?? 0} ao mês {data.timeline.at(-1)?.month ?? 0}.
              A adoção final foi {data.timeline.at(-1)?.adoptionRate ?? 0}% e o ROI final foi {data.timeline.at(-1)?.roi ?? 0}%.
            </p>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.timeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAdoption" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.gridColor} vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke={theme.axisColor}
                  tickLine={false}
                  tick={{ fontSize: 10, fontFamily: 'monospace' }}
                  tickFormatter={(val) => `M${val}`}
                  dy={10}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="left"
                  stroke="#10b981"
                  tickLine={false}
                  tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#10b981' }}
                  domain={[0, 100]}
                  dx={-10}
                  label={{ value: 'ADOÇÃO %', angle: -90, position: 'insideLeft', fill: '#10b981', fontSize: 10, fontFamily: 'monospace' }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#a855f7"
                  tickLine={false}
                  tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#a855f7' }}
                  dx={10}
                  label={{ value: 'ROI %', angle: 90, position: 'insideRight', fill: '#a855f7', fontSize: 10, fontFamily: 'monospace' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: darkMode ? '#18181b' : '#fff',
                    border: `1px solid ${darkMode ? '#333' : '#ddd'}`,
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    color: darkMode ? '#fff' : '#000'
                  }}
                  itemStyle={{ color: darkMode ? '#fff' : '#000' }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="adoptionRate"
                  name="Adoção"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#colorAdoption)"
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="roi"
                  name="ROI"
                  stroke="#a855f7"
                  strokeWidth={3}
                  dot={data.timeline.length > 24 ? false : { r: 4, strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* KPI Cards / Personas */}
        <div className="md:col-span-4 grid grid-cols-1 gap-6">
          <div className={`p-6 rounded border ${theme.border} ${theme.card} relative flex-1 flex flex-col`}>
            <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <User className="w-3 h-3" /> Personas & Stakeholders (RAG)
            </h3>
            <div className="space-y-4 overflow-y-auto max-h-[300px] custom-scrollbar pr-2">
              {data.keyPersonas?.map((persona, idx) => {
                const isStakeholder = persona.role.includes("STAKEHOLDER");
                const cleanRole = persona.role.replace(" / STAKEHOLDER", "").replace("/ STAKEHOLDER", "");

                return (
                  <div key={persona.id || `${cleanRole}-${idx}`} className={`p-3 rounded border ${persona.sentiment > 70 ? 'border-emerald-500/60 bg-emerald-500/5' : persona.sentiment < 40 ? 'border-red-500/60 bg-red-500/5' : 'border-yellow-500/60 bg-yellow-500/5'} ${isStakeholder ? 'ring-1 ring-white/20' : ''}`}>
                    <div className="flex justify-between items-start">
                      <span className="font-mono text-[10px] uppercase opacity-70 flex items-center gap-1">
                        {cleanRole}
                        {isStakeholder && <span className="bg-blue-500 text-white px-1 rounded text-[8px] font-bold">STAKEHOLDER</span>}
                      </span>
                      <span className="font-bold text-xs" aria-label={`Sentimento ${persona.sentiment} por cento, ${getSentimentLabel(persona.sentiment)}`}>{persona.sentiment}% · {getSentimentLabel(persona.sentiment)}</span>
                    </div>
                    <div className="font-bold text-sm my-1">{persona.name || cleanRole}</div>
                    <div className="text-[11px] opacity-70">{persona.archetype}{persona.area ? ` · ${persona.area}` : ''}{persona.status && persona.status !== 'ativo' ? ` · ${persona.status}` : ''}</div>
                    <p className="text-xs italic opacity-80 leading-relaxed">"{persona.impact}"</p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-700" role="meter" aria-label={`Aprovação de ${persona.sentiment} por cento`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={persona.sentiment}>
                      <div className={`h-full rounded-full ${persona.sentiment >= 70 ? 'bg-emerald-500' : persona.sentiment < 40 ? 'bg-red-500' : 'bg-yellow-500'}`} style={{ width: `${Math.max(0, Math.min(100, persona.sentiment))}%` }} />
                    </div>
                    {(persona.cognitiveBias || persona.motivation || persona.communicationStyle || persona.challenge) && (
                      <details className="mt-3 text-xs">
                        <summary className="cursor-pointer font-semibold underline underline-offset-4">Por que esta pessoa reage assim</summary>
                        <dl className="mt-2 grid gap-2 opacity-80">
                          {persona.cognitiveBias && <div><dt className="font-semibold">Viés dominante</dt><dd>{persona.cognitiveBias}</dd></div>}
                          {persona.motivation && <div><dt className="font-semibold">Motivação</dt><dd>{persona.motivation}</dd></div>}
                          {persona.communicationStyle && <div><dt className="font-semibold">Comunicação</dt><dd>{persona.communicationStyle}</dd></div>}
                          {persona.challenge && <div><dt className="font-semibold">Tensão atual</dt><dd>{persona.challenge}</dd></div>}
                          {(persona.stress !== undefined || persona.energy !== undefined || persona.engagement !== undefined) && (
                            <div><dt className="font-semibold">Estado interno</dt><dd>Estresse {persona.stress ?? '—'} · Energia {persona.energy ?? '—'} · Engajamento {persona.engagement ?? '—'}</dd></div>
                          )}
                        </dl>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* New Charts Row (Pie & Bar) */}
        <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Budget/Resource Allocation Pie */}
          <div className={`p-6 rounded border ${theme.border} ${theme.card} min-h-[300px]`}>
            <h3 className="font-bold text-sm uppercase flex items-center gap-2 tracking-widest mb-4">
              <PieIcon className="w-4 h-4 text-emerald-500" /> Distribuição de Recursos
            </h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.resourceAllocation || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="amount"
                    nameKey="category"
                  >
                    {(data.resourceAllocation || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: darkMode ? '#18181b' : '#fff', borderRadius: '4px', color: darkMode ? '#fff' : '#000' }}
                    itemStyle={{ color: darkMode ? '#fff' : '#000' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sentiment Breakdown Bar */}
          <div className={`p-6 rounded border ${theme.border} ${theme.card} min-h-[300px]`}>
            <h3 className="font-bold text-sm uppercase flex items-center gap-2 tracking-widest mb-4">
              <BarIcon className="w-4 h-4 text-emerald-500" /> Análise de Sentimento
            </h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.sentimentBreakdown || []} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme.gridColor} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="group" type="category" stroke={theme.axisColor} width={80} tick={{ fontSize: 10 }} />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ backgroundColor: darkMode ? '#18181b' : '#fff', color: darkMode ? '#fff' : '#000' }}
                    itemStyle={{ color: darkMode ? '#fff' : '#000' }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                    {(data.sentimentBreakdown || []).map((entry, index) => (
                      // @ts-ignore
                      <Cell key={`cell-${index}`} fill={SENTIMENT_COLORS[entry.group] || COLORS[index]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Radar Chart (Systemic Balance) */}
          <div className={`p-6 rounded border ${theme.border} ${theme.card} min-h-[300px]`}>
            <h3 className="w-full text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Equilíbrio Sistêmico</h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={[
                  { subject: 'Processos', A: data.timeline[data.timeline.length - 1].efficiency, fullMark: 100 },
                  { subject: 'Compliance', A: data.timeline[data.timeline.length - 1].compliance, fullMark: 100 },
                  { subject: 'Cultura', A: data.summary.finalAdoption, fullMark: 100 },
                  { subject: 'Maturidade', A: data.summary.maturityScore * 10, fullMark: 100 },
                ]}>
                  <PolarGrid stroke={theme.gridColor} />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: theme.axisColor, fontSize: 10, fontWeight: 'bold' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Impacto" dataKey="A" stroke="#10b981" strokeWidth={2} fill="#10b981" fillOpacity={0.2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        <div className="md:col-span-8 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
            {/* Department Readiness */}
            <div className={`p-6 rounded border ${theme.border} ${theme.card}`}>
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Aderência por Setor</h3>
              <div className="space-y-3">
                {data.departmentReadiness.map((dept, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono uppercase">
                      <span>{dept.department}</span>
                      <span className={dept.score < 50 ? 'text-red-500' : 'text-emerald-500'}>{dept.score}%</span>
                    </div>
                    <div className={`h-1.5 w-full rounded-full ${darkMode ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${dept.score > 70 ? 'bg-emerald-500' : dept.score > 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${dept.score}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Risks - Condensed */}
            <div className={`p-6 rounded border ${theme.border} ${theme.card} overflow-y-auto max-h-[350px] custom-scrollbar`}>
              <h3 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-4">Pontos de Ruptura</h3>
              <div className="space-y-3">
                {data.risks.map((risk, idx) => (
                  <div key={idx} className="pb-3 border-b border-zinc-800 last:border-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${risk.category === 'Crítico' ? 'bg-red-500 animate-pulse' : 'bg-yellow-500'}`}></div>
                      <span className="text-[10px] font-bold uppercase opacity-80">{risk.category}</span>
                    </div>
                    <p className="text-sm font-medium leading-tight mb-1">{risk.description}</p>
                    <p className="text-xs font-mono opacity-50">Mitigação: {risk.mitigation}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Strategy Roadmap */}
        <div className="md:col-span-12 pt-6 border-t border-zinc-800">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6">Execução Estratégica Recomendada</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {data.recommendations.map((rec, idx) => (
              <div key={idx} className={`p-5 rounded border ${theme.border} ${theme.card} hover:border-emerald-500/50 transition-colors`}>
                <div className="text-[10px] font-mono uppercase text-emerald-500 mb-2">Fase {rec.phase}</div>
                <p className="text-sm font-medium">{rec.action}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      </div>

      <footer className="flex justify-between items-center pt-10 border-t border-zinc-800 opacity-40 font-mono text-[10px] uppercase">
        <span>Simulation Hash: {stableRunHash(data, config)}</span>
        <span>Provider Gateway // LangGraph Engine</span>
      </footer>
    </div>

  );
};
