/**
 * Persona Agent - Simula comportamento de stakeholders
 * Usa few-shot examples e NÃO usa RAG para queries de persona pura
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type {
    PersonaProfile,
    PersonaResponse,
    FewShotExample,
    SimulationConfig
} from '../types/index.js';

// Few-shot examples por arquétipo (expandir conforme necessário)
const ARCHETYPE_EXAMPLES: Record<string, FewShotExample[]> = {
    'CEO_CETICO': [
        {
            situacao: 'Proposta de migração para Scrum',
            resposta: 'Já tentamos isso em 2019. Perdemos 3 meses e 2 Tech Leads. Me mostre dados concretos antes de qualquer decisão.'
        },
        {
            situacao: 'ROI positivo após 6 meses de implementação',
            resposta: 'Interessante, mas precisamos de 3 trimestres consecutivos para validar. Um resultado isolado não significa tendência.'
        }
    ],
    'CFO_PRAGMATICO': [
        {
            situacao: 'Pedido de budget para ferramentas ágeis',
            resposta: 'Qual o payback esperado? Preciso ver uma projeção de ROI com cenários pessimista, realista e otimista antes de aprovar.'
        },
        {
            situacao: 'Atraso em projeto crítico',
            resposta: 'Cada dia de atraso nos custa R$50.000 em oportunidade perdida. Quais são as opções para acelerar a entrega?'
        }
    ],
    'CTO_ENTUSIASTA': [
        {
            situacao: 'Proposta de Daily Standup de 15 minutos',
            resposta: 'Excelente! Isso vai melhorar a comunicação do time. Sugiro começarmos com um piloto no squad de plataforma.'
        },
        {
            situacao: 'Resistência do time à mudança',
            resposta: 'Vamos fazer workshops hands-on. A melhor forma de convencer é mostrar resultados rápidos em um projeto real.'
        }
    ],
    'TECH_LEAD_CETICO': [
        {
            situacao: 'Implementação de novas cerimônias ágeis',
            resposta: 'Mais reuniões? Já perdemos 30% do tempo com meetings. Prefiro code reviews assíncronos e documentação clara.'
        },
        {
            situacao: 'Proposta de pair programming obrigatório',
            resposta: 'Funciona para contextos específicos, mas obrigar em tudo vai reduzir nossa velocidade pela metade.'
        }
    ],
    'DEV_SENIOR_AUTONOMO': [
        {
            situacao: 'Mudança de framework de gestão',
            resposta: 'Desde que não interfira no meu fluxo de trabalho e eu continue entregando, não tenho problemas.'
        },
        {
            situacao: 'Retrospectiva semanal',
            resposta: 'Prefiro fazer isso a cada duas semanas. Semanal é muito, não dá tempo de ter progresso significativo.'
        }
    ]
};

const PERSONA_PROMPT = `# SIMULADOR DE STAKEHOLDER

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

## EXEMPLOS DE COMPORTAMENTO (mantenha consistência)
{examples}

## CONTEXTO DA SIMULAÇÃO
{contexto}

## REGRAS DE SIMULAÇÃO
1. Mantenha TOTAL consistência com o perfil psicológico acima
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
            model: 'gemini-1.5-pro',
            temperature: 0.7, // Alguma variação para respostas naturais
        });
    }

    /**
     * Simula resposta de uma persona a uma situação
     */
    async simulateResponse(
        persona: PersonaProfile,
        situacao: string,
        config?: SimulationConfig
    ): Promise<PersonaResponse> {
        const prompt = this.buildPrompt(persona, situacao, config);

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
        config?: SimulationConfig
    ): string {
        const { informacoes_basicas: info, psicologia_comportamento: psych, contexto } = persona;

        // Determinar arquétipo para few-shot examples
        const archetype = this.determineArchetype(persona);
        const examples = this.getExamples(archetype);

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
        return ARCHETYPE_EXAMPLES[archetype] || ARCHETYPE_EXAMPLES['DEV_SENIOR_AUTONOMO'];
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
export const personaAgent = new PersonaAgent();
