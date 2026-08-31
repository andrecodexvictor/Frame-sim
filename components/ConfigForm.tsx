
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { SimulationConfig, FrameworkInput, CorporateArchetype } from '../types';
import { BrutalButton } from './ui/BrutalButton';
import {
  User, Shield, Zap, Clock, Briefcase, GraduationCap, Crown, Heart,
  TrendingUp, BarChart3, CheckSquare, Award, Hammer, Gem, DollarSign, Globe, Anchor,
  Activity, Server, History, FileWarning, Target
} from 'lucide-react';
import { CostBreakdownPanel } from './CostBreakdownPanel';

interface ConfigFormProps {
  frameworks: FrameworkInput[];
  onSubmit: (config: SimulationConfig) => void;
  onBack: () => void;
  onBatchMode?: (config: SimulationConfig) => void;
  agenticAvailable?: boolean | null;
}

const ARCHETYPES: { id: CorporateArchetype; label: string; icon: React.ElementType; desc: string }[] = [
  // Operational Levels
  { id: 'new_grad', label: 'Júnior / Trainee', icon: GraduationCap, desc: 'Inexperientes, ávidos' },
  { id: 'mid_level', label: 'Pleno', icon: Hammer, desc: 'Executor, carrega o piano' },
  { id: 'senior_staff', label: 'Sênior / Staff', icon: Award, desc: 'Alta XP, caro, pragmático' },
  { id: 'overworked', label: 'Sobrecarregados', icon: Clock, desc: 'Sem tempo para inovar' },

  // Psychological Profiles
  { id: 'visionary', label: 'Visionários', icon: Zap, desc: 'Aceitam riscos altos' },
  { id: 'skeptic', label: 'Céticos', icon: Shield, desc: 'Resistência passiva' },
  { id: 'legacy_keeper', label: 'Guardiões Legado', icon: Briefcase, desc: 'Protegem o status quo' },
  { id: 'political_player', label: 'Políticos', icon: Crown, desc: 'Jogos de poder internos' },

  // Specific Functions
  { id: 'hr_guardian', label: 'RH / People', icon: Heart, desc: 'Foco em cultura' },
  { id: 'sales_shark', label: 'Comercial', icon: TrendingUp, desc: 'Venda acima de tudo' },
  { id: 'data_driven', label: 'Analistas Dados', icon: BarChart3, desc: 'Só confiam em métricas' },
  { id: 'bureaucrat', label: 'Burocratas', icon: Anchor, desc: 'Processo pelo processo' },

  // C-Level & Executives
  { id: 'ceo', label: 'CEO', icon: Gem, desc: 'Visão Macro / Impaciente' },
  { id: 'cto', label: 'CTO / Tech Lead', icon: Zap, desc: 'Decisor Técnico' },
  { id: 'cmo', label: 'CMO / Marketing', icon: Globe, desc: 'Branding e Mercado' },
  { id: 'cfo', label: 'CFO / Financeiro', icon: DollarSign, desc: 'Guardião do Cofre' },
  { id: 'coo', label: 'COO / Operações', icon: Activity, desc: 'Eficiência a qualquer custo' },
];

const PRESET_SCENARIOS = [
  { id: 'merger', label: 'Fusão & Aquisição (M&A)', desc: 'Choque cultural entre duas empresas. Sistemas duplicados.' },
  { id: 'ipo_prep', label: 'Preparação para IPO', desc: 'Compliance extremo, pressão por resultados trimestrais.' },
  { id: 'legacy_migration', label: 'Migração de Legado Crítico', desc: 'Risco técnico altíssimo. O "avião está voando".' },
  { id: 'budget_cut', label: 'Corte de Custos (Layoffs)', desc: 'Moral baixa, equipes enxutas, medo generalizado.' },
  { id: 'hypergrowth', label: 'Hipercrescimento (Scale-up)', desc: 'Contratando 50 pessoas/mês. Caos organizado.' },
];

export const ConfigForm: React.FC<ConfigFormProps> = ({ frameworks, onSubmit, onBack, onBatchMode, agenticAvailable }) => {
  const { register, handleSubmit, watch, setValue } = useForm<SimulationConfig>({
    defaultValues: {
      frameworks: frameworks,
      frameworkCategory: 'hybrid',
      companySize: 100,
      currentMaturity: 2,
      sector: 'tech',
      budgetLevel: 'medium',
      employeeArchetypes: ['skeptic', 'mid_level', 'senior_staff', 'cto'],

      // Defaults for realism
      techDebtLevel: 'medium',
      operationalVelocity: 'bureaucrat',
      previousFailures: false,
      scenarioMode: 'recommended',
      selectedScenarioId: 'legacy_migration',
      customScenarioText: '',
      durationMonths: 12,
      economicProfileId: 'br_pme', // Default to Brazilian PME
      economicScenarioId: 'base'
    }
  });

  const selectedArchetypes = watch('employeeArchetypes');
  const scenarioMode = watch('scenarioMode');

  const toggleArchetype = (id: CorporateArchetype) => {
    const current = selectedArchetypes || [];
    if (current.includes(id)) {
      setValue('employeeArchetypes', current.filter(a => a !== id));
    } else {
      setValue('employeeArchetypes', [...current, id]);
    }
  };

  const toggleAllArchetypes = () => {
    const current = selectedArchetypes || [];
    if (current.length === ARCHETYPES.length) {
      setValue('employeeArchetypes', []);
    } else {
      setValue('employeeArchetypes', ARCHETYPES.map(a => a.id));
    }
  };

  const isComparison = frameworks.length > 1;

  return (
    <div className="w-full max-w-5xl mx-auto animate-fade-in-up text-zinc-900 pb-20">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-3xl font-black uppercase text-brutal-black dark:text-white">
          {isComparison ? 'Parâmetros do Cenário' : 'Configuração'}
        </h2>
        <div className="flex items-center gap-4">
          <label className={`flex items-center gap-2 bg-white dark:bg-zinc-800 p-2 border-2 border-brutal-black shadow-sm ${agenticAvailable === false ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
            <span className="font-bold text-xs uppercase" id="agentic-mode-label">MODO AGÊNTICO</span>
            <div className="relative inline-flex items-center cursor-pointer">
              <input
                id="agentic-mode"
                type="checkbox"
                className="sr-only peer"
                {...register('simulationMode')}
                value="agentic"
                disabled={agenticAvailable !== true}
                aria-describedby="agentic-mode-help"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
            </div>
            <span id="agentic-mode-help" className="sr-only">
              {agenticAvailable === true ? 'Backend agêntico disponível.' : agenticAvailable === false ? 'Backend agêntico indisponível. Execute-o na porta 3002 para habilitar.' : 'Verificando disponibilidade do backend agêntico.'}
            </span>
          </label>
          <span className="hidden sm:inline text-[10px] font-mono text-zinc-500" role="status">
            {agenticAvailable === true ? 'BACKEND AGÊNTICO ONLINE' : agenticAvailable === false ? 'AGÊNTICO OFFLINE · PADRÃO DISPONÍVEL' : 'VERIFICANDO BACKEND…'}
          </span>
          <span className="bg-brutal-black text-white font-mono px-2 py-1 text-xs">PASSO 2/3</span>
        </div>
      </div>

      <details className="mb-6 w-full border-b border-zinc-700 pb-4 text-sm text-zinc-300">
        <summary className="cursor-pointer font-mono font-bold uppercase text-xs tracking-wide focus-visible:outline">Como a simulação reage</summary>
        <div className="mt-3 max-w-3xl space-y-2 leading-relaxed">
          <p><strong>Personas:</strong> os perfis selecionados influenciam resistência, humor e a narrativa dos agentes. Eles representam hipóteses de comportamento, não pessoas reais nem votos individuais.</p>
          <p><strong>Sinais emergentes:</strong> alertas do modelo — por exemplo, resistência, afastamento ou apoio — que ajudam a investigar sensibilidades do cenário. Não são previsões nem fatos sobre sua equipe.</p>
          <p><strong>Semente:</strong> quando uma semente é informada, ela torna a seleção e o estado humano determinísticos para aquela entrada. O texto gerado pelo provedor ainda pode variar; não há garantia de repetição idêntica.</p>
          <p><strong>Modo degradado:</strong> se o backend agêntico estiver indisponível, use o modo padrão. Se os provedores falharem, o resultado pode ser uma demonstração local sinalizada na tela de resultados; não use esse resultado para decisões.</p>
        </div>
      </details>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white dark:bg-zinc-900 border-4 border-brutal-black dark:border-zinc-700 shadow-hard p-8 space-y-10 transition-colors">

        {/* SECTION 1: BASIC CONTEXT */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-700 pb-2">
            <Target className="w-5 h-5 text-brutal-green" />
            <h3 className="font-black text-lg uppercase dark:text-white">1. Contexto Estrutural</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="framework-category" className="font-bold text-sm uppercase dark:text-zinc-300">Categoria do Cenário</label>
              <div className="relative">
                <select
                  id="framework-category"
                  {...register('frameworkCategory')}
                  className="w-full p-4 border-2 border-brutal-black font-mono focus:outline-none focus:border-brutal-green bg-zinc-50 dark:bg-zinc-800 dark:text-white appearance-none uppercase"
                >
                  <option value="development">Desenvolvimento (Engenharia / DevOps / QA)</option>
                  <option value="management">Gestão (Ágil / Projetos / Produto)</option>
                  <option value="governance">Governança (Compliance / Segurança / Audit)</option>
                  <option value="hybrid">Híbrido / Transformação Digital Geral</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-xs font-bold dark:text-white">▼</div>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="sector" className="font-bold text-sm uppercase dark:text-zinc-300">Setor de Atuação</label>
              <select
                id="sector"
                {...register('sector')}
                className="w-full p-4 border-2 border-brutal-black font-mono focus:outline-none focus:border-brutal-green bg-white dark:bg-zinc-800 dark:text-white dark:border-zinc-600 uppercase"
              >
                <option value="tech">Tecnologia / SaaS</option>
                <option value="finance">Financeiro / Fintech</option>
                <option value="retail">Varejo / E-commerce</option>
                <option value="healthcare">Saúde / Pharma</option>
                <option value="industry">Indústria / Manufatura</option>
                <option value="public">Setor Público / Gov</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="company-size" className="font-bold text-sm uppercase dark:text-zinc-300">Tamanho (FTEs)</label>
              <input
                id="company-size"
                type="number"
                {...register('companySize', { valueAsNumber: true })}
                className="w-full p-3 border-2 border-brutal-black font-mono focus:outline-none focus:border-brutal-green dark:bg-zinc-800 dark:text-white dark:border-zinc-600"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="budget-level" className="font-bold text-sm uppercase dark:text-zinc-300">Orçamento Disponível</label>
              <select
                id="budget-level"
                {...register('budgetLevel')}
                className="w-full p-3 border-2 border-brutal-black font-mono focus:outline-none focus:border-brutal-green bg-white dark:bg-zinc-800 dark:text-white dark:border-zinc-600 uppercase"
              >
                <option value="low">Restrito (Bootstrap/Crise)</option>
                <option value="medium">Adequado (Padrão de Mercado)</option>
                <option value="high">Agressivo (Venture Capital/Bonança)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="economic-profile" className="font-bold text-sm uppercase dark:text-zinc-300">💰 Perfil Econômico</label>
              <select
                id="economic-profile"
                {...register('economicProfileId')}
                className="w-full p-3 border-2 border-brutal-black font-mono focus:outline-none focus:border-brutal-green bg-white dark:bg-zinc-800 dark:text-white dark:border-zinc-600 text-sm"
              >
                <option value="br_interior">🇧🇷 Brasil - Interior/Região (Custo Baixo)</option>
                <option value="br_pme">🇧🇷 Brasil - PME (Pequena/Média Empresa)</option>
                <option value="br_startup">🇧🇷 Brasil - Startup Tech (SP/RJ)</option>
                <option value="br_enterprise_lean">🇧🇷 Brasil - Grande Empresa (Custo Controlado)</option>
                <option value="br_enterprise">🇧🇷 Brasil - Grande Empresa (Premium)</option>
                <option value="latam_remote">🌎 LATAM - Remoto para Exterior (USD)</option>
                <option value="us_faang">🇺🇸 USA - Big Tech / FAANG (USD)</option>
                <option value="eu_western">🇪🇺 Europa Ocidental (EUR)</option>
              </select>
              <p className="text-xs opacity-60 font-mono">Define custos de salários, incidentes e valor de features</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="economic-scenario" className="font-bold text-sm uppercase dark:text-zinc-300">Cenário macroeconômico</label>
              <select
                id="economic-scenario"
                {...register('economicScenarioId')}
                className="w-full p-3 border-2 border-brutal-black font-mono focus:outline-none focus:border-brutal-green bg-white dark:bg-zinc-800 dark:text-white dark:border-zinc-600 text-sm"
              >
                <option value="base">Base — referência neutra</option>
                <option value="recession">Recessão — demanda e orçamento pressionados</option>
                <option value="expansion">Expansão — demanda e investimento maiores</option>
                <option value="auto">Variação seedada — cenário escolhido pela semente</option>
              </select>
              <p className="text-xs opacity-60 font-mono">Hipótese de estresse para comparação; não é previsão econômica.</p>
            </div>

            {/* Cost Breakdown Panel */}
            <div className="md:col-span-2">
              <CostBreakdownPanel profileId={watch('economicProfileId') || 'br_pme'} />
            </div>

            <div className="md:col-span-2 space-y-2">
               <span className="font-bold text-sm uppercase dark:text-zinc-300 flex items-center gap-2">
                 <Clock className="w-4 h-4 text-brutal-green" /> Duração da Simulação
               </span>
              <div className="grid grid-cols-2 gap-4">
                <label className="cursor-pointer">
                  <input
                    id="duration-12"
                    type="radio"
                    value="12"
                    {...register('durationMonths', { valueAsNumber: true })}
                    className="peer sr-only"
                  />
                  <div className="p-3 border-2 border-zinc-300 dark:border-zinc-700 peer-checked:border-brutal-green peer-checked:bg-brutal-green/5 bg-zinc-50 dark:bg-zinc-900 transition-all text-center">
                    <span className="font-bold text-sm uppercase dark:text-white">Padrão (12 Meses)</span>
                    <p className="text-[10px] opacity-60 font-mono">Foco em adoção inicial</p>
                  </div>
                </label>
                <label className="cursor-pointer">
                  <input
                    id="duration-60"
                    type="radio"
                    value="60"
                    {...register('durationMonths', { valueAsNumber: true })}
                    className="peer sr-only"
                  />
                  <div className="p-3 border-2 border-zinc-300 dark:border-zinc-700 peer-checked:border-brutal-green peer-checked:bg-brutal-green/5 bg-zinc-50 dark:bg-zinc-900 transition-all text-center">
                    <span className="font-bold text-sm uppercase dark:text-white">Longo Prazo (5 Anos)</span>
                    <p className="text-[10px] opacity-60 font-mono">Foco em maturidade e cultura</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: REALISM PARAMETERS */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-700 pb-2">
            <Activity className="w-5 h-5 text-red-500" />
            <h3 className="font-black text-lg uppercase dark:text-white">2. Calibragem de Realismo</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
               <label htmlFor="tech-debt" className="font-bold text-sm uppercase dark:text-zinc-300 flex items-center gap-2">
                <Server className="w-4 h-4" /> Dívida Técnica
              </label>
               <select
                 id="tech-debt"
                {...register('techDebtLevel')}
                className="w-full p-2 border-2 border-brutal-black font-mono text-sm bg-zinc-50 dark:bg-zinc-800 dark:text-white dark:border-zinc-600 uppercase"
              >
                <option value="low">Baixa (Greenfield)</option>
                <option value="medium">Média (Sistemas Estáveis)</option>
                <option value="high">Alta (Monolito Legado)</option>
                <option value="critical">Crítica (Risco de Colapso)</option>
              </select>
              <p className="text-[10px] opacity-60 dark:text-zinc-400">Impacta diretamente custos iniciais e tempo.</p>
            </div>

            <div className="space-y-2">
               <label htmlFor="operational-velocity" className="font-bold text-sm uppercase dark:text-zinc-300 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Velocidade Operacional
              </label>
               <select
                 id="operational-velocity"
                {...register('operationalVelocity')}
                className="w-full p-2 border-2 border-brutal-black font-mono text-sm bg-zinc-50 dark:bg-zinc-800 dark:text-white dark:border-zinc-600 uppercase"
              >
                <option value="startup">Startup (Caos Ágil)</option>
                <option value="agile">Ágil Corporativo</option>
                  <option value="bureaucrat">Burocrática (Lenta)</option>
                <option value="fossilized">Fossilizada (Resistente)</option>
              </select>
              <p className="text-[10px] opacity-60 dark:text-zinc-400">Define a inércia da cultura.</p>
            </div>

            <div className="space-y-2">
              <label className="font-bold text-sm uppercase dark:text-zinc-300 flex items-center gap-2">
                <History className="w-4 h-4" /> Histórico Traumático
              </label>
              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                   <input id="previous-failures" type="checkbox" {...register('previousFailures')} className="w-5 h-5 accent-brutal-green" />
                  <span className="font-mono text-sm dark:text-white">Sim, falhamos antes.</span>
                </label>
              </div>
              <p className="text-[10px] opacity-60 dark:text-zinc-400">Aumenta drasticamente a resistência inicial (Ceticismo).</p>
            </div>
          </div>
        </div>

        {/* SECTION 3: HUMAN RESOURCES */}
        <div className="space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2 border-b border-zinc-200 dark:border-zinc-700 pb-2">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-purple-500" />
              <h3 className="font-black text-lg uppercase dark:text-white">
                3. Ecossistema Humano
              </h3>
            </div>
              <button
                type="button"
                onClick={toggleAllArchetypes}
                aria-pressed={selectedArchetypes?.length === ARCHETYPES.length}
              className="text-[10px] uppercase font-bold font-mono border border-brutal-black dark:border-zinc-500 px-2 py-1 hover:bg-brutal-green hover:text-black hover:border-brutal-green transition-colors flex items-center gap-1 dark:text-white"
            >
              <CheckSquare className="w-3 h-3" />
              {selectedArchetypes?.length === ARCHETYPES.length ? 'Remover Todos' : 'Selecionar Todos'}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {ARCHETYPES.map((arch) => {
              const isSelected = selectedArchetypes?.includes(arch.id);
              const isCLevel = ['ceo', 'cto', 'cmo', 'cfo', 'coo'].includes(arch.id);

              return (
                <button
                  key={arch.id}
                  type="button"
                  onClick={() => toggleArchetype(arch.id)}
                  aria-pressed={isSelected}
                  className={`p-3 border-2 text-left transition-all relative overflow-hidden group min-h-[90px] flex flex-col justify-between ${isSelected
                    ? 'border-brutal-green bg-brutal-green/10 dark:bg-brutal-green/20'
                    : isCLevel
                      ? 'border-purple-500/30 dark:border-purple-500/50 bg-purple-50/50 dark:bg-purple-900/10'
                      : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 bg-zinc-50 dark:bg-zinc-800'
                    }`}
                >
                  <div className="flex items-start justify-between mb-1 w-full">
                    <arch.icon className={`w-5 h-5 ${isSelected ? 'text-brutal-green' : isCLevel ? 'text-purple-500' : 'text-zinc-400'}`} />
                    {isSelected && <div className="w-2 h-2 bg-brutal-green rounded-full shadow-[0_0_5px_#00ff88]"></div>}
                  </div>
                  <div>
                    <div className={`font-bold text-[11px] uppercase leading-tight ${isSelected ? 'text-brutal-green' : isCLevel ? 'text-purple-400' : 'text-zinc-600 dark:text-zinc-300'}`}>
                      {arch.label}
                    </div>
                    <div className="text-[9px] font-mono leading-tight opacity-70 dark:text-zinc-500 mt-1">
                      {arch.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* SECTION 4: SCENARIO CONTEXT (NEW) */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-700 pb-2">
            <FileWarning className="w-5 h-5 text-yellow-500" />
            <h3 className="font-black text-lg uppercase dark:text-white">4. Contexto Situacional (Opcional)</h3>
          </div>

          <div className="flex gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="recommended"
                {...register('scenarioMode')}
                className="accent-brutal-green"
              />
              <span className={`font-mono text-sm uppercase font-bold ${scenarioMode === 'recommended' ? 'text-brutal-green' : 'dark:text-zinc-400'}`}>Cenário da Plataforma</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="custom"
                {...register('scenarioMode')}
                className="accent-brutal-green"
              />
              <span className={`font-mono text-sm uppercase font-bold ${scenarioMode === 'custom' ? 'text-brutal-green' : 'dark:text-zinc-400'}`}>Cenário Hipotético</span>
            </label>
          </div>

          {scenarioMode === 'recommended' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PRESET_SCENARIOS.map(sc => (
                <label key={sc.id} className="cursor-pointer">
                  <input
                    type="radio"
                    value={sc.id}
                    {...register('selectedScenarioId')}
                    className="peer sr-only"
                  />
                  <div className="h-full p-4 border-2 border-zinc-300 dark:border-zinc-700 peer-checked:border-brutal-green peer-checked:bg-brutal-green/5 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all">
                    <div className="font-bold text-sm uppercase mb-1 dark:text-white">{sc.label}</div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{sc.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
               <label htmlFor="custom-scenario" className="sr-only">Descreva o cenário hipotético</label>
               <textarea
                 id="custom-scenario"
                {...register('customScenarioText')}
                className="w-full h-32 p-4 border-2 border-brutal-black dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:border-brutal-green font-mono text-sm dark:text-white"
                placeholder="Descreva o cenário hipotético... Ex: 'A empresa acabou de sofrer um vazamento de dados massivo e o CTO foi demitido. O clima é de pânico e auditoria constante.'"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">Quanto mais detalhes dramáticos, mais precisa será a simulação de crise.</p>
            </div>
          )}
        </div>

        <div className="pt-6 flex gap-4">
          <BrutalButton type="button" variant="secondary" onClick={onBack} className="flex-1">
            VOLTAR
          </BrutalButton>

          {onBatchMode && (
            <BrutalButton
              type="button"
              variant="secondary"
              onClick={handleSubmit((data) => onBatchMode(data))}
              className="flex-1 bg-purple-100 hover:bg-purple-200 text-purple-900 border-purple-900"
            >
              VALIDAÇÃO EM LOTE (TCC)
            </BrutalButton>
          )}

          <BrutalButton type="submit" className="flex-[2]">
              {isComparison ? 'EXECUTAR COMPARAÇÃO' : 'EXECUTAR SIMULAÇÃO'}
          </BrutalButton>
        </div>
      </form>
    </div>
  );
};
