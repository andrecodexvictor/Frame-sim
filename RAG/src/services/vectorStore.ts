/**
 * Vector Store Service - ChromaDB com collections separadas
 * Implementa Hierarchical Retrieval com índices por tipo de documento
 */

import { Chroma } from '@langchain/community/vectorstores/chroma';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { Document } from '@langchain/core/documents';
import type { LoadedDocuments } from './documentLoader.js';

export interface SearchResult {
    content: string;
    metadata: Record<string, unknown>;
    score: number;
}

export interface HybridSearchOptions {
    query: string;
    collections: ('profiles' | 'metrics' | 'events' | 'playbooks')[];
    topK?: number;
    filters?: {
        cargo?: string[];
        area?: string[];
        tipo?: string[];
        framework?: string[];
        [key: string]: string[] | undefined;
    };
}

export class VectorStoreService {
    private embeddings: GoogleGenerativeAIEmbeddings;
    private stores: Map<string, Chroma> = new Map();
    private dbPath: string;

    constructor(dbPath?: string, apiKey?: string) {
        this.dbPath = dbPath || process.env.CHROMA_DB_PATH || './chroma_db';
        this.embeddings = new GoogleGenerativeAIEmbeddings({
            apiKey: apiKey || process.env.GOOGLE_API_KEY,
            model: 'text-embedding-004', // Embedding model do Gemini
        });
    }

    /**
     * Inicializa ou carrega todas as collections
     */
    async initialize(): Promise<void> {
        const collections = ['profiles', 'metrics', 'events', 'playbooks'];

        for (const collection of collections) {
            try {
                const store = await Chroma.fromExistingCollection(this.embeddings, {
                    collectionName: collection,
                    url: 'http://localhost:8000', // ChromaDB local
                });
                this.stores.set(collection, store);
                console.log(`✅ Collection '${collection}' carregada`);
            } catch {
                console.log(`⏳ Collection '${collection}' não existe, será criada na indexação`);
            }
        }
    }

    /**
     * Indexa todos os documentos nas collections apropriadas
     */
    async indexDocuments(documents: LoadedDocuments): Promise<void> {
        console.log('\n🔄 Iniciando indexação...\n');

        // Indexar cada tipo de documento em sua collection
        await this.indexCollection('profiles', documents.profiles);
        await this.indexCollection('metrics', documents.metrics);
        await this.indexCollection('events', documents.events);
        await this.indexCollection('playbooks', documents.playbooks);

        console.log('\n✅ Indexação completa!\n');
    }

    private async indexCollection(name: string, docs: Document[]): Promise<void> {
        if (docs.length === 0) {
            console.log(`⚠️ Nenhum documento para indexar em '${name}'`);
            return;
        }

        console.log(`📝 Indexando ${docs.length} documentos em '${name}'...`);

        const store = await Chroma.fromDocuments(docs, this.embeddings, {
            collectionName: name,
            url: 'http://localhost:8000',
        });

        this.stores.set(name, store);
        console.log(`✅ '${name}' indexado com sucesso`);
    }

    /**
     * Busca híbrida em múltiplas collections com filtros
     */
    async hybridSearch(options: HybridSearchOptions): Promise<SearchResult[]> {
        const { query, collections, topK = 5, filters } = options;
        const allResults: SearchResult[] = [];

        for (const collection of collections) {
            const store = this.stores.get(collection);
            if (!store) {
                console.warn(`⚠️ Collection '${collection}' não encontrada`);
                continue;
            }

            // Construir filtro para ChromaDB
            const whereFilter = this.buildWhereFilter(filters);

            try {
                const results = await store.similaritySearchWithScore(
                    query,
                    topK,
                    whereFilter
                );

                for (const [doc, score] of results) {
                    allResults.push({
                        content: doc.pageContent,
                        metadata: { ...doc.metadata, collection },
                        score
                    });
                }
            } catch (error) {
                console.error(`Erro ao buscar em '${collection}':`, error);
            }
        }

        // Ordenar por score (menor = melhor para distância)
        allResults.sort((a, b) => a.score - b.score);

        // Retornar top K global
        return allResults.slice(0, topK);
    }

    /**
     * Busca específica em uma collection
     */
    async searchCollection(
        collection: 'profiles' | 'metrics' | 'events' | 'playbooks',
        query: string,
        topK: number = 5,
        filters?: Record<string, string | string[]>
    ): Promise<SearchResult[]> {
        const store = this.stores.get(collection);
        if (!store) {
            throw new Error(`Collection '${collection}' não inicializada`);
        }

        const whereFilter = this.buildWhereFilter(filters);

        const results = await store.similaritySearchWithScore(
            query,
            topK,
            whereFilter
        );

        return results.map(([doc, score]) => ({
            content: doc.pageContent,
            metadata: doc.metadata,
            score
        }));
    }

    /**
     * Busca por persona específica por cargo
     */
    async findPersonasByCargo(cargo: string, topK: number = 3): Promise<SearchResult[]> {
        return this.searchCollection('profiles', cargo, topK, { cargo: [cargo] });
    }

    /**
     * Busca métricas relacionadas a um tópico
     */
    async findMetrics(topic: string, topK: number = 3): Promise<SearchResult[]> {
        return this.searchCollection('metrics', topic, topK);
    }

    /**
     * Busca eventos por tipo
     */
    async findEvents(tipo: string, topK: number = 5): Promise<SearchResult[]> {
        return this.searchCollection('events', tipo, topK, { tipo: [tipo] });
    }

    /**
     * Constrói filtro where para ChromaDB
     */
    private buildWhereFilter(
        filters?: Record<string, string | string[] | undefined>
    ): Record<string, unknown> | undefined {
        if (!filters) return undefined;

        const conditions: Array<Record<string, unknown>> = [];

        for (const [key, value] of Object.entries(filters)) {
            if (!value) continue;

            if (Array.isArray(value) && value.length > 0) {
                conditions.push({ [key]: { $in: value } });
            } else if (typeof value === 'string') {
                conditions.push({ [key]: { $eq: value } });
            }
        }

        if (conditions.length === 0) return undefined;
        if (conditions.length === 1) return conditions[0];

        return { $and: conditions };
    }

    /**
     * Retorna estatísticas das collections
     */
    async getStats(): Promise<Record<string, number>> {
        const stats: Record<string, number> = {};

        for (const [name, store] of this.stores) {
            try {
                // ChromaDB não tem método direto para count, usar workaround
                const result = await store.similaritySearch('', 1);
                stats[name] = result.length > 0 ? 1 : 0; // Placeholder
            } catch {
                stats[name] = 0;
            }
        }

        return stats;
    }
}

// Factory function para inicialização rápida
export async function createVectorStore(
    dbPath?: string,
    apiKey?: string
): Promise<VectorStoreService> {
    const store = new VectorStoreService(dbPath, apiKey);
    await store.initialize();
    return store;
}
