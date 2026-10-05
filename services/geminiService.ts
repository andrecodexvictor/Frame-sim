import { normalizeStandardMeasurements } from './standardMeasurements';
import { incidentContext, resolveWorkPolicy, simulateWorkBlock } from '../RAG/src/core/syntheticWork';
/// <reference types="vite/client" />

import { SingleSimulationConfig, SimulationOutput } from "../types";
import { calculateMonthlyMetrics, SimulationRawData, getCostProfile, getEconomicScenario, calculateFrameworkFit } from "./metricsCalculator";
import { MOCK_SIMULATION_RESULT } from "./mockData";
import { generateRAGContext, injectRAGContext } from "./ragService";
import { enrichArchetypesToTeam, generateTeamDescription, calculateTeamResistance } from "./personaEnricher";
import { simulateTeamOffline, hashString, mulberry32 } from "../RAG/src/core/employeeBrainCore";
import { generateProviderContent } from './providerClient';
import { TraceRecorder } from '../RAG/src/services/TraceRecorder';
import { evaluateIndividualMetrics } from '../RAG/src/services/IndividualMetrics';
import { addressedRandom, commonScenarioSeed } from './experimentProtocol';
import { createClientRunManifest } from './clientRunManifest';

// Google accepts these JSON-schema enum values over its REST API. Keeping the
// tiny constants local avoids shipping the provider SDK (and credentials) to
// every browser session.
const Type = {
  OBJECT: 'OBJECT',
  ARRAY: 'ARRAY',
  STRING: 'STRING',
  NUMBER: 'NUMBER'
} as const;


// === NEW: Document Digestion Service (Gemini Flash) ===
export const digestFrameworkDocument = async (rawText: string): Promise<string> => {
  try {
    const prompt = `Você é um Arquiteto de Soluções Sênior. Sua tarefa é analisar este documento técnico de um Framework Corporativo e extrair um MANIFESTO ESTRUTURADO DENSO para ser usado em uma simulação.

Foque em:
1. Valores Core e Filosofia
2. Papéis e Responsabilidades (Quem faz o que)
3. Cerimônias, Reuniões e Eventos
4. Artefatos e Saídas
5. Estratégias de Adoção Recomendadas

Se o texto for muito longo, priorize os processos e regras de negócio.

SAÍDA: Um texto Markdown bem estruturado e conciso (máximo 4000 caracteres) com essas seções.

DOCUMENTO ORIGINAL (Trecho): ${rawText.slice(0, 120000)}`;

    const result = await generateProviderContent({
      task: 'document-digest',
      prompt,
      temperature: 0.2,
      timeoutMs: 90_000
    });

    return result.content
      ? `=== DOCUMENTO DIGERIDO (${result.provider}/${result.model}) ===\n\n${result.content}`
      : rawText;

  } catch (error) {
    console.error("Erro na digestão do documento:", error);
    return rawText; // Fallback to raw text on error
  }
};


export const SIMULATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.OBJECT,
      properties: {
        finalAdoption: { type: Type.NUMBER, description: "Porcentagem final de adoção (0-100)" },
        totalRoi: { type: Type.NUMBER, description: "ROI financeiro. IMPORTANTE: Pode ser negativo (ex: -20) ou alto (ex: 350)." },
        maturityScore: { type: Type.NUMBER, description: "Pontuação final de maturidade (1-10)" },
        monthsToComplete: { type: Type.NUMBER, description: "Meses reais estimados (considerando atrasos)" },
        scenarioValidity: { type: Type.NUMBER, description: "Score de 0-100 indicando a viabilidade/realismo da combinação de cenário proposta." },
      },
      required: ["finalAdoption", "totalRoi", "maturityScore", "monthsToComplete", "scenarioValidity"],
    },
    implementationNarrative: { type: Type.STRING, description: "Um resumo executivo de 2-3 parágrafos contando a história de como foi a implantação, focando nos pontos de virada." },
    roiAnalysis: {
      type: Type.OBJECT,
      description: "Análise detalhada explicando por que o ROI ficou positivo ou negativo",
      properties: {
        verdict: { type: Type.STRING, enum: ["POSITIVO", "NEGATIVO", "NEUTRO"], description: "Resultado geral do ROI" },
        mainFactors: {
          type: Type.ARRAY,
          description: "3-5 fatores principais que influenciaram o ROI (positivos ou negativos)",
          items: {
            type: Type.OBJECT,
            properties: {
              factor: { type: Type.STRING, description: "Nome do fator (ex: 'Curva J Acentuada', 'Dívida Técnica', 'Resistência Cultural')" },
              impact: { type: Type.STRING, enum: ["POSITIVO", "NEGATIVO"], description: "Se contribuiu positiva ou negativamente" },
              description: { type: Type.STRING, description: "Explicação curta de como este fator afetou o ROI" }
            },
            required: ["factor", "impact", "description"]
          }
        },
        breakEvenMonth: { type: Type.NUMBER, description: "Mês em que o ROI passou a ser positivo (0 se nunca)" },
        recommendation: { type: Type.STRING, description: "Recomendação de 1 frase para melhorar o ROI" }
      },
      required: ["verdict", "mainFactors", "breakEvenMonth", "recommendation"]
    },
    sentimentBreakdown: {
      type: Type.ARRAY,
      description: "Distribuição do sentimento dos funcionários para gráfico de pizza/rosca.",
      items: {
        type: Type.OBJECT,
        properties: {
          group: { type: Type.STRING, enum: ["Promotores", "Neutros", "Detratores"] },
          value: { type: Type.NUMBER, description: "Quantidade de pessoas ou porcentagem" }
        },
        required: ["group", "value"]
      }
    },
    resourceAllocation: {
      type: Type.ARRAY,
      description: "Onde o orçamento/esforço foi gasto para gráfico de pizza.",
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING, enum: ["Treinamento", "Licenças/Ferramentas", "Consultoria", "Perda de Produtividade (Curva J)"] },
          amount: { type: Type.NUMBER, description: "Valor relativo ou porcentagem" }
        },
        required: ["category", "amount"]
      }
    },
    timeline: {
      type: Type.ARRAY,
      description: "Dados mensais. OBRIGATÓRIO: Forneça os dados brutos operacionais (features, bugs) para que o sistema calcule o ROI exato.",
      items: {
        type: Type.OBJECT,
        properties: {
          month: { type: Type.NUMBER },
          adoptionRate: { type: Type.NUMBER },
          // Removed ROI from LLM responsibility - it will be calculated
          compliance: { type: Type.NUMBER },
          efficiency: { type: Type.NUMBER },
          rawData: {
            type: Type.OBJECT,
            properties: {
              featuresDelivered: { type: Type.NUMBER, description: "Quantidade absoluta de features, histórias ou PROCESSOS/CONTROLES (para Governança) entregues." },
              bugsGenerated: { type: Type.NUMBER, description: "Quantidade de bugs encontrados em produção" },
              criticalIncidents: { type: Type.NUMBER, description: "Incidentes graves (P0)" },
              teamSize: { type: Type.NUMBER, description: "Tamanho do time neste mês" },
              learningCurveFactor: { type: Type.NUMBER, description: "Fator de produtividade (0.5 = aprendendo, 1.0 = normal, 1.2 = performando)" }
            },
            required: ["featuresDelivered", "bugsGenerated", "criticalIncidents", "teamSize", "learningCurveFactor"]
          }
        },
        required: ["month", "adoptionRate", "compliance", "efficiency", "rawData"],
      },
    },
    keyPersonas: {
      type: Type.ARRAY,
      description: "Simulação de 3 a 5 arquétipos de funcionários reais que impactaram o resultado. OBRIGATÓRIO: Identifique stakeholders críticos.",
      items: {
        type: Type.OBJECT,
        properties: {
          role: { type: Type.STRING, description: "Cargo e Nome fictício baseado no perfil. ADICIONE ' / STAKEHOLDER' AO FINAL SE FOR UM TOMADOR DE DECISÃO CRÍTICO." },
          archetype: { type: Type.STRING, description: "Perfil psicológico utilizado (ex: Cético, Visionário)" },
          sentiment: { type: Type.NUMBER, description: "Nível de aprovação 0-100" },
          impact: { type: Type.STRING, description: "Citação ou ação específica que esta pessoa tomou durante a simulação" }
        },
        required: ["role", "archetype", "sentiment", "impact"]
      }
    },
    risks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          category: { type: Type.STRING, enum: ["Crítico", "Alto", "Médio"] },
          description: { type: Type.STRING, description: "Descrição crua e realista do risco" },
          mitigation: { type: Type.STRING },
        },
        required: ["id", "category", "description", "mitigation"],
      },
    },
    recommendations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          phase: { type: Type.STRING },
          action: { type: Type.STRING },
        },
        required: ["id", "phase", "action"],
      },
    },
    departmentReadiness: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          department: { type: Type.STRING },
          score: { type: Type.NUMBER },
        },
        required: ["department", "score"],
      },
    },
    businessMetrics: {
      type: Type.OBJECT,
      description: "Métricas de negócio resultantes da implementação do framework",
      properties: {
        efficiencyGain: { type: Type.NUMBER, description: "% de ganho de eficiência do time (ex: 25 significa 25% mais eficiente)" },
        reworkReduction: { type: Type.NUMBER, description: "% de redução de retrabalho/bugs (ex: 40 significa 40% menos retrabalho)" },
        processAgility: { type: Type.NUMBER, description: "% de melhoria na agilidade dos processos (ex: 30 significa 30% mais ágil)" },
        timeToMarket: { type: Type.NUMBER, description: "% de redução no tempo de entrega (ex: 20 significa 20% mais rápido)" },
        qualityScore: { type: Type.NUMBER, description: "Índice geral de qualidade (0-100)" }
      },
      required: ["efficiencyGain", "reworkReduction", "processAgility", "timeToMarket", "qualityScore"]
    },
    companyEvolution: {
      type: Type.OBJECT,
      description: "Evolução do estado da empresa durante a implementação",
      properties: {
        initialTeamSize: { type: Type.NUMBER, description: "Tamanho inicial do time no mês 1" },
        finalTeamSize: { type: Type.NUMBER, description: "Tamanho final do time no último mês" },
        newHires: { type: Type.NUMBER, description: "Número de novas contratações durante o período" },
        turnover: { type: Type.NUMBER, description: "% de turnover (pessoas que saíram)" },
        promotions: { type: Type.NUMBER, description: "Número de promoções internas" },
        capacityGrowth: { type: Type.NUMBER, description: "% de crescimento na capacidade de entrega" },
        breakEvenProjection: { type: Type.NUMBER, description: "Mês estimado para break-even. Se ROI já positivo, use 0. Se nunca, use -1 ou mês futuro estimado além do período." },
        maturityLevelBefore: { type: Type.NUMBER, description: "Nível de maturidade antes (1-5)" },
        maturityLevelAfter: { type: Type.NUMBER, description: "Nível de maturidade depois (1-5)" },
        culturalShift: { type: Type.STRING, enum: ["RESISTENTE", "NEUTRO", "FAVORÁVEL", "ENTUSIASTA"], description: "Mudança cultural predominante" }
      },
      required: ["initialTeamSize", "finalTeamSize", "newHires", "turnover", "promotions", "capacityGrowth", "breakEvenProjection", "maturityLevelBefore", "maturityLevelAfter", "culturalShift"]
    },
  },
  required: ["summary", "implementationNarrative", "sentimentBreakdown", "resourceAllocation", "timeline", "keyPersonas", "risks", "recommendations", "departmentReadiness", "businessMetrics", "companyEvolution"],
};

export const runSimulation = async (
  config: SingleSimulationConfig,
  options: { signal?: AbortSignal } = {}
): Promise<SimulationOutput> => {

  try {
    // ===== RAG OTIMIZADO =====
    // Gera contexto RAG baseado na configuração (Self-RAG implícito)
    const ragContext = generateRAGContext(config);
    const ragInjection = injectRAGContext(ragContext);

    // Define category-specific chaos context
    let categoryContext = "";
    switch (config.frameworkCategory) {
      case 'development':
        categoryContext = "FOCO DO CAOS: Resistência técnica forte. Desenvolvedores odeiam burocracia. Problemas com ferramentas legadas. Burnout. Guerras de editor/IDE. 'Isso não escala'.";
        break;
      case 'management':
        categoryContext = "FOCO DO CAOS: Teatro corporativo. Excesso de reuniões. Média gestão com medo de perder poder. Métricas de vaidade. Processo pelo processo. 'Flavor of the month'.";
        break;
      case 'governance':
        categoryContext = "FOCO DO CAOS: Gargalos de aprovação. Shadow IT (burlar regras para entregar). Auditorias falhas. Documentação que ninguém lê. Segurança vs Velocidade.";
        break;
      default: // hybrid
        categoryContext = "FOCO DO CAOS: Conflito de prioridades. Departamentos não se falam. Confusão de papéis. Fadiga de transformação digital. Disputa por orçamento.";
        break;
    }

    // PERSONA ENRICHMENT: Map archetypes to real personas from profiles.json
    const archetypes = config.employeeArchetypes || ['mid_level', 'senior_staff'];
    const simulationSeed = config.experiment?.scenarioSeed ?? commonScenarioSeed(config);
    const runId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const traceRecorder = new TraceRecorder();
    const { team, keyStakeholders, archetypeDistribution } = enrichArchetypesToTeam(
      archetypes,
      config.companySize,
      simulationSeed
    );

    // Generate rich team description for prompt
    const teamDescription = generateTeamDescription(keyStakeholders);
    const teamResistance = calculateTeamResistance(team);

    console.log(`[PersonaEnricher] Team of ${team.length} personas, resistance score: ${teamResistance}%`);
    console.log(`[PersonaEnricher] Key stakeholders:`, keyStakeholders.map(p => `${p.nome} (${p.cargo})`).join(', '));

    // EMPLOYEE BRAIN: simulação offline (zero-LLM) de estresse/humor/burnout por pessoa.
    // team já contém keyStakeholders como prefixo (ver enrichArchetypesToTeam) — cap 30 para
    // manter o custo de simulação baixo e o prompt enxuto.
    const brainSeed = simulationSeed;
    const workPolicy = resolveWorkPolicy(config.workloadPolicy);
    const { brains, emergentEvents: brainEvents } = simulateTeamOffline(
      team.slice(0, 30),
      config.durationMonths || 12,
      brainSeed,
      config.experiment ? month => { const shock = config.experiment!.exogenousSchedule.find(shock => shock.turnId === month); return Math.min(1, Math.max(0, (month <= 2 ? 0.7 : month <= 4 ? 0.5 : 0.35) + (shock?.pressureDelta ?? 0) + incidentContext(shock, workPolicy).pressureDelta)); } : undefined,
      snapshot => {
        const shock = config.experiment?.exogenousSchedule.find(item => item.turnId === snapshot.turnId);
        traceRecorder.recordTurn(runId, snapshot.turnId, snapshot.before, snapshot.after, [
          ...snapshot.events.map(event => ({ personaId: event.personaId, type: event.tipo, text: event.narrativa, kind: event.tipo === 'pedir_ajuda' ? 'collaboration' as const : 'decision' as const })),
          ...(shock ? snapshot.before.map(person => ({ personaId: person.personaId, type: 'environment-shock', text: JSON.stringify(shock), kind: 'exogenous' as const })) : [])
        ]);
        traceRecorder.attachWorkTurn(simulateWorkBlock(traceRecorder.snapshot().filter(trace => trace.turnId === snapshot.turnId), { seed: simulationSeed, shock, policy: workPolicy }));
      },
      (personaId, turnId) => addressedRandom(simulationSeed, personaId, turnId, `policy:${config.experiment?.conditionId ?? 'standard'}`)
    );
    const brainsAtivos = brains.filter(b => b.status === 'ativo').length;
    const brainsAfastados = brains.filter(b => b.status === 'licenca' || b.status === 'burnout').length;
    const brainsDesistentes = brains.filter(b => b.status === 'pediu_demissao').length;
    const brainEventsSummary = brainEvents.length > 0
      ? brainEvents.slice(0, 12).map(e => `- Mês ${e.mes}: ${e.nome} — ${e.narrativa}`).join('\n')
      : 'nenhum evento crítico previsto';

    const isHighDensity = archetypes.length > 5;

    // Realism Factors Calculation
    const realismContext = `
      FATORES DE REALISMO (hipóteses explícitas, não garantia estatística):
      - Dívida Técnica: ${config.techDebtLevel.toUpperCase()} ${config.techDebtLevel === 'critical' ? '(Sistemas quase colapsando, qualquer mudança quebra tudo)' : ''}
      - Velocidade Operacional: ${config.operationalVelocity.toUpperCase()}
      - Trauma Anterior: ${config.previousFailures ? 'SIM (Funcionários céticos, "lá vem outra bala de prata")' : 'NÃO'}
      - Cenário Específico: ${config.scenarioContext}
    `;

    // Economic Profile Context for accurate cost simulation
    const costProfile = getCostProfile((config as any).economicProfileId);
    const macroScenario = getEconomicScenario(config.economicScenarioId, simulationSeed);
    const economicContext = costProfile ? `
      CONTEXTO ECONÔMICO (${costProfile.name}):
      - Região: ${costProfile.region} | Moeda: ${costProfile.currency}
      - Custo Dev/Dia: ${costProfile.currency} ${costProfile.constants.DEV_DAY_COST}
      - Custo Incidente: ${costProfile.currency} ${costProfile.constants.INCIDENT_COST}
      - Valor por Feature: ${costProfile.currency} ${costProfile.constants.FEATURE_VALUE}
      - ${costProfile.description}
      - Cenário macro: ${macroScenario.label}; demanda x${macroScenario.demandMultiplier}, trabalho x${macroScenario.laborCostMultiplier}, incidentes x${macroScenario.incidentMultiplier}.
      - Incerteza: ${macroScenario.uncertainty}
      
      INSTRUÇÃO: Use esses valores como referência para cálculos de ROI e custos.
    ` : '';

    // FRAMEWORK-ORGANIZATION FIT - Avalia compatibilidade
    const frameworkFit = calculateFrameworkFit(
      config.frameworkName,
      config.companySize,
      config.budgetLevel,
      config.frameworkCategory,
      addressedRandom(simulationSeed, 'environment', 0, 'framework-fit')
    );
    const fitContext = `
      ANÁLISE DE FIT FRAMEWORK-ORGANIZAÇÃO:
      ${frameworkFit.reason}
      Nível de Compatibilidade: ${frameworkFit.fitLevel}
      
      ${frameworkFit.fitLevel === 'EXCELENTE' ? 'IMPACTO: Framework ideal para este contexto. Considere resultados acima da média.' : ''}
      ${frameworkFit.fitLevel === 'PÉSSIMO' ? 'IMPACTO: Framework muito pesado. Espere overhead, custos excessivos e frustração.' : ''}
      ${frameworkFit.fitLevel === 'RUIM' ? 'IMPACTO: Desafios de adoção esperados. ROI provavelmente negativo.' : ''}
    `;


    // Prompt otimizado com RAG dinâmico
    const prompt = `
      Atue como uma Engine de Realidade Estendida (XRE) e CFO Virtual Multidimensional.
      
      OBJETIVO:
      Simular a implementação do framework "${config.frameworkName}" com hipóteses rastreáveis, incerteza explícita e coerência causal, utilizando os dados de RAG fornecidos.
      
      DADOS DE ENTRADA:
      - Framework: ${config.frameworkText.substring(0, 5000)}...
      - Categoria: ${config.frameworkCategory.toUpperCase()}
      - Tamanho: ${config.companySize} funcionários.
      - Setor: ${config.sector}.
      - Orçamento: ${config.budgetLevel}.
      
      ECOSSISTEMA HUMANO (Perfis sintéticos do catálogo):
      Resistência Cultural Calculada: ${teamResistance}%
      ${teamDescription}
      
      INSTRUÇÃO DE CONTEXTO:
      Caso o texto do "Framework" acima seja breve ou genérico, você DEVE utilizar seu vasto conhecimento interno sobre o framework citado (rituais, papéis, artefatos, métricas) para preencher as lacunas. Não invente frameworks inexistentes, mas expanda os conceitos padrão de mercado se necessário.

      ${ragInjection}
      
      MODIFICADORES DE CENÁRIO:
      ${categoryContext}
      ${realismContext}
      ${economicContext}
      ${fitContext}

      EVENTOS HUMANOS PREVISTOS PELO MODELO DE EQUIPE (trate como fatos da simulação):
      ${brainEventsSummary}
      Resumo final do modelo de equipe: ${brainsAtivos} ativos, ${brainsAfastados} afastados (licença/burnout), ${brainsDesistentes} pediram demissão.

      ${isHighDensity ? "ALERTA DE ALTA DENSIDADE: Muitos arquétipos selecionados. Simule conflitos interdepartamentais." : ""}

      PROCESSAMENTO MULTI-VERTENTE (SIMULAÇÃO PARALELA):
      Obrigatório analisar a simulação sob 3 vertentes distintas antes de consolidar:
      1. VERTENTE FINANCEIRA (CFO): Foco em custo (OpEx), ROI e desperdício. Aplique a lógica de Custo da Não-Qualidade.
      2. VERTENTE TÉCNICA (CTO): Foco em débito técnico, complexidade e resistência dos devs. Aplique a lógica da Curva J.
      3. VERTENTE CULTURAL (RH): Foco em burnout, política interna e "Rádio Peão". Use os perfis de exemplo para gerar personas realistas.
      
      PROTOCOLO DE REALISMO RESPONSIVO:
      1. Se o cenário for implausível (ex: Scrum em fábrica de 100 anos sem computadores), o 'scenarioValidity' deve ser baixo (<40).
      2. ⚠️ CENÁRIO CRÍTICO (Dívida ALTA/CRÍTICA + Trauma): ROI inicial negativo significativo, recuperação lenta, incidentes frequentes.
      3. ✅ CENÁRIO FAVORÁVEL (Dívida BAIXA, sem trauma): ROI pode ser positivo já nos primeiros meses, adoção rápida.
      4. 📊 CENÁRIO TÍPICO: ROI moderado, podendo ser ligeiramente negativo ou positivo.
      5. O ROI FINAL DEVE REFLETIR AS CONDIÇÕES DE ENTRADA. Não force resultados negativos sempre.
      
      STAKEHOLDERS E PERSONAS:
      No array 'keyPersonas', você DEVE identificar explicitamente quem são os Stakeholders Críticos.
      Para estes personas, adicione o texto " / STAKEHOLDER" ao final do campo 'role'. 
      Use nomes e traços psicológicos baseados nos "EXEMPLOS DE PERFIS SINTÉTICOS" fornecidos acima para dar vida aos personagens.
      
      SAÍDA OBRIGATÓRIA:
      - JSON estrito conforme o schema.
      - Timeline DEVE conter exatamente ${config.durationMonths || 12} meses.
      - Personas reagindo especificamente ao cenário (Ex: 'Wagner Vieira' bloqueando orçamento devido a ROI baixo).
      - Linguagem: PORTUGUÊS BRASIL.
      
      Retorne APENAS o JSON conforme o schema.
    `;

    const providerResponse = await generateProviderContent({
      task: 'simulation',
      prompt,
      responseSchema: SIMULATION_SCHEMA,
      temperature: config.temperature ?? 0.6,
      seed: config.seed,
      modelPreference: config.modelPreference,
      agentPersona: config.agentPersona,
      signal: options.signal
    });

    const jsonText = providerResponse.content;
    if (!jsonText) throw new Error("Falha crítica na engine de simulação.");

    // Sanitization to prevent JSON parse errors if model adds markdown blocks
    // Note: The regex below is safe.
    const cleanJson = jsonText.replace(/```json\n?|\n?```/g, '').trim();
    const result = JSON.parse(cleanJson);

    // Safety: Validate result structure before processing
    if (!result) {
      throw new Error("Gemini returned empty result");
    }
    const measurements = normalizeStandardMeasurements(result, config, simulationSeed);
    const degraded = providerResponse.degraded || measurements.missingFields.length > 0;
    for (const key of ['sentimentBreakdown', 'resourceAllocation', 'departmentReadiness', 'risks', 'recommendations']) if (!Array.isArray(result[key])) result[key] = [];
    if (typeof result.implementationNarrative !== 'string') result.implementationNarrative = 'Narrative unavailable.';

    const finalResult = {
      ...result,
      manifest: await createClientRunManifest(runId, { ...config, seed: simulationSeed }, team.slice(0, 30), { ...providerResponse, degraded }, startedAt),
      personaTraces: traceRecorder.snapshot(),
      individualEvaluations: evaluateIndividualMetrics(traceRecorder.snapshot()),
      timeUnit: 'month',
      timeline: measurements.timeline,
      summary: measurements.summary,
      frameworkName: config.frameworkName,
      execution: {
        mode: degraded ? 'degraded' : 'live',
        provider: providerResponse.provider,
        model: providerResponse.model,
        attempts: providerResponse.attempts,
        seed: simulationSeed,
        warning: measurements.missingFields.length ? measurements.missingFields.join(' ') : undefined
      }
    };

    finalResult.keyPersonas = keyStakeholders.map(profile => {
      const brain = brains.find(person => person.personaId === profile.id);
      return { id: profile.id, name: profile.nome, role: profile.cargo, archetype: 'synthetic profile',
        sentiment: brain ? (brain.humor + 100) / 2 : null,
        impact: brain?.reflexao || brain?.decisoes.join(' · ') || 'Sem ação individual documentada.',
        area: profile.area, motivation: profile.motivacao, cognitiveBias: profile.vies_cognitivo,
        communicationStyle: profile.estilo_comunicacao, challenge: profile.desafio_atual,
        preferredFramework: profile.framework_preferido, status: brain?.status,
        stress: brain?.estresse, energy: brain?.energia, engagement: brain?.engajamento };
    });
    finalResult.emergentEvents = brainEvents.map(e => ({ month: e.mes, persona: e.nome, type: e.tipo, event: e.narrativa }));

    return finalResult as SimulationOutput;

  } catch (error: any) {
    console.error("❌ Simulation Engine Critical Failure:", error);
    console.error("Error Name:", error?.name);
    console.error("Error Message:", error?.message);

    if (options.signal?.aborted) throw error;

    // Keep the UI recoverable, but label the fixture honestly so it cannot be
    // mistaken for a live model result.
    console.warn("⚠️ Provider gateway unavailable. Returning an explicit degraded fixture.");
    return {
      ...MOCK_SIMULATION_RESULT,
      frameworkName: config.frameworkName,
      execution: {
        mode: 'fixture',
        provider: 'none',
        model: 'local-fixture',
        attempts: 0,
        seed: config.seed,
        warning: error instanceof Error
          ? `${error.message}${error instanceof Error && 'failureCodes' in error && Array.isArray(error.failureCodes) && error.failureCodes.length > 0 ? ` [${error.failureCodes.join(', ')}]` : ''}`
          : 'Provider gateway unavailable.'
      }
    };
  }
};
