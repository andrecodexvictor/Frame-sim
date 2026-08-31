/** Deterministic Self-RAG router. Classification is local, fast and auditable. */
import type { QueryClassification } from '../types/index.js';

function normalize(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function has(text: string, expression: RegExp): boolean {
    return expression.test(text);
}

export class QueryRouter {
    // apiKey is accepted for backward compatibility; routing itself needs no key.
    constructor(_apiKey?: string) {}

    async classify(query: string, _context?: string): Promise<QueryClassification> {
        const text = normalize(String(query || '')).slice(0, 10_000);
        const persona = has(text, /\b(persona|stakeholder|ceo|cto|cfo|lider|gerente|time|equipe|reagir|reacao|comportamento)\w*/);
        const financial = has(text, /\b(roi|custo|break-?even|opex|valor|orcamento|retorno|financeir)\w*/);
        const comparison = has(text, /\b(vs\.?|versus|compar|diferenca|melhor entre|scrum|kanban|safe|cobit)\w*/)
            && (has(text, /\b(vs\.?|versus|compar|diferenca|melhor entre)\w*/) || (text.includes('scrum') && text.includes('kanban')));
        const event = has(text, /\b(evento|risco|gatilho|incidente|crise|probabilidade|burnout|demissao|falha)\w*/);
        const active = [persona, financial, comparison, event].filter(Boolean).length;

        if (active > 1) {
            const collections: QueryClassification['filters']['collections'] = [];
            if (financial) collections.push('metrics');
            if (comparison) collections.push('playbooks');
            if (event) collections.push('events');
            return { mode: 'HIBRIDO', confidence: 0.9, filters: { collections: [...new Set(collections)] }, refinedQuery: query };
        }
        if (persona) return { mode: 'PERSONA_PURA', confidence: 0.88, filters: { collections: [] }, refinedQuery: query };
        if (financial) return { mode: 'CALCULO_ROI', confidence: 0.9, filters: { collections: ['metrics'] }, refinedQuery: query };
        if (comparison) return { mode: 'CENARIO_COMPARATIVO', confidence: 0.9, filters: { collections: ['playbooks', 'metrics'] }, refinedQuery: query };
        if (event) return { mode: 'EVENTO_SIMULACAO', confidence: 0.88, filters: { collections: ['events'] }, refinedQuery: query };
        return {
            mode: 'HIBRIDO',
            confidence: 0.55,
            filters: { collections: ['playbooks', 'events'] },
            refinedQuery: query
        };
    }

    shouldUseRAG(classification: QueryClassification): boolean {
        return classification.mode !== 'PERSONA_PURA' && classification.filters.collections.length > 0;
    }

    getTargetCollections(classification: QueryClassification): string[] {
        return classification.filters.collections;
    }
}

export async function classifyQuery(query: string): Promise<QueryClassification> {
    return new QueryRouter().classify(query);
}
