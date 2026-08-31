/** Narrow Chroma adapter for uploaded framework documents. */
import { createHash } from 'node:crypto';
import {
    ChromaClient,
    IncludeEnum,
    type Collection,
    type IEmbeddingFunction,
    type Metadata,
    type Where
} from 'chromadb';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import type { ChunkingResult } from './SmartChunker.js';

export interface SearchResult {
    content: string;
    section: string;
    keywords: string[];
    score: number;
}

export interface IndexingResult {
    documentId: string;
    chunksIndexed: number;
    collectionName: string;
    success: boolean;
    error?: string;
}

export class UserFrameworkStore {
    private readonly embeddings: GoogleGenerativeAIEmbeddings;
    private readonly embeddingFunction: IEmbeddingFunction;
    private readonly client: ChromaClient;
    private vectorStore: Collection | null = null;

    constructor(private readonly collectionName = 'user_frameworks') {
        this.embeddings = new GoogleGenerativeAIEmbeddings({
            apiKey: process.env.GOOGLE_API_KEY,
            model: process.env.EMBEDDING_MODEL || 'text-embedding-004'
        });
        this.embeddingFunction = { generate: texts => this.embeddings.embedDocuments(texts) };
        this.client = new ChromaClient({ path: process.env.CHROMA_URL || 'http://localhost:8000' });
    }

    async initialize(): Promise<void> {
        console.log(`📚 UserFrameworkStore: inicializando "${this.collectionName}"...`);
        this.vectorStore = await this.client.getOrCreateCollection({
            name: this.collectionName,
            embeddingFunction: this.embeddingFunction
        });
    }

    async indexDocument(chunkingResult: ChunkingResult): Promise<IndexingResult> {
        if (!this.vectorStore) await this.initialize();
        try {
            const documents = chunkingResult.chunks.map(chunk => this.sanitize(chunk.content, 20_000));
            if (documents.length === 0) {
                return {
                    documentId: chunkingResult.documentId,
                    chunksIndexed: 0,
                    collectionName: this.collectionName,
                    success: true
                };
            }
            const metadatas: Metadata[] = chunkingResult.chunks.map(chunk => ({
                documentId: this.sanitize(chunkingResult.documentId, 240),
                chunkId: this.sanitize(chunk.id, 240),
                section: this.sanitize(chunk.metadata.section, 400),
                keywords: this.sanitize(chunk.metadata.keywords.join(','), 800),
                charStart: chunk.metadata.charStart,
                charEnd: chunk.metadata.charEnd,
                framework: this.sanitize(chunkingResult.structure.framework || 'unknown', 240)
            }));
            await this.vectorStore!.upsert({
                ids: chunkingResult.chunks.map(chunk => this.chunkId(chunkingResult.documentId, chunk.id)),
                documents,
                metadatas,
                embeddings: await this.embeddings.embedDocuments(documents)
            });
            return {
                documentId: chunkingResult.documentId,
                chunksIndexed: documents.length,
                collectionName: this.collectionName,
                success: true
            };
        } catch (error) {
            return {
                documentId: chunkingResult.documentId,
                chunksIndexed: 0,
                collectionName: this.collectionName,
                success: false,
                error: error instanceof Error ? error.name : 'Unavailable'
            };
        }
    }

    async search(query: string, topK = 5, filter?: Record<string, string>): Promise<SearchResult[]> {
        if (!this.vectorStore) await this.initialize();
        try {
            const boundedTopK = Math.min(Math.max(Math.floor(topK), 1), 20);
            const response = await this.vectorStore!.query({
                queryEmbeddings: [await this.embeddings.embedQuery(this.sanitize(query, 2_000))],
                nResults: boundedTopK,
                where: this.where(filter),
                include: [IncludeEnum.Documents, IncludeEnum.Metadatas, IncludeEnum.Distances]
            });
            const documents = response.documents?.[0] ?? [];
            const metadata = response.metadatas?.[0] ?? [];
            const distances = response.distances?.[0] ?? [];
            return documents.flatMap((content, index) => {
                if (content == null) return [];
                const item = metadata[index] ?? {};
                const distance = Number.isFinite(distances[index]) ? distances[index] : Number.POSITIVE_INFINITY;
                return [{
                    content,
                    section: typeof item.section === 'string' ? item.section : 'Unknown',
                    keywords: typeof item.keywords === 'string' ? item.keywords.split(',').filter(Boolean) : [],
                    score: Number.isFinite(distance) ? 1 / (1 + Math.max(0, distance)) : 0
                }];
            });
        } catch {
            return [];
        }
    }

    async searchByDocument(documentId: string, query: string, topK = 5): Promise<SearchResult[]> {
        return this.search(query, topK, { documentId });
    }

    async searchByFramework(framework: string, query: string, topK = 5): Promise<SearchResult[]> {
        return this.search(query, topK, { framework });
    }

    async generateContext(query: string, topK = 5): Promise<string> {
        const results = await this.search(query, topK);
        if (results.length === 0) return '/* Nenhum contexto adicional do documento do usuário */';
        const contextBlocks = results.map((result, index) =>
            `[Chunk ${index + 1}] (${result.section}) [Keywords: ${result.keywords.join(', ')}]\n${result.content}`
        );
        return `/* ===== CONTEXTO DO DOCUMENTO DO USUÁRIO (RAG) ===== */\n${contextBlocks.join('\n\n---\n\n')}\n/* ===== FIM DO CONTEXTO DO USUÁRIO ===== */`;
    }

    async deleteDocument(documentId: string): Promise<boolean> {
        if (!this.vectorStore) await this.initialize();
        try {
            await this.vectorStore!.delete({ where: { documentId: { $eq: this.sanitize(documentId, 240) } } });
            return true;
        } catch {
            return false;
        }
    }

    async countChunks(documentId?: string): Promise<number> {
        if (!this.vectorStore) await this.initialize();
        try {
            if (!documentId) return await this.vectorStore!.count();
            const response = await this.vectorStore!.get({
                where: { documentId: { $eq: this.sanitize(documentId, 240) } },
                include: []
            });
            return response.ids.length;
        } catch {
            return 0;
        }
    }

    private where(filter?: Record<string, string>): Where | undefined {
        if (!filter) return undefined;
        const conditions = Object.entries(filter)
            .filter(([, value]) => value.length > 0)
            .map(([key, value]): Where => ({ [key]: { $eq: this.sanitize(value, 240) } }));
        if (conditions.length === 0) return undefined;
        return conditions.length === 1 ? conditions[0] : { $and: conditions };
    }

    private chunkId(documentId: string, chunkId: string): string {
        return `framework-${createHash('sha256').update(`${documentId}:${chunkId}`).digest('hex').slice(0, 28)}`;
    }

    private sanitize(value: unknown, max: number): string {
        return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
    }
}

let userFrameworkStore: UserFrameworkStore | null = null;
export function getUserFrameworkStore(): UserFrameworkStore {
    if (!userFrameworkStore) userFrameworkStore = new UserFrameworkStore();
    return userFrameworkStore;
}
