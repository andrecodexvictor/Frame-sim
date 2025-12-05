/**
 * Query Router - Self-RAG para decidir quando usar/ignorar retrieval
 * Classifica queries em 5 modos para otimizar o fluxo de RAG
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { z } from 'zod';
import type { QueryClassification, QueryMode } from '../types/index.js';

// Schema Zod para validação do output
const QueryClassificationSchema = z.object({
    mode: z.enum(['PERSONA_PURA', 'CALCULO_ROI', 'CENARIO_COMPARATIVO', 'EVENTO_SIMULACAO', 'HIBRIDO']),
    confidence: z.number().min(0).max(1),
    collections: z.array(z.enum(['profiles', 'metrics', 'events', 'playbooks'])),
    refinedQuery: z.string()
});

// Prompt do classificador
const CLASSIFIER_PROMPT = `Você é um classificador de queries para um sistema RAG de simulação empresarial.

## Tipos de Query

| Modo | Descrição | Collections RAG | Exemplo |
|------|-----------|-----------------|---------|
| PERSONA_PURA | Pergunta sobre comportamento de stakeholder específico, sem precisar de dados externos | [] (vazio) | "Como o CEO cético reagiria?" |
| CALCULO_ROI | Requer fórmulas, métricas financeiras ou cálculos | ["metrics"] | "Qual o break-even em 12 meses?" |
| CENARIO_COMPARATIVO | Compara frameworks, metodologias ou cenários | ["playbooks", "metrics"] | "Scrum vs Kanban para PME?" |
| EVENTO_SIMULACAO | Pergunta sobre gatilhos, eventos ou riscos | ["events"] | "O que causa queda de produção?" |
| HIBRIDO | Combina múltiplos aspectos | múltiplas collections | "Como o time reagiria a um incidente e qual o impacto no ROI?" |

## Regras

1. Se a query menciona uma persona específica por cargo E pede comportamento/reação, SEM pedir dados externos → PERSONA_PURA
2. Se a query menciona "ROI", "custo", "break-even", "OpEx", "valor" → CALCULO_ROI
3. Se compara dois frameworks ou cenários → CENARIO_COMPARATIVO
4. Se pergunta sobre "eventos", "riscos", "gatilhos", "probabilidade" → EVENTO_SIMULACAO
5. Se combina persona + cálculo ou persona + evento → HIBRIDO

## Query
{query}

## Contexto Adicional (se houver)
{context}

## Output
Retorne APENAS um JSON válido:
{
  "mode": "PERSONA_PURA|CALCULO_ROI|CENARIO_COMPARATIVO|EVENTO_SIMULACAO|HIBRIDO",
  "confidence": 0.0-1.0,
  "collections": ["profiles"|"metrics"|"events"|"playbooks"],
  "refinedQuery": "query refinada para busca"
}`;

export class QueryRouter {
    private llm: ChatGoogleGenerativeAI;

    constructor(apiKey?: string) {
        this.llm = new ChatGoogleGenerativeAI({
            apiKey: apiKey || process.env.GOOGLE_API_KEY,
            model: 'gemini-1.5-flash', // Usar Flash para classificação rápida
            temperature: 0, // Determinístico
        });
    }

    /**
     * Classifica a query e decide o modo de RAG
     */
    async classify(query: string, context?: string): Promise<QueryClassification> {
        const prompt = CLASSIFIER_PROMPT
            .replace('{query}', query)
            .replace('{context}', context || 'Nenhum contexto adicional');

        try {
            const response = await this.llm.invoke(prompt);
            const content = typeof response.content === 'string'
                ? response.content
                : JSON.stringify(response.content);

            // Extrair JSON da resposta
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Nenhum JSON encontrado na resposta');
            }

            const parsed = JSON.parse(jsonMatch[0]);
            const validated = QueryClassificationSchema.parse(parsed);

            return {
                mode: validated.mode as QueryMode,
                confidence: validated.confidence,
                filters: {
                    collections: validated.collections as ('profiles' | 'metrics' | 'events' | 'playbooks')[],
                },
                refinedQuery: validated.refinedQuery
            };
        } catch (error) {
            console.error('Erro ao classificar query:', error);
            // Fallback para modo híbrido
            return {
                mode: 'HIBRIDO',
                confidence: 0.5,
                filters: {
                    collections: ['profiles', 'metrics', 'events', 'playbooks']
                },
                refinedQuery: query
            };
        }
    }

    /**
     * Determina se deve usar RAG baseado na classificação
     */
    shouldUseRAG(classification: QueryClassification): boolean {
        return classification.mode !== 'PERSONA_PURA' &&
            classification.filters.collections.length > 0;
    }

    /**
     * Retorna quais collections devem ser consultadas
     */
    getTargetCollections(classification: QueryClassification): string[] {
        return classification.filters.collections;
    }
}

// Uso rápido para testes
export async function classifyQuery(query: string): Promise<QueryClassification> {
    const router = new QueryRouter();
    return router.classify(query);
}
