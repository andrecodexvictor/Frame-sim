/**
 * "Pequeno cérebro" de cada funcionário simulado.
 *
 * Filosofia: toda a dinâmica é determinística com RNG semeado; o LLM (fora deste
 * módulo) só dá voz ao resultado. Padrão Generative Agents (Stanford) reduzido:
 * memory stream compacto + reflexão + decisões.
 *
 * Módulo PURO: zero imports (nem node builtins) — só TS/JS puro, para poder ser
 * importado tanto pelo backend RAG quanto pelo frontend Vite.
 */

// ===== TIPOS =====

export interface BrainProfileInput {
    id: string;
    nome: string;
    cargo?: string;
    senioridade?: string;
    gestao_estresse?: string;
    abordagem_trabalho?: string;
    opiniao_agil?: string;
    estilo_comunicacao?: string;
    vies_cognitivo?: string;
}

export interface MemoryEntry {
    turno: number;
    evento: string;
    valencia: number; // -10..+10
}

export type EmployeeStatus = 'ativo' | 'licenca' | 'burnout' | 'pediu_demissao';

export interface EmployeeBrainState {
    personaId: string;
    nome: string;
    cargo: string;
    estresse: number; // 0-100
    humor: number; // -100..100
    energia: number; // 0-100
    engajamento: number; // 0-100
    status: EmployeeStatus;
    turnosEstresseAlto: number;
    turnosAfastado: number;
    resiliencia: number;
    adaptabilidade: number;
    influencia: number;
    workaholic: boolean;
    viesCognitivo: string;
    memoria: MemoryEntry[]; // máx 12, FIFO
    reflexao: string;
    decisoes: string[];
}

export interface TurnContext {
    turno: number;
    pressaoBase: number; // 0-1
    impactoPessoal: number; // -10..+10
    moralGlobal: number; // 0-100
    eventoTurno?: string;
}

export interface DecisionResult {
    tipo: string;
    narrativa: string;
    efeitos: {
        moralGlobal?: number;
        confianca?: number;
        contagio?: { alvos: number; humorDelta: number; estresseDelta: number };
    };
}

export interface AggregateResult {
    moral: number;
    velocidadeMod: number;
    sentimentPorPersona: Record<string, number>;
    ativos: number;
    afastados: number;
    desistentes: number;
}

export interface EmergentEvent {
    mes: number;
    personaId: string;
    nome: string;
    tipo: string;
    narrativa: string;
}

// ===== UTIL =====

/** Clampa v entre min e max. */
export function clamp(v: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, v));
}

function clamp01(v: number): number {
    return clamp(v, 0, 1);
}

/** Hash djb2 de uma string para uma seed numérica determinística. */
export function hashString(s: string): number {
    let hash = 5381;
    for (let i = 0; i < s.length; i++) {
        hash = ((hash << 5) + hash) + s.charCodeAt(i);
        hash = hash | 0;
    }
    return hash >>> 0;
}

/** PRNG mulberry32 — determinístico a partir de uma seed numérica. */
export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** minúsculo + sem acentos, para comparação de strings dos perfis. */
function norm(s?: string): string {
    return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// ===== TRAITS =====

interface DerivedTraits {
    resiliencia: number;
    adaptabilidade: number;
    influencia: number;
    humorInicial: number;
    engajamentoInicial: number;
    workaholic: boolean;
}

/** Converte campos de texto do perfil em traços numéricos (0-100) determinísticos. */
export function deriveTraits(profile: BrainProfileInput): DerivedTraits {
    const estresseTxt = norm(profile.gestao_estresse);
    const workaholic = estresseTxt.includes('workaholic');

    let resiliencia = 50;
    if (estresseTxt.includes('thrives no caos')) resiliencia = 85;
    else if (estresseTxt.includes('resiliente')) resiliencia = 70;
    else if (workaholic) resiliencia = 60;
    else if (estresseTxt.includes('necessita ambiente estavel')) resiliencia = 35;

    // jitter ±8 semeado pelo id, para variar entre personas com o mesmo texto
    const jitterRng = mulberry32(hashString(profile.id + ':resiliencia'));
    const jitter = Math.round((jitterRng() * 2 - 1) * 8);
    resiliencia = clamp(resiliencia + jitter, 0, 100);

    const abordagemOpiniao = `${norm(profile.abordagem_trabalho)} ${norm(profile.opiniao_agil)}`;
    let adaptabilidade = 50;
    if (abordagemOpiniao.includes('inovador') || abordagemOpiniao.includes('entusiasta')) adaptabilidade = 80;
    else if (abordagemOpiniao.includes('pragmatico')) adaptabilidade = 60;
    else if (abordagemOpiniao.includes('indiferente')) adaptabilidade = 50;
    else if (abordagemOpiniao.includes('cetico')) adaptabilidade = 38;
    else if (abordagemOpiniao.includes('conservador') || abordagemOpiniao.includes('resistente')) adaptabilidade = 30;

    const cargoSenioridade = `${norm(profile.cargo)} ${norm(profile.senioridade)}`;
    let influencia = 50;
    if (cargoSenioridade.includes('c-level') || cargoSenioridade.includes('clevel')) influencia = 85;
    else if (cargoSenioridade.includes('head')) influencia = 80;
    else if (cargoSenioridade.includes('lead')) influencia = 75;
    else if (cargoSenioridade.includes('senior')) influencia = 70;
    else if (cargoSenioridade.includes('pleno')) influencia = 55;
    else if (cargoSenioridade.includes('junior')) influencia = 40;

    const comunicacao = norm(profile.estilo_comunicacao);
    if (comunicacao.includes('assertiv') || comunicacao.includes('direta') || comunicacao.includes('direto')) {
        influencia = clamp(influencia + 10, 0, 95);
    }

    const opiniao = norm(profile.opiniao_agil);
    let humorInicial = 0;
    if (opiniao.includes('entusiasta')) humorInicial = 30;
    else if (opiniao.includes('indiferente')) humorInicial = 0;
    else if (opiniao.includes('cetico')) humorInicial = -25;

    const engajamentoInicial = clamp(50 + humorInicial / 2, 0, 100);

    return { resiliencia, adaptabilidade, influencia, humorInicial, engajamentoInicial, workaholic };
}

/** Deriva o estado inicial do cérebro de um funcionário a partir do perfil. */
export function deriveInitialBrain(profile: BrainProfileInput, seed?: number): EmployeeBrainState {
    const traits = deriveTraits(profile);
    const rng = mulberry32((seed ?? 0) ^ hashString(profile.id));
    const estresse = Math.round(20 + rng() * 15); // 20-35
    const energia = Math.round(70 + rng() * 20); // 70-90

    return {
        personaId: profile.id,
        nome: profile.nome,
        cargo: profile.cargo ?? '',
        estresse,
        humor: traits.humorInicial,
        energia,
        engajamento: traits.engajamentoInicial,
        status: 'ativo',
        turnosEstresseAlto: 0,
        turnosAfastado: 0,
        resiliencia: traits.resiliencia,
        adaptabilidade: traits.adaptabilidade,
        influencia: traits.influencia,
        workaholic: traits.workaholic,
        viesCognitivo: profile.vies_cognitivo ?? '',
        memoria: [],
        reflexao: '',
        decisoes: [],
    };
}

// ===== UPDATE =====

/** Avança o estado de um turno (pressão, humor, energia, engajamento, memória). Pura/imutável. */
export function updateBrain(brain: EmployeeBrainState, ctx: TurnContext): EmployeeBrainState {
    // Coerção de entradas externas: impacto_moral vem do JSON do LLM e pode chegar
    // ausente/não-numérico — sem isso um único NaN envenena humor→moral para sempre.
    const impactoPessoal = clamp(Number(ctx.impactoPessoal) || 0, -10, 10);
    const moralGlobal = clamp(Number(ctx.moralGlobal) || 50, 0, 100);
    const pressaoBase = clamp(Number(ctx.pressaoBase) || 0, 0, 1);

    if (brain.status === 'licenca') {
        const restante = brain.turnosAfastado - 1;
        if (restante <= 0) {
            // Retorno de afastamento: recupera também humor e zera o histórico de
            // estresse alto — senão a pessoa volta batendo o gatilho de demissão no
            // mesmo turno e a licença é inócua.
            return {
                ...brain,
                status: 'ativo',
                estresse: 45,
                energia: 60,
                humor: clamp(brain.humor + 40, -100, 100),
                turnosEstresseAlto: 0,
                turnosAfastado: 0,
            };
        }
        // Durante a licença o humor decai lentamente rumo ao neutro.
        return { ...brain, turnosAfastado: restante, humor: clamp(brain.humor + 10, -100, 100) };
    }
    if (brain.status === 'burnout' || brain.status === 'pediu_demissao') {
        return brain; // status terminal nesta simulação
    }

    const pressaoEfetiva = pressaoBase * (100 - brain.resiliencia) / 100;

    let estresse = brain.estresse
        + pressaoEfetiva * 22
        - (brain.energia > 60 ? 4 : brain.energia > 30 ? 2 : 0)
        + (brain.workaholic ? 2 : 0);
    estresse = clamp(estresse, 0, 100);

    let humor = brain.humor + impactoPessoal * 2 + (moralGlobal - 50) * 0.06;
    humor = clamp(humor, -100, 100);

    let perda = estresse > 70 ? 8 : 3;
    if (brain.workaholic) perda *= 1.5;
    // Recuperação passiva quando o estresse está sob controle — sem ela, times de
    // humor neutro drenam energia até burnout por exaustão em horizontes >18 meses.
    const recuperacaoPassiva = estresse < 40 ? 2 : 0;
    let energia = brain.energia - perda + (humor > 30 ? 4 : 0) + recuperacaoPassiva;
    energia = clamp(energia, 0, 100);

    const alvoEngajamento = (humor + 100) / 2;
    const engajamento = clamp(brain.engajamento + (alvoEngajamento - brain.engajamento) * 0.15, 0, 100);

    const evento = ctx.eventoTurno ?? (pressaoEfetiva > 0.6 ? 'pressão alta' : 'turno tranquilo');
    const memoria = [...brain.memoria, { turno: ctx.turno, evento, valencia: impactoPessoal }];
    if (memoria.length > 12) memoria.shift();

    const turnosEstresseAlto = estresse > 80 ? brain.turnosEstresseAlto + 1 : 0;

    return { ...brain, estresse, humor, energia, engajamento, memoria, turnosEstresseAlto };
}

// ===== DECISÕES =====

/**
 * Avalia gatilhos de decisão para o turno. No máximo 1 decisão GRAVE é aplicada
 * por turno (avaliadas em ordem — a primeira cujo gatilho e sorteio dispararem
 * "ganha"). confronto_lideranca é avaliado ANTES de fofoca porque seu gatilho é
 * um subconjunto estrito do dela — na ordem inversa nunca dispararia. Decisões
 * não-graves (apoiar_mudanca, pedir_ajuda) são independentes e podem coexistir
 * com 1 grave.
 */
export function evaluateDecisions(
    brain: EmployeeBrainState,
    ctx: TurnContext,
    rng: () => number
): { brain: EmployeeBrainState; decisions: DecisionResult[] } {
    if (brain.status !== 'ativo') return { brain, decisions: [] };

    let b = brain;
    const decisions: DecisionResult[] = [];

    if (b.turnosEstresseAlto >= 2 && b.humor < -40 && rng() < 0.35) {
        const narrativa = `${b.nome} (${b.cargo}) pede demissão após semanas de estresse insustentável.`;
        b = { ...b, status: 'pediu_demissao', decisoes: [...b.decisoes, narrativa] };
        decisions.push({ tipo: 'pedido_demissao', narrativa, efeitos: { moralGlobal: -8 } });
    } else if (b.estresse > 90 || b.energia < 15) {
        const narrativa = `${b.nome} entra em burnout e precisa se afastar temporariamente.`;
        b = { ...b, status: 'licenca', turnosAfastado: 2, decisoes: [...b.decisoes, narrativa] };
        decisions.push({ tipo: 'burnout', narrativa, efeitos: {} });
    } else if (b.humor < -30 && b.adaptabilidade < 45) {
        const narrativa = `${b.nome} passa a fazer resistência passiva, entregando o mínimo.`;
        b = { ...b, engajamento: clamp(b.engajamento - 10, 0, 100), decisoes: [...b.decisoes, narrativa] };
        decisions.push({ tipo: 'resistencia_passiva', narrativa, efeitos: {} });
    } else if (b.humor < -50 && b.influencia > 70) {
        const narrativa = `${b.nome} confronta a liderança abertamente sobre as condições de trabalho.`;
        b = { ...b, decisoes: [...b.decisoes, narrativa] };
        decisions.push({ tipo: 'confronto_lideranca', narrativa, efeitos: { confianca: -5 } });
    } else if (b.humor < -40 && b.influencia > 60) {
        const narrativa = `${b.nome} espalha insatisfação entre os colegas.`;
        b = { ...b, decisoes: [...b.decisoes, narrativa] };
        decisions.push({
            tipo: 'fofoca',
            narrativa,
            efeitos: { contagio: { alvos: 3, humorDelta: -3, estresseDelta: 4 } },
        });
    }

    if (b.humor > 40 && b.engajamento > 65) {
        const narrativa = `${b.nome} se torna um defensor vocal da mudança, incentivando os colegas.`;
        b = { ...b, decisoes: [...b.decisoes, narrativa] };
        decisions.push({
            tipo: 'apoiar_mudanca',
            narrativa,
            efeitos: { moralGlobal: 3, contagio: { alvos: 2, humorDelta: 2, estresseDelta: 0 } },
        });
    }
    if (b.estresse >= 60 && b.estresse <= 80 && b.humor > 0) {
        const narrativa = `${b.nome} pede ajuda para lidar com a carga de trabalho.`;
        b = { ...b, estresse: clamp(b.estresse - 10, 0, 100), decisoes: [...b.decisoes, narrativa] };
        decisions.push({ tipo: 'pedir_ajuda', narrativa, efeitos: {} });
    }

    return { brain: b, decisions };
}

// ===== CONTÁGIO =====

/** Aplica contágio de humor/estresse a N alvos ativos sorteados (nunca a source). Retorna novo array. */
export function applyContagion(
    brains: EmployeeBrainState[],
    sourceId: string,
    contagio: { alvos: number; humorDelta: number; estresseDelta: number },
    rng: () => number
): EmployeeBrainState[] {
    const eligible = brains
        .map((b, i) => i)
        .filter((i) => brains[i].status === 'ativo' && brains[i].personaId !== sourceId);

    // Fisher-Yates semeado para escolher os alvos determinísticamente
    for (let i = eligible.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
    }
    const targets = new Set(eligible.slice(0, Math.min(contagio.alvos, eligible.length)));

    return brains.map((b, i) => {
        if (!targets.has(i)) return b;
        return {
            ...b,
            humor: clamp(b.humor + contagio.humorDelta, -100, 100),
            estresse: clamp(b.estresse + contagio.estresseDelta, 0, 100),
        };
    });
}

// ===== REFLEXÃO =====

/** Reflexão determinística a partir das 3 memórias de maior |valência|. */
export function reflect(brain: EmployeeBrainState): EmployeeBrainState {
    if (brain.memoria.length === 0) {
        return { ...brain, reflexao: `${brain.nome} não tem memórias recentes marcantes.` };
    }
    const top = [...brain.memoria]
        .sort((a, b) => Math.abs(b.valencia) - Math.abs(a.valencia))
        .slice(0, 3);
    const partes = top.map((m) => `"${m.evento}" (impacto ${m.valencia})`).join(', ');
    return { ...brain, reflexao: `${brain.nome} reflete sobre: ${partes}.` };
}

// ===== AGREGAÇÃO =====

/** Agrega o time inteiro em métricas de moral/velocidade/sentimento. */
export function aggregate(brains: EmployeeBrainState[]): AggregateResult {
    const total = brains.length;
    const sentimentPorPersona: Record<string, number> = {};
    for (const b of brains) {
        sentimentPorPersona[b.personaId] = Math.round((b.humor + 100) / 2);
    }
    if (total === 0) {
        return { moral: 50, velocidadeMod: 1, sentimentPorPersona, ativos: 0, afastados: 0, desistentes: 0 };
    }

    const desistentesArr = brains.filter((b) => b.status === 'pediu_demissao');
    const afastadosArr = brains.filter((b) => b.status === 'licenca' || b.status === 'burnout');
    const ativosArr = brains.filter((b) => b.status === 'ativo');

    const naoDesistentes = brains.filter((b) => b.status !== 'pediu_demissao');
    const moral = naoDesistentes.length > 0
        ? naoDesistentes.reduce((s, b) => s + (b.humor + 100) / 2, 0) / naoDesistentes.length
        : 50;

    const engajamentoMedioAtivos = ativosArr.length > 0
        ? ativosArr.reduce((s, b) => s + b.engajamento, 0) / ativosArr.length
        : 0;

    // velocidadeMod: penaliza 0.5 por fração de baixas (afastados+desistentes) e
    // 0.3 pela falta de engajamento médio dos ativos; clampado em [0,1].
    const velocidadeMod = clamp01(
        1
        - 0.5 * (afastadosArr.length + desistentesArr.length) / total
        - 0.3 * (1 - engajamentoMedioAtivos / 100)
    );

    return {
        moral,
        velocidadeMod,
        sentimentPorPersona,
        ativos: ativosArr.length,
        afastados: afastadosArr.length,
        desistentes: desistentesArr.length,
    };
}

// ===== SIMULAÇÃO OFFLINE (SEM LLM) =====

/**
 * Roda a equipe inteira por N meses sem nenhuma chamada LLM (modo "standard").
 * 1 turno = 1 mês, impactoPessoal=0 (sem evento pessoal dirigido), pressão default
 * por mês: 1-2 → 0.7, 3-4 → 0.5, 5+ → 0.35. Reflexão a cada 3 meses.
 */
export function simulateTeamOffline(
    profiles: BrainProfileInput[],
    meses: number,
    seedBase: number,
    pressaoPorMes?: (mes: number) => number
): { brains: EmployeeBrainState[]; emergentEvents: EmergentEvent[] } {
    const brains = profiles.map((p) => deriveInitialBrain(p, seedBase));
    const rng = mulberry32(seedBase);
    const emergentEvents: EmergentEvent[] = [];
    let moralGlobal = 50;

    const pressaoFn = pressaoPorMes ?? ((mes: number) => (mes <= 2 ? 0.7 : mes <= 4 ? 0.5 : 0.35));

    for (let mes = 1; mes <= meses; mes++) {
        const pressaoBase = pressaoFn(mes);
        let moralDelta = 0;

        for (let i = 0; i < brains.length; i++) {
            const ctx: TurnContext = { turno: mes, pressaoBase, impactoPessoal: 0, moralGlobal };
            const updated = updateBrain(brains[i], ctx);
            const { brain: decided, decisions } = evaluateDecisions(updated, ctx, rng);
            brains[i] = decided;

            for (const d of decisions) {
                emergentEvents.push({ mes, personaId: decided.personaId, nome: decided.nome, tipo: d.tipo, narrativa: d.narrativa });
                if (d.efeitos.moralGlobal) moralDelta += d.efeitos.moralGlobal;
                if (d.efeitos.contagio) {
                    const novo = applyContagion(brains, decided.personaId, d.efeitos.contagio, rng);
                    for (let k = 0; k < brains.length; k++) brains[k] = novo[k];
                }
            }
        }

        moralGlobal = clamp(aggregate(brains).moral + moralDelta, 0, 100);

        if (mes % 3 === 0) {
            for (let i = 0; i < brains.length; i++) brains[i] = reflect(brains[i]);
        }
    }

    return { brains, emergentEvents };
}
