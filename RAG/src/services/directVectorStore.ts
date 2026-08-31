/**
 * ChromaDB storage using the narrow Chroma client directly. Keeping this
 * adapter local avoids pulling the broad LangChain Community dependency.
 */
import { createHash, randomUUID } from 'node:crypto';
import {
    ChromaClient,
    IncludeEnum,
    type Collection,
    type IEmbeddingFunction,
    type Metadata,
    type Where
} from 'chromadb';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import type { Document } from '@langchain/core/documents';
import type { LoadedDocuments } from './documentLoader.js';

type CollectionName = 'profiles' | 'metrics' | 'events' | 'playbooks' | 'history';

export interface SearchResult {
    content: string;
    metadata: Record<string, unknown>;
    score: number;
}

export interface HybridSearchOptions {
    query: string;
    collections: CollectionName[];
    topK?: number;
    filters?: Record<string, string[] | undefined>;
}

export class VectorStoreService {
    private readonly embeddings: GoogleGenerativeAIEmbeddings;
    private readonly embeddingFunction: IEmbeddingFunction;
    private readonly client: ChromaClient;
    private readonly stores = new Map<CollectionName, Collection>();

    constructor(chromaUrl?: string, apiKey?: string) {
        const endpoint = chromaUrl?.startsWith('http')
            ? chromaUrl
            : process.env.CHROMA_URL || 'http://localhost:8000';
        this.client = new ChromaClient({ path: endpoint });
        this.embeddings = new GoogleGenerativeAIEmbeddings({
            apiKey: apiKey || process.env.GOOGLE_API_KEY,
            model: process.env.EMBEDDING_MODEL || 'text-embedding-004'
        });
        this.embeddingFunction = {
            generate: (texts: string[]) => this.embeddings.embedDocuments(texts)
        };
    }

    async initialize(): Promise<void> {
        const names: CollectionName[] = ['profiles', 'metrics', 'events', 'playbooks', 'history'];
        for (const name of names) {
            try {
                const store = await this.client.getCollection({
                    name,
                    embeddingFunction: this.embeddingFunction
                });
                this.stores.set(name, store);
                console.log(`✅ Collection '${name}' carregada`);
            } catch {
                console.log(`⏳ Collection '${name}' não existe, será criada quando necessária`);
            }
        }
    }

    async saveMemory(content: string, metadata: Record<string, unknown>): Promise<boolean> {
        try {
            const store = await this.getOrCreateStore('history');
            const sanitized = this.sanitizeText(content, 1400);
            const timestamp = Date.now();
            await store.add({
                ids: [`history-${timestamp}-${randomUUID()}`],
                documents: [sanitized],
                metadatas: [this.sanitizeMetadata({ ...metadata, timestamp })],
                embeddings: await this.embeddings.embedDocuments([sanitized])
            });
            console.log("💾 Memória salva em 'history'");
            return true;
        } catch (error) {
            console.warn('⚠️ Memória não persistida (Chroma indisponível):', this.safeError(error));
            return false;
        }
    }

    async recallMemories(query: string, topK = 3): Promise<SearchResult[]> {
        try {
            const boundedTopK = Math.min(Math.max(Math.floor(topK), 0), 3);
            if (boundedTopK === 0) return [];
            const results = await this.searchCollection(
                'history',
                this.sanitizeText(query, 800),
                boundedTopK
            );
            return results
                .map(result => ({ ...result, content: this.sanitizeText(result.content, 600) }))
                .sort((left, right) => left.score - right.score || left.content.localeCompare(right.content));
        } catch (error) {
            console.warn('⚠️ Memória não recuperada (Chroma indisponível):', this.safeError(error));
            throw error;
        }
    }

    async indexDocuments(documents: LoadedDocuments): Promise<void> {
        console.log('\n🔄 Iniciando indexação...\n');
        await this.indexCollection('profiles', documents.profiles);
        await this.indexCollection('metrics', documents.metrics);
        await this.indexCollection('events', documents.events);
        await this.indexCollection('playbooks', documents.playbooks);
        console.log('\n✅ Indexação completa!\n');
    }

    private async indexCollection(name: Exclude<CollectionName, 'history'>, docs: Document[]): Promise<void> {
        if (docs.length === 0) {
            console.log(`⚠️ Nenhum documento para indexar em '${name}'`);
            return;
        }
        console.log(`📝 Indexando ${docs.length} documentos em '${name}'...`);
        const store = await this.getOrCreateStore(name);
        const documents = docs.map(doc => this.sanitizeText(doc.pageContent, 20_000));
        await store.upsert({
            ids: documents.map((content, index) => this.documentId(name, content, index)),
            documents,
            embeddings: await this.embeddings.embedDocuments(documents),
            metadatas: docs.map(doc => this.sanitizeMetadata(doc.metadata))
        });
        console.log(`✅ '${name}' indexado com sucesso`);
    }

    async hybridSearch(options: HybridSearchOptions): Promise<SearchResult[]> {
        const topK = Math.min(Math.max(Math.floor(options.topK ?? 5), 1), 20);
        const query = this.sanitizeText(options.query, 2_000);
        const queryEmbedding = await this.embeddings.embedQuery(query);
        const where = this.buildWhereFilter(options.filters);
        const groups = await Promise.all(options.collections.map(async collection => {
            const store = this.stores.get(collection);
            if (!store) return [];
            try {
                const results = await this.queryStore(store, queryEmbedding, topK, where);
                return results.map(result => ({
                    ...result,
                    metadata: { ...result.metadata, collection }
                }));
            } catch (error) {
                console.warn(`⚠️ Busca indisponível em '${collection}':`, this.safeError(error));
                return [];
            }
        }));
        return groups.flat()
            .sort((left, right) => left.score - right.score || left.content.localeCompare(right.content))
            .slice(0, topK);
    }

    async searchCollection(
        collection: CollectionName,
        query: string,
        topK = 5,
        filters?: Record<string, string | string[]>
    ): Promise<SearchResult[]> {
        const store = this.stores.get(collection);
        if (!store) throw new Error(`Collection '${collection}' não inicializada`);
        const boundedTopK = Math.min(Math.max(Math.floor(topK), 1), 20);
        const embedding = await this.embeddings.embedQuery(this.sanitizeText(query, 2_000));
        return this.queryStore(store, embedding, boundedTopK, this.buildWhereFilter(filters));
    }

    async findPersonasByCargo(cargo: string, topK = 3): Promise<SearchResult[]> {
        return this.searchCollection('profiles', cargo, topK, { cargo: [cargo] });
    }

    async findMetrics(topic: string, topK = 3): Promise<SearchResult[]> {
        return this.searchCollection('metrics', topic, topK);
    }

    async findEvents(tipo: string, topK = 5): Promise<SearchResult[]> {
        return this.searchCollection('events', tipo, topK, { tipo: [tipo] });
    }

    async getStats(): Promise<Record<string, number>> {
        const stats: Record<string, number> = {};
        await Promise.all([...this.stores].map(async ([name, store]) => {
            try {
                stats[name] = await store.count();
            } catch {
                stats[name] = 0;
            }
        }));
        return stats;
    }

    private async getOrCreateStore(name: CollectionName): Promise<Collection> {
        const existing = this.stores.get(name);
        if (existing) return existing;
        const store = await this.client.getOrCreateCollection({
            name,
            embeddingFunction: this.embeddingFunction
        });
        this.stores.set(name, store);
        return store;
    }

    private async queryStore(
        store: Collection,
        queryEmbedding: number[],
        topK: number,
        where?: Where
    ): Promise<SearchResult[]> {
        const response = await store.query({
            queryEmbeddings: [queryEmbedding],
            nResults: topK,
            where,
            include: [IncludeEnum.Documents, IncludeEnum.Metadatas, IncludeEnum.Distances]
        });
        const documents = response.documents?.[0] ?? [];
        const metadatas = response.metadatas?.[0] ?? [];
        const distances = response.distances?.[0] ?? [];
        return documents.flatMap((content, index) => content == null ? [] : [{
            content,
            metadata: metadatas[index] ?? {},
            score: Number.isFinite(distances[index]) ? distances[index] : Number.POSITIVE_INFINITY
        }]);
    }

    private buildWhereFilter(
        filters?: Record<string, string | string[] | undefined>
    ): Where | undefined {
        if (!filters) return undefined;
        const conditions: Where[] = [];
        for (const [key, value] of Object.entries(filters)) {
            if (Array.isArray(value) && value.length > 0) conditions.push({ [key]: { $in: value } });
            else if (typeof value === 'string' && value.length > 0) conditions.push({ [key]: { $eq: value } });
        }
        if (conditions.length === 0) return undefined;
        return conditions.length === 1 ? conditions[0] : { $and: conditions };
    }

    private sanitizeMetadata(value: Record<string, unknown>): Metadata {
        const sanitized: Metadata = {};
        for (const [key, item] of Object.entries(value)) {
            if (typeof item === 'string') sanitized[key] = this.sanitizeText(item, 800);
            else if (typeof item === 'number' && Number.isFinite(item)) sanitized[key] = item;
            else if (typeof item === 'boolean') sanitized[key] = item;
            else if (item != null) sanitized[key] = this.sanitizeText(JSON.stringify(item), 800);
        }
        return sanitized;
    }

    private sanitizeText(value: unknown, maxChars: number): string {
        return String(value ?? '')
            .replace(/[\u0000-\u001f\u007f]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, maxChars);
    }

    private documentId(collection: string, content: string, index: number): string {
        const digest = createHash('sha256').update(`${collection}:${index}:${content}`).digest('hex').slice(0, 24);
        return `${collection}-${digest}`;
    }

    private safeError(error: unknown): string {
        return error instanceof Error ? error.name : 'unavailable';
    }
}

export async function createVectorStore(chromaUrl?: string, apiKey?: string): Promise<VectorStoreService> {
    const store = new VectorStoreService(chromaUrl, apiKey);
    await store.initialize();
    return store;
}
