/**
 * Persona Agent - Simula comportamento de stakeholders
 * Usa few-shot examples e NÃO usa RAG para queries de persona pura
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { readFileSync } from 'fs';
import path from 'path';
import { geminiModel } from '../services/LLMProvider.js';
import type {
    PersonaProfile,
    PersonaResponse,
    FewShotExample,
    SimulationConfig
} from '../types/index.js';
import type { EmployeeBrainState } from '../core/employeeBrainCore.js';

// Few-shot examples por arquétipo, carregados de data/archetype_examples.json
// (fonte única compartilhada com services/ragService.ts no frontend).
// ponytail: lazy + cached module-level var em vez de import assertion — evita
// atrito de JSON import no tsc/tsx deste pacote ESM.
let _archetypeExamples: Record<string, FewShotExample[]> | null = null;

function loadArchetypeExamples(): Record<string, FewShotExample[]> {
    if (_archetypeExamples) return _archetypeExamples;

    const candidates = [
        path.join(process.cwd(), 'data', 'archetype_examples.json'),
        path.join(process.cwd(), '..', 'data', 'archetype_examples.json')
    ];

    for (const candidate of candidates) {
        try {
            _archetypeExamples = JSON.parse(readFileSync(candidate, 'utf-8'));
            return _archetypeExamples!;
        } catch {
            // try next candidate
        }
    }

    console.warn('⚠️  archetype_examples.json não encontrado (tentado em data/ e ../data/). Few-shot examples ficarão vazios.');
    _archetypeExamples = {};
    return _archetypeExamples;
}

// Viéses Cognitivos para maior realismo
const COGNITIVE_BIASES = [
    'Viés de Confirmação: Tende a favorecer informações que confirmam suas crenças pré-existentes.',
    'Status Quo Bias: Preferência desproporcional por manter as coisas como estão.',
    'Falácia do Custo Irrecuperável: Apegado a investimentos passados mesmo que não façam mais sentido.',
    'Viés de Autoridade: Valoriza excessivamente a opinião de figuras de autoridade ou dados "oficiais".',
    'Aversão à Perda: O medo de perder autonomia/status é maior que a motivação por ganhos.',
    'Viés de Otimismo: Subestima riscos e prazos (comum em perfis entusiastas).',
    'Viés de Negatividade: Foca excessivamente nos problemas e riscos (comum em perfis céticos).'
];

const PERSONA_PROMPT = `# SIMULADOR DE STAKEHOLDER
{bias_instruction}

Você está simulando o comportamento de um stakeholder específico durante a implementação de um framework de gestão.

## PERSONA ATIVA
Nome: {nome}
Cargo: {cargo} | Área: {area}
Experiência: {experiencia}
Estilo de Comunicação: {comunicacao}
Abordagem ao Trabalho: {abordagem}
Gestão de Conflitos: {conflitos}
Gestão de Estresse: {estresse}
Framework Preferido: {framework}
Opinião sobre Ágil: {opiniao_agil}
Desafio Atual: {desafio}
Motivação Principal: {motivacao}

## VIÉS COGNITIVO DOMINANTE
⚠️ **APLIQUE ESTE VIÉS NA RESPOSTA:**
{bias}
{estado_interno}
## EXEMPLOS DE COMPORTAMENTO (mantenha consistência)
{examples}

## CONTEXTO DA SIMULAÇÃO
{contexto}

## REGRAS DE SIMULAÇÃO
1. Mantenha TOTAL consistência com o perfil psicológico e o viés cognitivo.
2. Use termos e vocabulário adequados ao cargo
3. Referencie o histórico e desafios quando relevante
4. Seja realista - nem todo stakeholder é resistente ou entusiasta
5. Considere o impacto emocional da situação na persona

## SITUAÇÃO ATUAL
{situacao}

## OUTPUT
Responda APENAS em JSON válido:
{
  "resposta_persona": "resposta do stakeholder em primeira pessoa",
  "emocao_detectada": "emoção principal (ex: frustração, entusiasmo, ceticismo, esperança)",
  "impacto_moral": número de -10 a +10,
  "rag_utilizado": false,
  "fonte_rag": null
}`;

export class PersonaAgent {
    private llm: ChatGoogleGenerativeAI;

    constructor(apiKey?: string) {
        this.llm = new ChatGoogleGenerativeAI({
            apiKey: apiKey || process.env.GOOGLE_API_KEY,
            model: geminiModel(),
            temperature: 0.7, // Alguma variação para respostas naturais
        });
    }

    /**
     * Simula resposta de uma persona a uma situação
     */
    async simulateResponse(
        persona: PersonaProfile,
        situacao: string,
        config?: SimulationConfig,
        brain?: EmployeeBrainState
    ): Promise<PersonaResponse> {
        const prompt = this.buildPrompt(persona, situacao, config, brain);

        try {
            const response = await this.llm.invoke(prompt);
            const content = typeof response.content === 'string'
                ? response.content
                : JSON.stringify(response.content);

            // Extrair JSON
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('JSON não encontrado na resposta');
            }

            return JSON.parse(jsonMatch[0]) as PersonaResponse;
        } catch (error) {
            console.error('Erro ao simular persona:', error);
            return {
                resposta_persona: 'Não tenho uma opinião formada sobre isso no momento.',
                emocao_detectada: 'neutro',
                impacto_moral: 0,
                rag_utilizado: false,
                fonte_rag: null
            };
        }
    }

    /**
     * Constrói o prompt com dados da persona e few-shot examples
     */
    private buildPrompt(
        persona: PersonaProfile,
        situacao: string,
        config?: SimulationConfig,
        brain?: EmployeeBrainState
    ): string {
        const { informacoes_basicas: info, psicologia_comportamento: psych, contexto } = persona;

        // Determinar arquétipo para few-shot examples
        const archetype = this.determineArchetype(persona);
        const examples = this.getExamples(archetype);

        // Viés Cognitivo: prioriza o do brain (derivado do perfil); aleatório só na ausência
        const bias = brain?.viesCognitivo
            || COGNITIVE_BIASES[Math.floor(Math.random() * COGNITIVE_BIASES.length)];

        // Estado interno do EmployeeBrain (números guiam o tom, nunca são revelados)
        let estadoInterno = '';
        if (brain) {
            const memorias = [...brain.memoria]
                .sort((a, b) => Math.abs(b.valencia) - Math.abs(a.valencia))
                .slice(0, 3)
                .map(m => `"${m.evento}" (impacto ${m.valencia})`)
                .join(', ') || 'nenhuma';
            estadoInterno = `
## ESTADO INTERNO ATUAL (não revele números, apenas aja de acordo)
Estresse: ${Math.round(brain.estresse)}/100 | Humor: ${Math.round(brain.humor)} (-100..100) | Energia: ${Math.round(brain.energia)}/100 | Engajamento: ${Math.round(brain.engajamento)}/100
MEMÓRIAS RECENTES: ${memorias}
REFLEXÃO: ${brain.reflexao || 'nenhuma ainda'}
`;
        }

        // Formatar exemplos
        const examplesText = examples
            .map((ex, i) => `### Exemplo ${i + 1}\nSituação: ${ex.situacao}\nResposta: "${ex.resposta}"`)
            .join('\n\n');

        // Contexto da simulação
        const contextoText = config
            ? `Cenário: ${config.contexto_situacional.cenario_atual}
Dívida Técnica: ${config.calibragem_realismo.divida_tecnica.valor}
Histórico Traumático: ${config.calibragem_realismo.historico_traumatico.valor ? 'Sim, já falhamos antes' : 'Não'}
Empresa: ${config.parametros_simulacao.adaptacao_pme ? 'PME' : 'Enterprise'} com ${config.contexto_estrutural.tamanho_ftes.valor} FTEs`
            : 'Contexto padrão de simulação';

        return PERSONA_PROMPT
            .replace('{bias_instruction}', `⚠️ ATENÇÃO: Esta persona está sob efeito de **${bias.split(':')[0]}**.`)
            .replace('{estado_interno}', estadoInterno)
            .replace('{nome}', info.nome)
            .replace('{cargo}', info.cargo)
            .replace('{area}', info.area)
            .replace('{experiencia}', info.tempo_carreira)
            .replace('{comunicacao}', psych['Estilo de Comunicação'])
            .replace('{abordagem}', psych['Abordagem ao Trabalho'])
            .replace('{conflitos}', psych['Gestão de Conflitos'])
            .replace('{estresse}', psych['Gestão de Estresse'])
            .replace('{framework}', contexto.framework_preferido)
            .replace('{opiniao_agil}', contexto.opiniao_agil)
            .replace('{desafio}', contexto.desafio_atual)
            .replace('{motivacao}', contexto.motivacao_atual)
            .replace('{bias}', bias)
            .replace('{examples}', examplesText || 'Nenhum exemplo específico disponível')
            .replace('{contexto}', contextoText)
            .replace('{situacao}', situacao);
    }

    /**
     * Determina o arquétipo baseado no perfil
     */
    private determineArchetype(persona: PersonaProfile): string {
        const { informacoes_basicas: info, contexto } = persona;
        const cargo = info.cargo.toUpperCase();
        const opiniao = contexto.opiniao_agil.toUpperCase();

        if (cargo.includes('C-LEVEL') || cargo.includes('CEO') || cargo.includes('DIRETOR')) {
            if (opiniao.includes('CÉTICO')) return 'CEO_CETICO';
            return 'CEO_CETICO'; // Default para liderança
        }

        if (cargo.includes('CFO') || info.area.toUpperCase().includes('FINANCEIRO')) {
            return 'CFO_PRAGMATICO';
        }

        if (cargo.includes('CTO') || (cargo.includes('DIRETOR') && info.area.includes('TECNOLOGIA'))) {
            if (opiniao.includes('ENTUSIASTA')) return 'CTO_ENTUSIASTA';
            return 'TECH_LEAD_CETICO';
        }

        if (cargo.includes('TECH LEAD') || cargo.includes('LEAD')) {
            if (opiniao.includes('CÉTICO')) return 'TECH_LEAD_CETICO';
            return 'CTO_ENTUSIASTA';
        }

        if (cargo.includes('SÊNIOR') || cargo.includes('SENIOR')) {
            return 'DEV_SENIOR_AUTONOMO';
        }

        // Default
        return 'DEV_SENIOR_AUTONOMO';
    }

    /**
     * Retorna few-shot examples para o arquétipo
     */
    private getExamples(archetype: string): FewShotExample[] {
        const examples = loadArchetypeExamples();
        return examples[archetype] || examples['DEV_SENIOR_AUTONOMO'] || [];
    }

    /**
     * Simula múltiplas respostas para a mesma situação (variação natural)
     */
    async simulateMultiple(
        persona: PersonaProfile,
        situacao: string,
        count: number = 3,
        config?: SimulationConfig
    ): Promise<PersonaResponse[]> {
        const responses: PersonaResponse[] = [];

        for (let i = 0; i < count; i++) {
            const response = await this.simulateResponse(persona, situacao, config);
            responses.push(response);
        }

        return responses;
    }
}

// Export para uso direto
// export const personaAgent = new PersonaAgent();
