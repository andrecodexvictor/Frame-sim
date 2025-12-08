/**
 * Persona Enricher Service
 * Maps generic archetypes to real, detailed personas from profiles.json
 * Used for Monte Carlo simulation with personality-driven variation
 */

import profiles from '../data/profiles_compact.json';

// Compact profile interface (subset of full profile)
export interface CompactPersona {
    id: string;
    nome: string;
    cargo: string;
    area: string;
    estilo_comunicacao: string;
    abordagem_trabalho: string;
    gestao_conflitos: string;
    gestao_estresse: string;
    opiniao_agil: string;
    desafio_atual: string;
    motivacao: string;
    framework_preferido: string;
    vies_cognitivo: string;
}

// Archetype to cargo/psychology mapping
const ARCHETYPE_MAPPING: Record<string, {
    cargos: string[];
    psicologia?: Record<string, string[]>;
}> = {
    // Level-based archetypes
    'new_grad': {
        cargos: ['Estagiário'],
        psicologia: { 'Abordagem ao Trabalho': ['Foco em velocidade', 'Inovador/experimental'] }
    },
    'mid_level': {
        cargos: ['Pleno'],
        psicologia: { 'Relação com Processos': ['Pragmático híbrido', 'Seguidor rigoroso'] }
    },
    'senior_staff': {
        cargos: ['Sênior'],
        psicologia: { 'Abordagem ao Trabalho': ['Foco em qualidade', 'Metódico e planejador'] }
    },

    // Role-based archetypes
    'cto': {
        cargos: ['CTO', 'VP de Engenharia', 'Diretor', 'Tech Lead'],
        psicologia: { 'Liderança e Influência': ['Visionário', 'Líder nato'] }
    },
    'ceo': { cargos: ['CEO', 'Fundador', 'Diretor Executivo', 'Gerente'] },
    'cfo': { cargos: ['CFO', 'Diretor Financeiro', 'Controller'] },
    'cmo': { cargos: ['CMO', 'Head de Marketing', 'Marketing'] },
    'coo': { cargos: ['COO', 'Diretor de Operações', 'Operações'] },

    // Personality-based archetypes
    'visionary': {
        cargos: [],
        psicologia: {
            'Liderança e Influência': ['Visionário'],
            'Abordagem ao Trabalho': ['Inovador/experimental']
        }
    },
    'skeptic': {
        cargos: [],
        psicologia: {
            'Abordagem ao Trabalho': ['Conservador/tradicional'],
            'Relação com Tecnologia': ['Cético com novidades']
        }
    },
    'bureaucrat': {
        cargos: ['Gerente', 'Coordenador'],
        psicologia: { 'Relação com Processos': ['Seguidor rigoroso', 'Criador de processos'] }
    },
    'legacy_keeper': {
        cargos: [],
        psicologia: {
            'Abordagem ao Trabalho': ['Conservador/tradicional'],
            'Relação com Tecnologia': ['Enterprise-focused']
        }
    },
    'overworked': {
        cargos: [],
        psicologia: { 'Gestão de Estresse': ['Workaholic', 'Resiliente sob pressão'] }
    },
    'political_player': {
        cargos: ['Gerente', 'Diretor'],
        psicologia: { 'Gestão de Conflitos': ['Tomador de lados'] }
    },
    'hr_guardian': {
        cargos: ['RH', 'People', 'Talent', 'Support'],
        psicologia: { 'Gestão de Conflitos': ['Mediador natural'] }
    },
    'sales_shark': { cargos: ['Vendas', 'Sales', 'Comercial'] },
    'data_driven': {
        cargos: ['Data', 'Analytics', 'BI'],
        psicologia: { 'Abordagem ao Trabalho': ['Metódico e planejador'] }
    }
};

// Cognitive biases for personality variation
const COGNITIVE_BIASES = [
    'Viés de Confirmação: Favorece informações que confirmam suas crenças.',
    'Viés do Status Quo: Prefere manter as coisas como estão.',
    'Aversão à Perda: Medo de perder supera desejo de ganhar.',
    'Efeito Dunning-Kruger: Superestima próprias habilidades.',
    'Viés de Ancoragem: Depende demais da primeira informação recebida.',
    'Viés de Autoridade: Aceita opiniões de figuras de autoridade sem questionar.'
];

/**
 * Shuffles array using Fisher-Yates algorithm
 */
function shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/**
 * Gets a random cognitive bias
 */
export function getRandomBias(): string {
    return COGNITIVE_BIASES[Math.floor(Math.random() * COGNITIVE_BIASES.length)];
}

/**
 * Finds real personas that match a given archetype
 */
export function getPersonasForArchetype(
    archetype: string,
    count: number = 2
): CompactPersona[] {
    const mapping = ARCHETYPE_MAPPING[archetype];

    if (!mapping) {
        console.warn(`Unknown archetype: ${archetype}, using random profiles`);
        return shuffle(profiles as CompactPersona[]).slice(0, count);
    }

    // Filter profiles by cargo
    let matches = (profiles as CompactPersona[]).filter(p => {
        if (mapping.cargos.length === 0) return true;
        return mapping.cargos.some(cargo =>
            p.cargo?.toLowerCase().includes(cargo.toLowerCase()) ||
            p.area?.toLowerCase().includes(cargo.toLowerCase())
        );
    });

    // If no matches, fall back to random selection
    if (matches.length === 0) {
        console.warn(`No matches for archetype: ${archetype}, using random`);
        matches = profiles as CompactPersona[];
    }

    return shuffle(matches).slice(0, count);
}

/**
 * Enriches a list of archetypes with real personas
 * Selected archetypes become KEY STAKEHOLDERS (1-2 each)
 * Rest of team is filled with REALISTIC DISTRIBUTION
 */
export function enrichArchetypesToTeam(
    archetypes: string[],
    companySize: number = 50
): {
    team: CompactPersona[];
    keyStakeholders: CompactPersona[];
    archetypeDistribution: Record<string, number>;
} {
    const keyStakeholders: CompactPersona[] = [];
    const team: CompactPersona[] = [];
    const archetypeDistribution: Record<string, number> = {};

    // Step 1: Selected archetypes become KEY STAKEHOLDERS (1-2 each)
    for (const archetype of archetypes) {
        const count = archetype.includes('ceo') || archetype.includes('cto') ? 1 : 2;
        const personas = getPersonasForArchetype(archetype, count);
        keyStakeholders.push(...personas);
        archetypeDistribution[archetype] = personas.length;
    }

    // Step 2: Calculate REALISTIC TEAM DISTRIBUTION
    const distribution = getRealisticDistribution(companySize);

    // Step 3: Fill team with realistic mix (excluding key stakeholders)
    const usedIds = new Set(keyStakeholders.map(p => p.id));

    for (const [role, count] of Object.entries(distribution)) {
        const rolePersonas = getPersonasForRole(role, count, usedIds);
        team.push(...rolePersonas);
        rolePersonas.forEach(p => usedIds.add(p.id));
    }

    return {
        team: [...keyStakeholders, ...team],
        keyStakeholders,
        archetypeDistribution
    };
}

/**
 * Returns realistic team distribution by company size
 */
function getRealisticDistribution(companySize: number): Record<string, number> {
    // Scale factor based on company size
    const scale = Math.max(0.2, companySize / 100);

    if (companySize <= 20) {
        return {
            'Estagiário': Math.ceil(2 * scale),
            'Júnior': Math.ceil(4 * scale),
            'Pleno': Math.ceil(5 * scale),
            'Sênior': Math.ceil(2 * scale),
            'Tech Lead': 1,
            'Product': 1,
            'QA': 1
        };
    } else if (companySize <= 100) {
        return {
            'Estagiário': Math.ceil(5 * scale),
            'Júnior': Math.ceil(12 * scale),
            'Pleno': Math.ceil(20 * scale),
            'Sênior': Math.ceil(10 * scale),
            'Tech Lead': Math.ceil(3 * scale),
            'Gerente': Math.ceil(2 * scale),
            'Product': Math.ceil(2 * scale),
            'RH': 1,
            'QA': Math.ceil(4 * scale),
            'DevOps': Math.ceil(2 * scale)
        };
    } else {
        return {
            'Estagiário': Math.ceil(8 * scale),
            'Júnior': Math.ceil(25 * scale),
            'Pleno': Math.ceil(40 * scale),
            'Sênior': Math.ceil(20 * scale),
            'Tech Lead': Math.ceil(8 * scale),
            'Gerente': Math.ceil(5 * scale),
            'Diretor': 2,
            'Product': Math.ceil(5 * scale),
            'RH': Math.ceil(3 * scale),
            'QA': Math.ceil(8 * scale),
            'DevOps': Math.ceil(5 * scale),
            'Data': Math.ceil(5 * scale),
            'Security': Math.ceil(3 * scale)
        };
    }
}

/**
 * Gets personas for a specific role
 */
function getPersonasForRole(
    role: string,
    count: number,
    usedIds: Set<string>
): CompactPersona[] {
    const available = (profiles as CompactPersona[]).filter(p =>
        !usedIds.has(p.id) &&
        (p.cargo?.toLowerCase().includes(role.toLowerCase()) ||
            p.area?.toLowerCase().includes(role.toLowerCase()))
    );

    if (available.length === 0) {
        // Fallback to any unused profile
        const fallback = (profiles as CompactPersona[]).filter(p => !usedIds.has(p.id));
        return shuffle(fallback).slice(0, count);
    }

    return shuffle(available).slice(0, count);
}

/**
 * Generates a rich team description for injection into LLM prompts
 */
export function generateTeamDescription(team: CompactPersona[]): string {
    // Show key personas (max 10) for prompt efficiency
    const keyPersonas = team.slice(0, 10);

    return keyPersonas.map((p, i) => `
${i + 1}. **${p.nome}** (${p.cargo}, ${p.area})
   - Comunicação: ${p.estilo_comunicacao}
   - Trabalho: ${p.abordagem_trabalho}
   - Estresse: ${p.gestao_estresse}
   - Opinião Ágil: ${p.opiniao_agil}
   - Desafio: ${p.desafio_atual}
   - Viés: ${p.vies_cognitivo || getRandomBias()}
`).join('\n') + (team.length > 10 ? `\n... e mais ${team.length - 10} colaboradores.` : '');
}

/**
 * Calculates a resistance score for the team based on their profiles
 * Used in Monte Carlo variation
 */
export function calculateTeamResistance(team: CompactPersona[]): number {
    let resistance = 50; // Base resistance

    for (const persona of team) {
        // Skeptics increase resistance
        if (persona.opiniao_agil === 'Cético') resistance += 5;
        if (persona.opiniao_agil === 'Indiferente') resistance += 2;
        if (persona.opiniao_agil === 'Entusiasta') resistance -= 5;

        // Stress handling affects resistance
        if (persona.gestao_estresse?.includes('Necessita ambiente estável')) resistance += 3;
        if (persona.gestao_estresse?.includes('Thrives no caos')) resistance -= 3;

        // Work approach
        if (persona.abordagem_trabalho?.includes('Conservador')) resistance += 4;
        if (persona.abordagem_trabalho?.includes('Inovador')) resistance -= 4;
    }

    // Normalize to 0-100
    return Math.max(0, Math.min(100, resistance));
}
