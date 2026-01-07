/**
 * UserFrameworkStore - Vector Store para documentos de framework do usuário
 * 
 * Indexa chunks de documentos grandes e permite busca por similaridade
 * para injeção dinâmica de contexto nas simulações.
 */

import { Chroma } from '@langchain/community/vectorstores/chroma';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { Document } from 'langchain/document';
import type { DocumentChunk, ChunkingResult } from '../../services/SmartChunker.js';

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
    private embeddings: GoogleGenerativeAIEmbeddings;
    private vectorStore: Chroma | null = null;
    private collectionName: string;

    constructor(collectionName: string = 'user_frameworks') {
        this.collectionName = collectionName;
        this.embeddings = new GoogleGenerativeAIEmbeddings({
            apiKey: process.env.GOOGLE_API_KEY,
            model: 'text-embedding-004'
        });
    }

    /**
     * Inicializa conexão com ChromaDB
     */
    async initialize(): Promise<void> {
        console.log(`📚 UserFrameworkStore: Initializing collection "${this.collectionName}"...`);

        try {
            this.vectorStore = await Chroma.fromExistingCollection(
                this.embeddings,
                {
                    collectionName: this.collectionName,
                    url: process.env.CHROMA_URL || 'http://localhost:8000'
                }
            );
            console.log(`   ✅ Connected to existing collection`);
        } catch (error) {
            // Collection doesn't exist, create new
            console.log(`   📝 Creating new collection...`);
            this.vectorStore = new Chroma(this.embeddings, {
                collectionName: this.collectionName,
                url: process.env.CHROMA_URL || 'http://localhost:8000'
            });
        }
    }

    /**
     * Indexa chunks de um documento no Vector Store
     */
    async indexDocument(chunkingResult: ChunkingResult): Promise<IndexingResult> {
        console.log(`📥 Indexing ${chunkingResult.chunks.length} chunks for document ${chunkingResult.documentId}...`);

        if (!this.vectorStore) {
            await this.initialize();
        }

        try {
            // Converter chunks para Documents do LangChain
            const documents: Document[] = chunkingResult.chunks.map(chunk => new Document({
                pageContent: chunk.content,
                metadata: {
                    documentId: chunkingResult.documentId,
                    chunkId: chunk.id,
                    section: chunk.metadata.section,
                    keywords: chunk.metadata.keywords.join(','),
                    charStart: chunk.metadata.charStart,
                    charEnd: chunk.metadata.charEnd,
                    framework: chunkingResult.structure.framework || 'unknown'
                }
            }));

            // Adicionar ao Vector Store
            await this.vectorStore!.addDocuments(documents);

            console.log(`   ✅ Indexed ${documents.length} chunks successfully`);

            return {
                documentId: chunkingResult.documentId,
                chunksIndexed: documents.length,
                collectionName: this.collectionName,
                success: true
            };

        } catch (error) {
            console.error(`   ❌ Indexing failed:`, error);
            return {
                documentId: chunkingResult.documentId,
                chunksIndexed: 0,
                collectionName: this.collectionName,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Busca chunks relevantes para uma query
     */
    async search(query: string, topK: number = 5, filter?: Record<string, string>): Promise<SearchResult[]> {
        console.log(`🔍 Searching for: "${query.substring(0, 50)}..." (top ${topK})`);

        if (!this.vectorStore) {
            await this.initialize();
        }

        try {
            const results = await this.vectorStore!.similaritySearchWithScore(
                query,
                topK,
                filter
            );

            const searchResults: SearchResult[] = results.map(([doc, score]) => ({
                content: doc.pageContent,
                section: doc.metadata.section || 'Unknown',
                keywords: (doc.metadata.keywords || '').split(',').filter(Boolean),
                score: 1 - score // Convert distance to similarity
            }));

            console.log(`   Found ${searchResults.length} results`);
            return searchResults;

        } catch (error) {
            console.error(`   ❌ Search failed:`, error);
            return [];
        }
    }

    /**
     * Busca chunks de um documento específico
     */
    async searchByDocument(documentId: string, query: string, topK: number = 5): Promise<SearchResult[]> {
        return this.search(query, topK, { documentId });
    }

    /**
     * Busca chunks por framework (ex: COBIT, SAFe)
     */
    async searchByFramework(framework: string, query: string, topK: number = 5): Promise<SearchResult[]> {
        return this.search(query, topK, { framework });
    }

    /**
     * Gera contexto RAG consolidado para o prompt
     */
    async generateContext(query: string, topK: number = 5): Promise<string> {
        const results = await this.search(query, topK);

        if (results.length === 0) {
            return '/* Nenhum contexto adicional do documento do usuário */';
        }

        const contextBlocks = results.map((r, i) =>
            `[Chunk ${i + 1}] (${r.section}) [Keywords: ${r.keywords.join(', ')}]\n${r.content}`
        );

        return `
/* ===== CONTEXTO DO DOCUMENTO DO USUÁRIO (RAG) ===== */
${contextBlocks.join('\n\n---\n\n')}
/* ===== FIM DO CONTEXTO DO USUÁRIO ===== */
`;
    }

    /**
     * Remove todos os chunks de um documento
     */
    async deleteDocument(documentId: string): Promise<boolean> {
        console.log(`🗑️ Deleting document ${documentId}...`);

        if (!this.vectorStore) {
            await this.initialize();
        }

        try {
            // ChromaDB delete by filter
            await this.vectorStore!.delete({ filter: { documentId } });
            console.log(`   ✅ Document deleted`);
            return true;
        } catch (error) {
            console.error(`   ❌ Delete failed:`, error);
            return false;
        }
    }

    /**
     * Conta quantos chunks existem para um documento
     */
    async countChunks(documentId?: string): Promise<number> {
        if (!this.vectorStore) {
            await this.initialize();
        }

        try {
            // Search with high limit to count
            const results = await this.vectorStore!.similaritySearch(
                '',
                1000,
                documentId ? { documentId } : undefined
            );
            return results.length;
        } catch {
            return 0;
        }
    }
}

// Export singleton for default collection
export const userFrameworkStore = new UserFrameworkStore();
